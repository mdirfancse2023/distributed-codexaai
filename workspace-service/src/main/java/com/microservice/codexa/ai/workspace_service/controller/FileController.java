package com.microservice.codexa.ai.workspace_service.controller;

import com.microservice.codexa.ai.workspace_service.dto.project.FileContentResponse;
import com.microservice.codexa.ai.workspace_service.dto.project.FileTreeResponse;
import com.microservice.codexa.ai.workspace_service.service.ProjectFileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{projectId}/files")
@RequiredArgsConstructor
public class FileController {

    private final ProjectFileService projectFileService;

    @GetMapping
    public ResponseEntity<FileTreeResponse> getFileTree(@PathVariable Long projectId){
        return ResponseEntity.ok(projectFileService.getFileTree(projectId));
    }

    @GetMapping("/content") // Catch-all for any file path
    public ResponseEntity<FileContentResponse> getFile(@PathVariable Long projectId, @RequestParam String path){
        return ResponseEntity.ok(projectFileService.getFileContent(projectId, path));

    }

}
