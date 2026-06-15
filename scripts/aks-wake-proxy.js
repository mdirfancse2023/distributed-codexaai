#!/usr/bin/env node

/**
 * AKS "Wake-on-Request" Autostart/Autostop Proxy Server
 * 
 * Intercepts incoming API requests, starts the AKS cluster if it is stopped,
 * holds pending requests until the cluster & API gateway are ready,
 * and automatically shuts down the cluster after 5 minutes of inactivity.
 */

const http = require('http');
const https = require('https');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const url = require('url');

// --- 1. Load Environment Variables ---
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    console.log(`Loading env vars from: ${envPath}`);
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    });
  } else {
    console.warn(`Warning: .env file not found at ${envPath}`);
  }
}
loadEnv();

// --- 2. Configuration ---
const CLUSTER_NAME = process.env.AZURE_AKS_CLUSTER || 'codexa-aks';
const RESOURCE_GROUP = process.env.AZURE_RESOURCE_GROUP || 'codexa-rg';
const TARGET_URL = process.env.CODEXA_API_URL || 'https://api.20.204.189.207.sslip.io';
const TARGET_HOST = process.env.CODEXA_API_HOST || 'api.20.204.189.207.sslip.io';
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '8080', 10);
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
const BOOT_TIMEOUT_MS = 6 * 60 * 1000; // 6 minutes timeout for cluster boot + app ready

console.log('====================================================');
console.log('         AKS WAKE-ON-REQUEST PROXY INITIALIZING     ');
console.log('====================================================');
console.log(`Cluster Name:   ${CLUSTER_NAME}`);
console.log(`Resource Group: ${RESOURCE_GROUP}`);
console.log(`Target API:     ${TARGET_URL}`);
console.log(`Target Host:    ${TARGET_HOST}`);
console.log(`Proxy Port:     http://localhost:${PROXY_PORT}`);
console.log('====================================================');

// Parse target URL
const parsedTarget = url.parse(TARGET_URL);

// --- 3. State Management ---
let clusterState = 'UNKNOWN'; // UNKNOWN, RUNNING, STOPPED, STARTING, STOPPING, ERROR
let lastRequestTime = Date.now();
let requestLog = [];
let pendingQueue = [];
let pollingTimer = null;
let idleCheckTimer = null;
let bootStartTime = null;

