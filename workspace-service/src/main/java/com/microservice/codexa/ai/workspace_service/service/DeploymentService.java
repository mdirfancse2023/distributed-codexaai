package com.microservice.codexa.ai.workspace_service.service;


import com.microservice.codexa.ai.workspace_service.dto.deploy.DeployResponse;

public interface DeploymentService {
    DeployResponse deploy(Long projectId);
}
