package com.microservice.codexa.ai.workspace_service.service.impl;


import com.microservice.codexa.ai.workspace_service.dto.deploy.DeployResponse;
import com.microservice.codexa.ai.workspace_service.service.DeploymentService;
import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.api.model.PodBuilder;
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
            // Step 1: Clean workspace (keep node_modules for cache) and sync project files.
            // The syncer container (minio/mc) lacks grep/xargs/find — use a pure bash for-loop.
            String initialSyncCmd = String.format(
                    "cd /app && for f in $(ls -A); do [ \"$f\" != \"node_modules\" ] && rm -rf \"$f\"; done; mc mirror --overwrite myminio/projects/%d/ /app/",
                    projectId);
            execCommand(podName, "syncer", 60, "sh", "-c", initialSyncCmd);

            // Step 2: Start continuous background sync for live file updates
            String watchCmd = String.format("nohup mc mirror --overwrite --watch myminio/projects/%d/ /app/ > /app/sync.log 2>&1 &", projectId);
            execCommand(podName, "syncer", "sh", "-c", watchCmd);

            // Step 3: Write the dependency auto-detection script to the runner
            String base64Script = "Y29uc3QgZnM9cmVxdWlyZSgnZnMnKSxwYXRoPXJlcXVpcmUoJ3BhdGgnKSxwa2dQYXRoPScvYXBwL3BhY2thZ2UuanNvbic7aWYoIWZzLmV4aXN0c1N5bmMocGtnUGF0aCkpZnMud3JpdGVGaWxlU3luYyhwa2dQYXRoLEpTT04uc3RyaW5naWZ5KHtuYW1lOiJjb2RleGEtYWktcHJvamVjdCIscHJpdmF0ZTp0cnVlLHZlcnNpb246IjAuMC4wIix0eXBlOiJtb2R1bGUiLHNjcmlwdHM6e2Rldjoidml0ZSJ9LGRlcGVuZGVuY2llczp7cmVhY3Q6Il4xOC4zLjEiLCJyZWFjdC1kb20iOiJeMTguMy4xIn0sZGV2RGVwZW5kZW5jaWVzOnt2aXRlOiJeNS40LjE5In19LG51bGwsMikpO2NvbnN0IHBrZz1KU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhwa2dQYXRoLCd1dGY4JykpO3BrZy5kZXBlbmRlbmNpZXM9cGtnLmRlcGVuZGVuY2llc3x8e307Y29uc3QgZmluZEltcG9ydHM9ZD0+e2xldCBpbXBzPW5ldyBTZXQoKTtjb25zdCBsaXN0PWRpcj0+e2lmKCFmcy5leGlzdHNTeW5jKGRpcikpcmV0dXJuO2Zvcihjb25zdCBmIG9mIGZzLnJlYWRkaXJTeW5jKGRpcikpe2NvbnN0IHA9cGF0aC5qb2luKGRpcixmKSxzPWZzLnN0YXRTeW5jKHApO2lmKHMuaXNEaXJlY3RvcnkoKSl7aWYoZiE9PSdub2RlX21vZHVsZXMnJiZmIT09Jy5naXQnKWxpc3QocCl9ZWxzZSBpZigvXC4oanN8anN4fHRzfHRzeCkkLy50ZXN0KGYpKXtjb25zdCBjPWZzLnJlYWRGaWxlU3luYyhwLCd1dGY4Jyk7Zm9yKGNvbnN0IG0gb2YgYy5tYXRjaEFsbCgvKD86aW1wb3J0fGV4cG9ydClccysoPzpbXHcqXHN7fSxdKlxzK2Zyb21ccyspP1snIl0oW14nIi4vXVteJyJdKilbJyJdL2cpKWltcHMuYWRkKG1bMV0pO2Zvcihjb25zdCBtIG9mIGMubWF0Y2hBbGwoL2ltcG9ydFxzKlwoXHMqWyciXShbXiciLi9dW14nIl0qKVsnIl1ccypcKS9nKSlpbXBzLmFkZChtWzFdKX19fTtsaXN0KGQpO3JldHVybiBBcnJheS5mcm9tKGltcHMpfTtjb25zdCBpbXBvcnRzPWZpbmRJbXBvcnRzKCcvYXBwL3NyYycpLGdldEJhc2U9cD0+e2lmKHAuc3RhcnRzV2l0aCgnQC8nKSlyZXR1cm4gbnVsbDtpZihwLnN0YXJ0c1dpdGgoJ0AnKSl7Y29uc3QgcHRzPXAuc3BsaXQoJy8nKTtyZXR1cm4gcHRzLmxlbmd0aD49Mj9wdHMuc2xpY2UoMCwyKS5qb2luKCcvJyk6bnVsbH1yZXR1cm4gcC5zcGxpdCgnLycpWzBdfTtjb25zdCBidWlsdGlucz1uZXcgU2V0KHJlcXVpcmUoJ21vZHVsZScpLmJ1aWx0aW5Nb2R1bGVzKSxhZGRlZD1bXTtmb3IoY29uc3QgaW1wIG9mIGltcG9ydHMpe2NvbnN0IGI9Z2V0QmFzZShpbXApO2lmKGImJiFidWlsdGlucy5oYXMoYikmJiFwa2cuZGVwZW5kZW5jaWVzW2JdJiYhKHBrZy5kZXZEZXBlbmRlbmNpZXMmJnBrZy5kZXZEZXBlbmRlbmNpZXNbYl0pKXtwa2cuZGVwZW5kZW5jaWVzW2JdPSdsYXRlc3QnO2FkZGVkLnB1c2goYil9fWlmKGFkZGVkLmxlbmd0aD4wKXtjb25zb2xlLmxvZygnQWRkaW5nIG1pc3NpbmcgZGVwZW5kZW5jaWVzOicsYWRkZWQpO2ZzLndyaXRlRmlsZVN5bmMocGtnUGF0aCxKU09OLnN0cmluZ2lmeShwa2csbnVsbCwyKSl9ZWxzZXtjb25zb2xlLmxvZygnTm8gbWlzc2luZyBkZXBlbmRlbmNpZXMuJyl9";
            String writeScriptCmd = String.format("echo \"%s\" | base64 -d > /app/auto-dep.js", base64Script);
            execCommand(podName, "runner", "sh", "-c", writeScriptCmd);

            // Step 4: Run auto-dep detection + npm install SYNCHRONOUSLY (wait up to 120s)
            // This MUST complete before Vite starts, otherwise Vite will fail on missing modules.
            String installCmd = "node /app/auto-dep.js && npm install --prefer-offline --no-audit --no-fund";
            execCommand(podName, "runner", 120, "sh", "-c", installCmd);

            // Step 5: Start Vite dev server in background
            String viteCmd = "nohup npm run dev -- --host 0.0.0.0 --port 5173 > /app/dev.log 2>&1 &";
            execCommand(podName, "runner", "sh", "-c", viteCmd);

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

            // Create a new idle pod to maintain the pool
            log.info("Creating new idle runner pod to replace the claimed one...");
            createNewIdlePod();

            // Enforce max pod limit (remove oldest if total >= 10)
            enforceMaxPodLimit();

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
        execCommand(podName, container, 30, command);
    }

    private void execCommand(String podName, String container, int timeoutSeconds, String... command) {
        log.debug("Exec in {}:{} (timeout={}s) -> {}", podName, container, timeoutSeconds, String.join(" ", command));

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
                data.get(timeoutSeconds, TimeUnit.SECONDS);
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

    /**
     * Creates a new idle runner pod using the runner-pool template.
     * This maintains a pool of idle pods ready for preview deployment.
     */
    private void createNewIdlePod() {
        try {
            log.info("Creating new idle runner pod...");
            Pod templatePod = client.pods().inNamespace(namespace)
                    .withLabel(POOL_LABEL, IDLE)
                    .list().getItems().stream()
                    .findFirst()
                    .orElse(null);

            if (templatePod == null) {
                log.warn("No idle template pod found. Cannot create new idle pod. Using Deployment to manage replicas.");
                return;
            }

            // Create a new pod based on the template
            Pod newPod = new io.fabric8.kubernetes.api.model.PodBuilder(templatePod)
                    .editMetadata()
                    .withName(null) // Let Kubernetes generate a unique name
                    .withGenerateName(templatePod.getMetadata().getName() + "-")
                    .endMetadata()
                    .build();

            Pod created = client.pods().inNamespace(namespace).create(newPod);
            log.info("Successfully created new idle runner pod: {}", created.getMetadata().getName());
        } catch (Exception e) {
            log.error("Failed to create new idle runner pod", e);
        }
    }

    /**
     * Enforces the max pod limit (10 total pods).
     * If the total number of runner pods exceeds 10, removes the oldest idle pods first,
     * then oldest busy pods if necessary.
     */
    private void enforceMaxPodLimit() {
        try {
            log.debug("Checking pod limit enforcement...");
            var allPods = client.pods().inNamespace(namespace)
                    .withLabel("app", "runner")
                    .list().getItems();

            int totalPods = allPods.size();
            int MAX_PODS = 10;

            if (totalPods >= MAX_PODS) {
                log.info("Pod limit reached: {} pods. Enforcing max limit of {}...", totalPods, MAX_PODS);

                // Step 1: Remove oldest IDLE pods first
                var idlePods = allPods.stream()
                        .filter(p -> "idle".equals(p.getMetadata().getLabels().get(POOL_LABEL)))
                        .sorted((a, b) -> a.getMetadata().getCreationTimestamp()
                                .compareTo(b.getMetadata().getCreationTimestamp()))
                        .toList();

                int toRemove = totalPods - (MAX_PODS - 1);  // Keep 1 slot free

                for (int i = 0; i < Math.min(toRemove, idlePods.size()); i++) {
                    String podName = idlePods.get(i).getMetadata().getName();
                    try {
                        client.pods().inNamespace(namespace).withName(podName).delete();
                        log.info("Removed old idle pod {} to enforce max limit", podName);
                        toRemove--;
                    } catch (Exception e) {
                        log.error("Failed to delete idle pod {}", podName, e);
                    }
                }

                // Step 2: If still over limit, remove oldest BUSY pods
                if (toRemove > 0) {
                    var busyPods = allPods.stream()
                            .filter(p -> "busy".equals(p.getMetadata().getLabels().get(POOL_LABEL)))
                            .sorted((a, b) -> a.getMetadata().getCreationTimestamp()
                                    .compareTo(b.getMetadata().getCreationTimestamp()))
                            .toList();

                    for (int i = 0; i < Math.min(toRemove, busyPods.size()); i++) {
                        String podName = busyPods.get(i).getMetadata().getName();
                        try {
                            client.pods().inNamespace(namespace).withName(podName).delete();
                            log.info("Removed old busy pod {} to enforce max limit", podName);
                        } catch (Exception e) {
                            log.error("Failed to delete busy pod {}", podName, e);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error enforcing max pod limit", e);
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