// Add logs helper
function logMessage(msg) {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] ${msg}`);
}

// Log a request
function logRequest(method, path, status, duration = 0) {
  requestLog.unshift({
    id: Math.random().toString(36).substring(2, 9),
    method,
    path,
    time: new Date().toLocaleTimeString(),
    status,
    duration
  });
  if (requestLog.length > 20) {
    requestLog.pop();
  }
}

// --- 4. Azure Control Functions ---

function executeAzureCommand(args) {
  return new Promise((resolve, reject) => {
    const cmd = `az ${args.join(' ')}`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        logMessage(`Azure Command Failed: ${cmd}. Error: ${stderr || error.message}`);
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// Query cluster state from Azure
async function checkClusterState() {
  try {
    const dataStr = await executeAzureCommand([
      'aks', 'show',
      '--name', CLUSTER_NAME,
      '--resource-group', RESOURCE_GROUP,
      '--query', '"{powerState: powerState, provisioningState: provisioningState}"',
      '-o', 'json'
    ]);
    const data = JSON.parse(dataStr);
    const powerCode = data.powerState ? data.powerState.code : 'Unknown';
    const provState = data.provisioningState;
    
    logMessage(`Checked status: PowerState=${powerCode}, ProvisioningState=${provState}`);
    return { powerState: powerCode, provisioningState: provState };
  } catch (err) {
    logMessage(`Error getting cluster state: ${err.message}`);
    return null;
  }
}

// Check gateway health directly
function checkGatewayHealth() {
  return new Promise((resolve) => {
    const options = {
      hostname: parsedTarget.hostname,
      port: parsedTarget.port || (parsedTarget.protocol === 'https:' ? 443 : 80),
      path: '/actuator/health', // Standard health check
      method: 'GET',
      headers: { host: TARGET_HOST },
      timeout: 3000,
      rejectUnauthorized: false
    };

    const client = parsedTarget.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

// Poll state periodically when transitioning
function startPolling(targetState) {
  if (pollingTimer) clearInterval(pollingTimer);
  logMessage(`Started polling Azure for target state: ${targetState}`);
  
  pollingTimer = setInterval(async () => {
    const status = await checkClusterState();
    if (!status) return;

    if (targetState === 'RUNNING') {
      if (status.powerState === 'Running') {
        // Once VM runs, wait for the actual gateway backend pods to respond to health checks
        logMessage('AKS cluster is running. Checking if API gateway is healthy...');
        const isHealthy = await checkGatewayHealth();
        if (isHealthy) {
          logMessage('API Gateway is healthy! Scaling operations complete.');
          clusterState = 'RUNNING';
          clearInterval(pollingTimer);
          pollingTimer = null;
          bootStartTime = null;
          flushQueue();
          lastRequestTime = Date.now();
        } else {
          logMessage('API Gateway not healthy yet. Continuing to wait...');
          // Check timeout
          if (bootStartTime && Date.now() - bootStartTime > BOOT_TIMEOUT_MS) {
            logMessage('Timeout reached waiting for API Gateway. Flushing queue with failure.');
            clusterState = 'ERROR';
            clearInterval(pollingTimer);
            pollingTimer = null;
            rejectQueue('Gateway timeout during boot.');
          }
        }
      }
    } else if (targetState === 'STOPPED') {
      if (status.powerState === 'Stopped') {
        logMessage('AKS cluster has successfully stopped.');
        clusterState = 'STOPPED';
        clearInterval(pollingTimer);
        pollingTimer = null;
      }
    }
  }, 10000); // Poll every 10 seconds
}

// Trigger AKS Start
async function startCluster() {
  if (clusterState === 'RUNNING' || clusterState === 'STARTING') return;
  
  logMessage('Initiating AKS cluster startup...');
  clusterState = 'STARTING';
  bootStartTime = Date.now();
  
  // Start polling in background
  startPolling('RUNNING');
  
  try {
    await executeAzureCommand([
      'aks', 'start',
      '--name', CLUSTER_NAME,
      '--resource-group', RESOURCE_GROUP,
      '--no-wait' // Start async on Azure side
    ]);
    logMessage('Azure start command sent asynchronously.');
  } catch (err) {
    clusterState = 'ERROR';
    clearInterval(pollingTimer);
    pollingTimer = null;
    rejectQueue(`Failed to start cluster: ${err.message}`);
  }
}

// Trigger AKS Stop
async function stopCluster() {
  if (clusterState === 'STOPPED' || clusterState === 'STOPPING') return;
  
  logMessage('No activity for 5 minutes. Initiating AKS cluster shutdown...');
  clusterState = 'STOPPING';
  
  // Start polling in background
  startPolling('STOPPED');
  
  try {
    await executeAzureCommand([
      'aks', 'stop',
      '--name', CLUSTER_NAME,
      '--resource-group', RESOURCE_GROUP,
      '--no-wait' // Stop async on Azure side
    ]);
    logMessage('Azure stop command sent asynchronously.');
  } catch (err) {
    logMessage(`Failed to stop cluster: ${err.message}`);
    clusterState = 'ERROR';
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

// --- 5. Request Queueing ---

function queueRequest(req, res, startTime) {
  logMessage(`Queueing request: ${req.method} ${req.url}`);
  pendingQueue.push({ req, res, startTime });
  
  // Listen for connection drops to cleanup
  req.on('close', () => {
    const idx = pendingQueue.findIndex(p => p.req === req);
    if (idx !== -1) {
      logMessage(`Client cancelled request while queued: ${req.method} ${req.url}`);
      pendingQueue.splice(idx, 1);
    }
  });
}

function flushQueue() {
  logMessage(`Flushing ${pendingQueue.length} queued requests to backend...`);
  const queueToProcess = [...pendingQueue];
  pendingQueue = [];
  
  queueToProcess.forEach(({ req, res, startTime }) => {
    forwardRequest(req, res, startTime);
  });
}

function rejectQueue(errorMessage) {
  logMessage(`Rejecting ${pendingQueue.length} queued requests due to error: ${errorMessage}`);
  const queueToReject = [...pendingQueue];
  pendingQueue = [];
  
  queueToReject.forEach(({ req, res }) => {
    res.writeHead(504, { 'Content-Type': 'application/json', ...getCorsHeaders(req) });
    res.end(JSON.stringify({
      error: 'Gateway Timeout',
      message: `The proxy failed to wake up the AKS cluster: ${errorMessage}`
    }));
    logRequest(req.method, req.url, 504);
  });
}

// --- 6. Proxy Forwarding ---

function getCorsHeaders(req) {
  return {
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*',
    'Access-Control-Allow-Credentials': 'true'
  };
}

function forwardRequest(clientReq, clientRes, startTime) {
  lastRequestTime = Date.now();
  
  const proxyOptions = {
    hostname: parsedTarget.hostname,
    port: parsedTarget.port || (parsedTarget.protocol === 'https:' ? 443 : 80),
    path: clientReq.url,
    method: clientReq.method,
    headers: {
      ...clientReq.headers,
      host: TARGET_HOST // Override Host header for ingress routing
    },
    rejectUnauthorized: false // Skip TLS cert warnings
  };

  const proxyClient = parsedTarget.protocol === 'https:' ? https : http;
  
  const proxyReq = proxyClient.request(proxyOptions, (proxyRes) => {
    // Copy headers from backend response
    const headers = { ...proxyRes.headers };
    
    // Override CORS to match client request
    headers['Access-Control-Allow-Origin'] = clientReq.headers.origin || '*';
    headers['Access-Control-Allow-Credentials'] = 'true';

    clientRes.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(clientRes);
    
    proxyRes.on('end', () => {
      const duration = Date.now() - startTime;
      logRequest(clientReq.method, clientReq.url, proxyRes.statusCode, duration);
    });
  });

  proxyReq.on('error', (err) => {
    logMessage(`Proxy forwarding error: ${err.message}`);
    clientRes.writeHead(502, { 'Content-Type': 'text/plain', ...getCorsHeaders(clientReq) });
    clientRes.end(`Bad Gateway: Proxy could not forward request to backend. ${err.message}`);
    logRequest(clientReq.method, clientReq.url, 502);
  });

  clientReq.pipe(proxyReq);
}

// --- 7. Status Dashboard UI ---

function getDashboardHtml() {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AKS Standby Proxy Controller</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
      :root {
        --bg-color: #0b0c15;
        --card-bg: rgba(25, 28, 48, 0.45);
        --card-border: rgba(255, 255, 255, 0.08);
        --text-primary: #ffffff;
        --text-secondary: #8c92b0;
        --primary-glow: rgba(99, 102, 241, 0.15);
        
        --color-running: #10b981;
        --color-stopped: #ef4444;
        --color-starting: #f59e0b;
        --color-stopping: #3b82f6;
        --color-error: #ec4899;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: 'Outfit', sans-serif;
        background-color: var(--bg-color);
        color: var(--text-primary);
        min-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow-x: hidden;
        position: relative;
      }

      /* Animated decorative backgrounds */
      body::before {
        content: '';
        position: absolute;
        width: 400px;
        height: 400px;
        background: radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%);
        top: -100px;
        right: -100px;
        z-index: 0;
        pointer-events: none;
      }

      body::after {
        content: '';
        position: absolute;
        width: 500px;
        height: 500px;
        background: radial-gradient(circle, rgba(236, 72, 153, 0.1) 0%, transparent 70%);
        bottom: -200px;
        left: -200px;
        z-index: 0;
        pointer-events: none;
      }

      .container {
        width: 100%;
        max-width: 900px;
        padding: 24px;
        z-index: 10;
      }

      .card {
        background: var(--card-bg);
        border: 1px solid var(--card-border);
        border-radius: 24px;
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        padding: 40px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
        gap: 32px;
      }

      /* Header */
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        padding-bottom: 24px;
      }

      .title-section h1 {
        font-size: 28px;
        font-weight: 800;
        letter-spacing: -0.5px;
        background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .title-section p {
        color: var(--text-secondary);
        font-size: 14px;
        margin-top: 4px;
      }

      /* Status Indicator Panel */
      .status-panel {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 24px;
      }

      @media (max-width: 600px) {
        .status-panel {
          grid-template-columns: 1fr;
        }
      }

      .status-box {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.03);
        border-radius: 16px;
        padding: 24px;
        display: flex;
        align-items: center;
        gap: 20px;
        position: relative;
        overflow: hidden;
      }

      .status-badge-outer {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        position: relative;
      }

      .status-badge-inner {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        position: relative;
        z-index: 2;
      }

      /* Status coloring/pulsing */
      .state-RUNNING .status-badge-inner {
        background: var(--color-running);
        box-shadow: 0 0 20px var(--color-running);
      }
      .state-STOPPED .status-badge-inner {
        background: var(--color-stopped);
        box-shadow: 0 0 20px var(--color-stopped);
      }
      .state-STARTING .status-badge-inner {
        background: var(--color-starting);
        box-shadow: 0 0 20px var(--color-starting);
        animation: pulse 1.5s infinite;
      }
      .state-STOPPING .status-badge-inner {
        background: var(--color-stopping);
        box-shadow: 0 0 20px var(--color-stopping);
        animation: pulse 1.5s infinite;
      }
      .state-ERROR .status-badge-inner {
        background: var(--color-error);
        box-shadow: 0 0 20px var(--color-error);
      }

      @keyframes pulse {
        0% { transform: scale(0.95); opacity: 0.8; }
        50% { transform: scale(1.1); opacity: 1; box-shadow: 0 0 30px inherit; }
        100% { transform: scale(0.95); opacity: 0.8; }
      }

      .status-details {
        display: flex;
        flex-direction: column;
      }

      .status-label {
        font-size: 12px;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .status-value {
        font-size: 24px;
        font-weight: 800;
        margin-top: 4px;
      }

      .timer-box {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.03);
        border-radius: 16px;
        padding: 24px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .timer-value {
        font-size: 36px;
        font-weight: 800;
        color: #a5b4fc;
        font-variant-numeric: tabular-nums;
      }

      /* Control Buttons */
      .controls {
        display: flex;
        gap: 16px;
      }

      .btn {
        flex: 1;
        padding: 16px 24px;
        border-radius: 12px;
        border: none;
        font-family: inherit;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        color: #fff;
      }

      .btn-start {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        box-shadow: 0 4px 15px rgba(16, 185, 129, 0.2);
      }

      .btn-start:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
      }

      .btn-stop {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        box-shadow: 0 4px 15px rgba(239, 68, 68, 0.2);
      }

      .btn-stop:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4);
      }

      .btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
        transform: none !important;
        box-shadow: none !important;
      }

      /* Logs list */
      .logs-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .logs-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: flex;
        justify-content: space-between;
      }

      .logs-list {
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.03);
        border-radius: 12px;
        max-height: 200px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }

      .log-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.02);
        font-size: 13px;
        font-family: monospace;
      }

      .log-row:last-child {
        border-bottom: none;
      }

      .log-left {
        display: flex;
        gap: 12px;
      }

      .log-method {
        font-weight: 800;
      }

      .method-GET { color: #3b82f6; }
      .method-POST { color: #10b981; }
      .method-PUT { color: #f59e0b; }
      .method-DELETE { color: #ef4444; }

      .log-path {
        color: rgba(255, 255, 255, 0.7);
      }

      .log-right {
        display: flex;
        gap: 16px;
        align-items: center;
      }

      .log-status {
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
      }

      .status-2xx { background: rgba(16, 185, 129, 0.15); color: #10b981; }
      .status-3xx { background: rgba(59, 82, 246, 0.15); color: #3b82f6; }
      .status-4xx { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
      .status-5xx { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

      .log-time {
        color: var(--text-secondary);
        font-size: 11px;
      }

      /* Custom scrollbar */
      ::-webkit-scrollbar {
        width: 6px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <!-- Header -->
        <div class="header">
          <div class="title-section">
            <h1>AKS Standby Proxy Controller</h1>
            <p>Target: ${TARGET_HOST}</p>
          </div>
          <div>
            <span style="font-size: 11px; padding: 4px 10px; border-radius: 20px; background: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid rgba(255,255,255,0.05);">Local Daemon</span>
          </div>
        </div>

        <!-- Status Panel -->
        <div class="status-panel">
          <div class="status-box" id="status-container">
            <div class="status-badge-outer">
              <div class="status-badge-inner"></div>
            </div>
            <div class="status-details">
              <span class="status-label">Cluster Power State</span>
              <span class="status-value" id="status-txt">Loading...</span>
            </div>
          </div>
          
          <div class="timer-box">
            <span class="status-label">Auto-Sleep Timer</span>
            <span class="timer-value" id="timer-txt">--:--</span>
          </div>
        </div>

        <!-- Controls -->
        <div class="controls">
          <button class="btn btn-start" id="btn-start" onclick="triggerStart()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            Wake Up Cluster
          </button>
          <button class="btn btn-stop" id="btn-stop" onclick="triggerStop()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect></svg>
            Sleep Cluster
          </button>
        </div>

        <!-- Logs -->
        <div class="logs-section">
          <div class="logs-title">
            <span>Recent Requests Through Proxy</span>
            <span id="queue-size" style="color: #a5b4fc; text-transform: none;">0 queued requests</span>
          </div>
          <div class="logs-list" id="logs-container">
            <div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 13px;">No requests processed yet.</div>
          </div>
        </div>
      </div>
    </div>

    <script>
      async function fetchStatus() {
        try {
          const res = await fetch('/proxy-api/status');
          const data = await res.json();
          
          // Update Status
          const container = document.getElementById('status-container');
          container.className = 'status-box state-' + data.clusterState;
          
          const statusTxt = document.getElementById('status-txt');
          statusTxt.innerText = data.clusterState;
          if (data.clusterState === 'STARTING') {
            statusTxt.innerText = 'Waking Up...';
          } else if (data.clusterState === 'STOPPING') {
            statusTxt.innerText = 'Sleeping...';
          }
          
          // Update Buttons
          const startBtn = document.getElementById('btn-start');
          const stopBtn = document.getElementById('btn-stop');
          
          startBtn.disabled = (data.clusterState === 'RUNNING' || data.clusterState === 'STARTING' || data.clusterState === 'STOPPING');
          stopBtn.disabled = (data.clusterState === 'STOPPED' || data.clusterState === 'STARTING' || data.clusterState === 'STOPPING');
          
          // Update Queue Size
          document.getElementById('queue-size').innerText = data.pendingQueueSize + ' queued requests';

          // Update Timer
          const timerTxt = document.getElementById('timer-txt');
          if (data.clusterState !== 'RUNNING') {
            timerTxt.innerText = '--:--';
          } else if (data.timeRemaining <= 0) {
            timerTxt.innerText = 'Sleeping...';
          } else {
            const mins = Math.floor(data.timeRemaining / 60000);
            const secs = Math.floor((data.timeRemaining % 60000) / 1000);
            timerTxt.innerText = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
          }
          
          // Update Request Log
          const logsContainer = document.getElementById('logs-container');
          if (data.requestLog.length === 0) {
            logsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 13px;">No requests processed yet.</div>';
          } else {
            logsContainer.innerHTML = data.requestLog.map(log => {
              const statusClass = log.status >= 500 ? 'status-5xx' : log.status >= 400 ? 'status-4xx' : log.status >= 300 ? 'status-3xx' : 'status-2xx';
              return \`
                <div class="log-row">
                  <div class="log-left">
                    <span class="log-method method-\${log.method}">\${log.method}</span>
                    <span class="log-path">\${log.path}</span>
                  </div>
                  <div class="log-right">
                    <span class="log-status \${statusClass}">\${log.status}</span>
                    <span style="color: var(--text-secondary); font-size: 11px;">\${log.duration}ms</span>
                    <span class="log-time">\${log.time}</span>
                  </div>
                </div>
              \`;
            }).join('');
          }
          
        } catch (e) {
          console.error("Failed to fetch proxy status:", e);
        }
      }

      async function triggerStart() {
        const startBtn = document.getElementById('btn-start');
        startBtn.disabled = true;
        await fetch('/proxy-api/start', { method: 'POST' });
        fetchStatus();
      }

      async function triggerStop() {
        const stopBtn = document.getElementById('btn-stop');
        stopBtn.disabled = true;
        await fetch('/proxy-api/stop', { method: 'POST' });
        fetchStatus();
      }

      // Poll every 1 second
      setInterval(fetchStatus, 1000);
      fetchStatus();
    </script>
  </body>
  </html>
  `;
}

