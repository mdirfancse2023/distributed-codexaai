package com.microservice.codexa.ai.workspace_service.service;


import com.microservice.codexa.ai.common_library.dto.FileTreeDto;
import com.microservice.codexa.ai.workspace_service.dto.project.FileContentResponse;

public interface ProjectFileService {
    FileTreeDto getFileTree(Long projectId);

    String getFileContent(Long projectId, String path);

    void saveFile(Long projectId, String filePath, String fileContent);
}
