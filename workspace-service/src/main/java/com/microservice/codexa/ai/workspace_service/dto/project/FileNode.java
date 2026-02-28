package com.microservice.codexa.ai.workspace_service.dto.project;

public record FileNode(String path) {
    @Override
    public String toString(){
        return path;
    }
}