// --- 8. Core Server Router ---

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const startTime = Date.now();

  // 1. Handle Dashboard UI
  if (parsedUrl.pathname === '/proxy-status') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(getDashboardHtml());
    return;
  }

  // 2. Handle Status APIs
  if (parsedUrl.pathname === '/proxy-api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...getCorsHeaders(req) });
    const timeRemaining = lastRequestTime ? Math.max(0, IDLE_TIMEOUT - (Date.now() - lastRequestTime)) : 0;
    res.end(JSON.stringify({
      clusterState,
      pendingQueueSize: pendingQueue.length,
      timeRemaining,
      requestLog,
      targetUrl: TARGET_URL
    }));
    return;
  }

  // 3. Handle Start/Stop API triggers from the dashboard
  if (parsedUrl.pathname === '/proxy-api/start' && req.method === 'POST') {
    startCluster();
    res.writeHead(200, { 'Content-Type': 'application/json', ...getCorsHeaders(req) });
    res.end(JSON.stringify({ success: true, message: 'Cluster startup initiated.' }));
    return;
  }

  if (parsedUrl.pathname === '/proxy-api/stop' && req.method === 'POST') {
    stopCluster();
    res.writeHead(200, { 'Content-Type': 'application/json', ...getCorsHeaders(req) });
    res.end(JSON.stringify({ success: true, message: 'Cluster shutdown initiated.' }));
    return;
  }

  // Handle CORS OPTIONS requests immediately
  if (req.method === 'OPTIONS') {
    res.writeHead(200, getCorsHeaders(req));
    res.end();
    return;
  }

  // 4. Handle Standard Backend API Proxying
  if (clusterState === 'RUNNING') {
    forwardRequest(req, res, startTime);
  } else {
    // If not running, start it up automatically on the request!
    if (clusterState === 'STOPPED' || clusterState === 'UNKNOWN' || clusterState === 'ERROR') {
      startCluster();
    }
    
    // If browser is trying to visit a web page, redirect them to the status dashboard
    const acceptHeader = req.headers.accept || '';
    if (acceptHeader.includes('text/html') && req.method === 'GET') {
      res.writeHead(302, { 'Location': '/proxy-status' });
      res.end();
      logRequest(req.method, req.url, 302, Date.now() - startTime);
      return;
    }

    // Otherwise (API request like JSON), queue the request and hold the connection open
    queueRequest(req, res, startTime);
  }
});

