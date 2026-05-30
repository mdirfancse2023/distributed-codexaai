package com.microservice.codexa.ai.workspace_service.config;

import io.fabric8.kubernetes.client.Config;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientBuilder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@Slf4j
public class KubernetesConfig {

    @Bean
    public KubernetesClient kubernetesClient() {
        Config config = Config.autoConfigure(null);
        log.info("K8s Master URL: {}", config.getMasterUrl());
        return new KubernetesClientBuilder()
                .withConfig(config)
                .build();
    }
}
