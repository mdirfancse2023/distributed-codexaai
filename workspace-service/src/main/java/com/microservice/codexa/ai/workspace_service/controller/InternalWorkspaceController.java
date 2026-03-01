package com.microservice.codexa.ai.workspace_service.controller;

import com.microservice.codexa.ai.common_library.dto.FileTreeDto;
import com.microservice.codexa.ai.common_library.enums.ProjectPermission;
import com.microservice.codexa.ai.workspace_service.service.ProjectFileService;
import com.microservice.codexa.ai.workspace_service.service.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RequiredArgsConstructor
@RequestMapping("/internal/v1/")
@RestController
public class InternalWorkspaceController {
    private final ProjectService projectService;
    private final ProjectFileService projectFileService;

    @GetMapping("/projects/{projectId}/files/tree")
    public FileTreeDto getFileTree(@PathVariable Long projectId) {
        return projectFileService.getFileTree(projectId);
    }

    @GetMapping("/projects/{projectId}/files/content")
    public String getFileContent(@PathVariable Long projectId, @RequestParam String path) {
        return projectFileService.getFileContent(projectId, path);
    }

    @GetMapping("/projects/{projectId}/permissions/check")
    public boolean checkProjectPermission(@PathVariable Long projectId, @RequestParam ProjectPermission permission) {
        return projectService.hasPermission(projectId, permission);
    }
}