// --- 9. Idle check and Init ---

function startIdleCheck() {
  if (idleCheckTimer) clearInterval(idleCheckTimer);
  
  idleCheckTimer = setInterval(() => {
    if (clusterState === 'RUNNING') {
      const elapsed = Date.now() - lastRequestTime;
      if (elapsed > IDLE_TIMEOUT) {
        stopCluster();
      }
    }
  }, 30000); // Check every 30 seconds
}

// Initial boot check
async function init() {
  logMessage('Initializing Wake Proxy...');
  
  // Check if we need to authenticate via Service Principal (common in cloud deployments like Render)
  const spClientId = process.env.AZURE_CLIENT_ID;
  const spClientSecret = process.env.AZURE_CLIENT_SECRET;
  const spTenantId = process.env.AZURE_TENANT_ID;
  const spSubscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  
  if (spClientId && spClientSecret && spTenantId) {
    logMessage('Service Principal credentials found. Authenticating with Azure...');
    try {
      await executeAzureCommand([
        'login',
        '--service-principal',
        '-u', spClientId,
        '-p', spClientSecret,
        '--tenant', spTenantId
      ]);
      logMessage('Azure authentication successful.');
      
      if (spSubscriptionId) {
        await executeAzureCommand([
          'account', 'set',
          '--subscription', spSubscriptionId
        ]);
        logMessage(`Azure subscription set to: ${spSubscriptionId}`);
      }
    } catch (err) {
      clusterState = 'ERROR';
      logMessage(`Azure authentication failed: ${err.message}`);
      // Don't exit, let server start so dashboard can show the error
    }
  }

  logMessage('Querying current cluster state on startup...');
  const status = await checkClusterState();
  if (status) {
    if (status.powerState === 'Running') {
      clusterState = 'RUNNING';
      logMessage('AKS cluster is already Running.');
    } else if (status.powerState === 'Stopped') {
      clusterState = 'STOPPED';
      logMessage('AKS cluster is currently Stopped.');
    } else {
      clusterState = 'UNKNOWN';
      logMessage(`AKS cluster powerState code is: ${status.powerState}. Setting to UNKNOWN.`);
    }
  } else {
    clusterState = 'ERROR';
    logMessage('Failed to connect to Azure CLI. Please ensure "az login" has been executed.');
  }
  
  startIdleCheck();
  
  server.listen(PROXY_PORT, () => {
    logMessage(`Proxy listening on: http://localhost:${PROXY_PORT}`);
    logMessage('To view cluster control dashboard, open: http://localhost:8080/proxy-status');
  });
}

init();
