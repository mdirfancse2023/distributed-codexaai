const http = require('http');
const httpProxy = require('http-proxy');
const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const previewDomain = (process.env.PREVIEW_DOMAIN || '').trim();
const frontendTarget = process.env.FRONTEND_TARGET || 'http://codexa-frontend.codexa-ai.svc.cluster.local:80';
const previewPathPrefix = normalizePathPrefix(process.env.PREVIEW_PATH_PREFIX || '/preview');
const previewCookieName = 'codexa_preview_key';

const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        console.log(`Redis connection failed. Retrying in ${delay}ms...`);
        return delay;
    }
});

redis.on('error', (err) => console.error('Redis Client Error:', err.message));
redis.on('connect', () => console.log(`Connected to Redis successfully at ${redisUrl}`));

const proxy = httpProxy.createProxyServer({
    ws: true,
    xfwd: true,
    changeOrigin: true
});

function normalizePathPrefix(value) {
    if (!value || value === '/') {
        return '/preview';
    }

    const trimmed = value.endsWith('/') ? value.slice(0, -1) : value;
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function parseCookies(cookieHeader = '') {
    return cookieHeader
        .split(';')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .reduce((cookies, entry) => {
            const [key, ...rest] = entry.split('=');
            cookies[key] = decodeURIComponent(rest.join('=') || '');
            return cookies;
        }, {});
}

function sanitizePreviewKey(rawValue) {
    if (!rawValue) return null;

    const decodedValue = decodeURIComponent(rawValue).trim();
    if (!decodedValue) return null;

    return /^[a-zA-Z0-9.-]+$/.test(decodedValue) ? decodedValue : null;
}

function parsePreviewKeyFromPath(pathname) {
    if (!pathname.startsWith(`${previewPathPrefix}/`)) {
        return null;
    }

    const remainder = pathname.slice(previewPathPrefix.length + 1);
    const [candidate] = remainder.split('/');
    return sanitizePreviewKey(candidate);
}

function stripPreviewPrefix(pathname, previewKey) {
    const prefix = `${previewPathPrefix}/${previewKey}`;
    const strippedPath = pathname.slice(prefix.length);

    if (!strippedPath) {
        return '/';
    }

    return strippedPath.startsWith('/') ? strippedPath : `/${strippedPath}`;
}

function parsePreviewKeyFromReferer(referer) {
    if (!referer) return null;

    try {
        const refererUrl = new URL(referer);
        return parsePreviewKeyFromPath(refererUrl.pathname);
    } catch {
        return null;
    }
}

function getPreviewKeyFromCookie(cookieHeader) {
    return sanitizePreviewKey(parseCookies(cookieHeader)[previewCookieName] || '');
}

function isViteAssetPath(pathname) {
    return (
        pathname === '/vite.svg' ||
        pathname.startsWith('/@vite') ||
        pathname.startsWith('/__vite') ||
        pathname.startsWith('/src/') ||
        pathname.startsWith('/node_modules/') ||
        pathname.startsWith('/@id/') ||
        pathname.startsWith('/@fs/')
    );
}

function shouldUseCookiePreview(req, pathname) {
    const fetchDest = (req.headers['sec-fetch-dest'] || '').toLowerCase();
    const isWebSocket = (req.headers.upgrade || '').toLowerCase() === 'websocket';

    return isWebSocket || fetchDest === 'iframe' || isViteAssetPath(pathname);
}

function getProxyPath(pathname, search = '') {
    return `${pathname || '/'}${search || ''}`;
}

function getPreviewHostname(previewKey) {
    if (!previewDomain || previewKey.includes('.')) {
        return previewKey;
    }

    return `${previewKey}.${previewDomain}`;
}

async function getTarget(hostname) {
    try {
        const targetIpOrSvc = await redis.get(`route:${hostname}`);
        return targetIpOrSvc || null;
    } catch (err) {
        console.error('Redis Error:', err);
        return null;
    }
}

async function resolvePreviewTarget(previewKey) {
    const hostname = getPreviewHostname(previewKey);
    return {
        hostname,
        targetIpOrSvc: await getTarget(hostname),
    };
}

function getTargetUrl(target) {
    return target.includes(':') ? `http://${target}` : `http://${target}:5173`;
}

function appendSetCookie(res, cookieValue) {
    const existing = res.getHeader('Set-Cookie');

    if (!existing) {
        res.setHeader('Set-Cookie', cookieValue);
        return;
    }

    if (Array.isArray(existing)) {
        res.setHeader('Set-Cookie', [...existing, cookieValue]);
        return;
    }

    res.setHeader('Set-Cookie', [existing, cookieValue]);
}

function buildPreviewCookie(previewKey, req) {
    const forwardedProto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const parts = [
        `${previewCookieName}=${encodeURIComponent(previewKey)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
    ];

    if (forwardedProto === 'https') {
        parts.push('Secure');
    }

    return parts.join('; ');
}

function resolveRoutingContext(req) {
    const rawHost = req.headers.host || 'localhost';
    const requestUrl = new URL(req.url || '/', `http://${rawHost}`);
    const pathname = requestUrl.pathname || '/';
    const proxyPath = getProxyPath(pathname, requestUrl.search);
    const hostname = rawHost.split(':')[0];

    if (previewDomain && hostname.endsWith(`.${previewDomain}`)) {
        return {
            kind: 'preview-host',
            proxyPath,
            previewHost: hostname,
        };
    }

    const explicitPreviewKey = parsePreviewKeyFromPath(pathname);
    if (explicitPreviewKey) {
        return {
            kind: 'preview-path',
            previewKey: explicitPreviewKey,
            proxyPath: getProxyPath(stripPreviewPrefix(pathname, explicitPreviewKey), requestUrl.search),
            setCookie: true,
        };
    }

    const refererPreviewKey = parsePreviewKeyFromReferer(req.headers.referer || '');
    if (refererPreviewKey) {
        return {
            kind: 'preview-referer',
            previewKey: refererPreviewKey,
            proxyPath,
        };
    }

    const cookiePreviewKey = getPreviewKeyFromCookie(req.headers.cookie || '');
    if (cookiePreviewKey && shouldUseCookiePreview(req, pathname)) {
        return {
            kind: 'preview-cookie',
            previewKey: cookiePreviewKey,
            proxyPath,
        };
    }

    return {
        kind: 'frontend',
        proxyPath,
    };
}

function proxyHttpRequest(req, res, target, proxyPath) {
    const targetUrl = new URL(proxyPath, target).toString();

    proxy.web(req, res, { target: targetUrl, ignorePath: true }, (err) => {
        console.error(`Proxy Error (Web): ${req.headers.host || 'unknown'} -> ${err.message}`);
        if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end('Preview server unavailable or starting...');
        }
    });
}

function proxyWebSocketRequest(req, socket, head, target, proxyPath) {
    const targetUrl = new URL(proxyPath, target).toString();

    proxy.ws(req, socket, head, { target: targetUrl, ignorePath: true }, (err) => {
        console.error(`Proxy Error (WS): ${req.headers.host || 'unknown'} -> ${err.message}`);
        socket.destroy();
    });
}

async function resolveTargetForRequest(req, res) {
    const routingContext = resolveRoutingContext(req);

    if (routingContext.kind === 'frontend') {
        return {
            target: frontendTarget,
            proxyPath: routingContext.proxyPath,
            description: 'frontend',
        };
    }

    if (routingContext.kind === 'preview-host') {
        const targetIpOrSvc = await getTarget(routingContext.previewHost);
        if (!targetIpOrSvc) {
            return null;
        }

        return {
            target: getTargetUrl(targetIpOrSvc),
            proxyPath: routingContext.proxyPath,
            description: routingContext.previewHost,
        };
    }

    const resolvedPreview = await resolvePreviewTarget(routingContext.previewKey);
    if (!resolvedPreview.targetIpOrSvc) {
        return null;
    }

    if (routingContext.setCookie && res) {
        appendSetCookie(res, buildPreviewCookie(routingContext.previewKey, req));
    }

    return {
        target: getTargetUrl(resolvedPreview.targetIpOrSvc),
        proxyPath: routingContext.proxyPath,
        description: resolvedPreview.hostname,
    };
}

const server = http.createServer(async (req, res) => {
    const targetContext = await resolveTargetForRequest(req, res);

    if (!targetContext) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end(`Preview not found or spinning up for ${req.headers.host || 'unknown host'}.`);
    }

    console.log(`HTTP: ${req.headers.host || 'unknown'} -> ${targetContext.description}${targetContext.proxyPath}`);
    proxyHttpRequest(req, res, targetContext.target, targetContext.proxyPath);
});

server.on('upgrade', async (req, socket, head) => {
    const targetContext = await resolveTargetForRequest(req);

    if (!targetContext) {
        socket.destroy();
        return;
    }

    console.log(`WS: ${req.headers.host || 'unknown'} -> ${targetContext.description}${targetContext.proxyPath}`);
    proxyWebSocketRequest(req, socket, head, targetContext.target, targetContext.proxyPath);
});

const PORT = process.env.PORT || 80;
server.listen(PORT, () => console.log(`Codexa proxy listening on port ${PORT}`));
