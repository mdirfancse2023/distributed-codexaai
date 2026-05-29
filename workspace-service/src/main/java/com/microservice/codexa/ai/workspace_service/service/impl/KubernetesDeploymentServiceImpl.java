package com.microservice.codexa.ai.workspace_service.service.impl;


import com.microservice.codexa.ai.workspace_service.dto.deploy.DeployResponse;
import com.microservice.codexa.ai.workspace_service.service.DeploymentService;
import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.dsl.ExecListener;
import io.fabric8.kubernetes.client.dsl.ExecWatch;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class KubernetesDeploymentServiceImpl implements DeploymentService {

    private final KubernetesClient client;
    private final StringRedisTemplate redisTemplate;

    @Value("${app.preview.namespace:${PREVIEW_NAMESPACE}}")
    private String namespace;

    @Value("${app.preview.domain:${PREVIEW_DOMAIN}}")
    private String baseDomain;

    @Value("${app.frontend.url:${APP_FRONTEND_URL}}")
    private String frontendUrl;

    @Value("${app.preview.path-prefix:${PREVIEW_PATH_PREFIX:/preview}}")
    private String previewPathPrefix;

    private static final String POOL_LABEL = "status";
    private static final String PROJECT_LABEL = "project-id";
    private static final String IDLE = "idle";
    private static final String BUSY = "busy";

    public DeployResponse deploy(Long projectId) {
        String previewKey = "project-" + projectId;
        String domain = previewKey + "." + baseDomain;
        String formattedUrl = buildPreviewUrl(previewKey);

        Pod existingPod = findActivePod(projectId);

        if (existingPod != null) {
            log.info("Found existing pod {} for project {}. Resuming...", existingPod.getMetadata().getName(), projectId);
            registerRoute(domain, existingPod);
            return new DeployResponse(formattedUrl);
        }

        return claimAndStartNewPod(projectId, domain, formattedUrl);
    }

    private String buildPreviewUrl(String previewKey) {
        String normalizedPrefix = previewPathPrefix.startsWith("/")
                ? previewPathPrefix
                : "/" + previewPathPrefix;
        String normalizedFrontendUrl = frontendUrl.endsWith("/")
                ? frontendUrl.substring(0, frontendUrl.length() - 1)
                : frontendUrl;

        return normalizedFrontendUrl + normalizedPrefix + "/" + previewKey + "/";
    }

    private Pod findActivePod(Long projectId) {
        return client.pods().inNamespace(namespace)
                .withLabel(PROJECT_LABEL, projectId.toString())
                .withLabel(POOL_LABEL, BUSY)
                .list().getItems().stream()
                .filter(pod -> pod.getStatus().getPhase().equals("Running"))
                .findFirst()
                .orElse(null);
    }

    private DeployResponse claimAndStartNewPod(Long projectId, String domain, String formattedUrl) {
        Pod pod = client.pods().inNamespace(namespace)
                .withLabel(POOL_LABEL, IDLE)
                .list().getItems().stream()
                .filter(p -> p.getStatus() != null && "Running".equals(p.getStatus().getPhase()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("No idle runners available. Please scale up the runner-pool."));

        String podName = pod.getMetadata().getName();
        log.info("Claiming pod {} for project {}", podName, projectId);

        client.pods().inNamespace(namespace).withName(podName).edit(p -> {
            p.getMetadata().getLabels().put(POOL_LABEL, BUSY);
            p.getMetadata().getLabels().put(PROJECT_LABEL, projectId.toString());
            return p;
        });

        try {
            String initialSyncCmd = String.format("rm -rf /app/* && mc mirror --overwrite myminio/projects/%d/ /app/", projectId);
            execCommand(podName, "syncer", "sh", "-c", initialSyncCmd);

            String watchCmd = String.format("nohup mc mirror --overwrite --watch myminio/projects/%d/ /app/ > /app/sync.log 2>&1 &", projectId);
            execCommand(podName, "syncer", "sh", "-c", watchCmd);

            String startCmd = "npm install && nohup npm run dev -- --host 0.0.0.0 --port 5173 > /app/dev.log 2>&1 &";
            execCommand(podName, "runner", "sh", "-c", startCmd);

            log.info("Waiting for Vite dev server to start on port 5173 inside pod {}...", podName);
            boolean serverReady = false;
            for (int i = 0; i < 60; i++) {
                if (isPortOpen(podName, "runner", 5173)) {
                    serverReady = true;
                    log.info("Vite dev server started successfully on port 5173 inside pod {} after {} attempts", podName, i + 1);
                    break;
                }
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Interrupted while waiting for Vite dev server startup", ie);
                }
            }

            if (!serverReady) {
                try {
                    ByteArrayOutputStream devLogOut = new ByteArrayOutputStream();
                    client.pods().inNamespace(namespace).withName(podName)
                            .inContainer("runner")
                            .writingOutput(devLogOut)
                            .exec("tail", "-n", "20", "/app/dev.log");
                    log.error("Vite startup failed. Last 20 lines of dev.log:\n{}", devLogOut.toString());
                } catch (Exception ignored) {}
                throw new RuntimeException("Vite dev server failed to start on port 5173 within 60 seconds.");
            }

            Pod updatedPod = client.pods().inNamespace(namespace).withName(podName).get();
            registerRoute(domain, updatedPod);

            log.info("Deployment successful: {}", formattedUrl);
            return new DeployResponse(formattedUrl);

        } catch (Exception e) {
            log.error("Deployment failed for project {}. Releasing pod {}.", projectId, podName, e);
            client.pods().inNamespace(namespace).withName(podName).delete();
            throw new RuntimeException("Failed to deploy project " + projectId + ": " + e.getMessage(), e);
        }
    }

    private void registerRoute(String domain, Pod pod) {
        String podIp = pod.getStatus().getPodIP();
        if (podIp == null) throw new RuntimeException("Pod is running but has no IP!");

        redisTemplate.opsForValue().set("route:" + domain, podIp + ":5173", 1, TimeUnit.HOURS);
        log.info("Route Registered: {} -> {}", domain, podIp);
    }

    private void execCommand(String podName, String container, String... command) {
        log.debug("Exec in {}:{} -> {}", podName, container, String.join(" ", command));

        CompletableFuture<String> data = new CompletableFuture<>();
        try (ExecWatch ignored = client.pods().inNamespace(namespace).withName(podName)
                .inContainer(container)
                .writingOutput(new ByteArrayOutputStream())
                .writingError(new ByteArrayOutputStream())
                .usingListener(new ExecListener() {
                    @Override
                    public void onClose(int code, String reason) {
                        data.complete("Done");
                    }
                })
                .exec(command)) {

            if (command[command.length - 1].trim().endsWith("&")) {
                Thread.sleep(500);
            } else {
                data.get(30, TimeUnit.SECONDS);
            }

        } catch (Exception e) {
            log.error("Exec failed", e);
            throw new RuntimeException("Pod Execution Failed", e);
        }
    }

    private boolean isPortOpen(String podName, String container, int port) {
        CompletableFuture<Integer> exitCodeFuture = new CompletableFuture<>();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ByteArrayOutputStream err = new ByteArrayOutputStream();

        String checkCmd = String.format("node -e \"const net = require('net'); const conn = net.createConnection(%d, 'localhost', () => { conn.end(); process.exit(0); }).on('error', () => process.exit(1));\"", port);

        try (ExecWatch watch = client.pods().inNamespace(namespace).withName(podName)
                .inContainer(container)
                .writingOutput(out)
                .writingError(err)
                .usingListener(new ExecListener() {
                    @Override
                    public void onClose(int code, String reason) {
                        exitCodeFuture.complete(code);
                    }
                })
                .exec("sh", "-c", checkCmd)) {

            Integer exitCode = exitCodeFuture.get(5, TimeUnit.SECONDS);
            return exitCode != null && exitCode == 0;
        } catch (Exception e) {
            log.debug("Port check exec failed or timed out: {}", e.getMessage());
            return false;
        }
    }

    @Scheduled(fixedDelay = 5, timeUnit = TimeUnit.MINUTES)
    public void cleanupIdlePods() {
        log.debug("Starting idle runner pods cleanup check...");
        try {
            client.pods().inNamespace(namespace)
                    .withLabel(POOL_LABEL, BUSY)
                    .list().getItems().forEach(pod -> {
                        String podName = pod.getMetadata().getName();
                        String projectIdStr = pod.getMetadata().getLabels().get(PROJECT_LABEL);
                        if (projectIdStr == null) return;

                        String domain = "project-" + projectIdStr + "." + baseDomain;
                        String redisKey = "route:" + domain;

                        Boolean hasRoute = redisTemplate.hasKey(redisKey);
                        if (hasRoute == null || !hasRoute) {
                            log.info("Runner pod {} (project {}) has been idle for 1 hour (Redis route key expired). Deleting pod...", podName, projectIdStr);
                            try {
                                client.pods().inNamespace(namespace).withName(podName).delete();
                                log.info("Successfully deleted idle runner pod {}", podName);
                            } catch (Exception e) {
                                log.error("Failed to delete idle runner pod {}", podName, e);
                            }
                        }
                    });
        } catch (Exception e) {
            log.error("Error during idle runner pods cleanup check", e);
        }
    }
}
