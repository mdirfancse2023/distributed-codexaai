package com.microservice.codexa.ai.workspace_service.config;

import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.client.KubernetesClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Configuration
@EnableScheduling
@RequiredArgsConstructor
@Slf4j
public class PreviewCleanupScheduler {

    private final KubernetesClient client;

    @Value("${app.preview.namespace:${PREVIEW_NAMESPACE}}")
    private String namespace;

    // Run every 30 minutes
    @Scheduled(fixedDelay = 1800000)
    public void cleanupOrphanedPreviewPods() {
        log.info("Starting scheduled cleanup of orphaned preview pods...");
        try {
            List<Pod> pods = client.pods().inNamespace(namespace)
                    .withLabel("status", "busy")
                    .list().getItems();

            Instant cutoff = Instant.now().minus(6, ChronoUnit.HOURS);

            for (Pod pod : pods) {
                String creationTimestampStr = pod.getMetadata().getCreationTimestamp();
                if (creationTimestampStr != null) {
                    Instant creationTime = Instant.parse(creationTimestampStr);
                    if (creationTime.isBefore(cutoff)) {
                        String name = pod.getMetadata().getName();
                        log.info("Deleting orphaned preview pod {} (created at {})", name, creationTime);
                        client.pods().inNamespace(namespace).withName(name).delete();
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to clean up preview pods", e);
        }
    }
}
