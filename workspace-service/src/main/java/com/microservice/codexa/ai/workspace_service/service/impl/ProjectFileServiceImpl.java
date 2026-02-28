package com.microservice.codexa.ai.workspace_service.service.impl;


import com.microservice.codexa.ai.common_library.error.ResourceNotFoundException;
import com.microservice.codexa.ai.workspace_service.dto.project.FileContentResponse;
import com.microservice.codexa.ai.workspace_service.dto.project.FileNode;
import com.microservice.codexa.ai.workspace_service.dto.project.FileTreeResponse;
import com.microservice.codexa.ai.workspace_service.entity.Project;
import com.microservice.codexa.ai.workspace_service.entity.ProjectFile;
import com.microservice.codexa.ai.workspace_service.mapper.ProjectFileMapper;
import com.microservice.codexa.ai.workspace_service.repository.ProjectFileRepository;
import com.microservice.codexa.ai.workspace_service.repository.ProjectRepository;
import com.microservice.codexa.ai.workspace_service.service.ProjectFileService;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class ProjectFileServiceImpl implements ProjectFileService {

    private final ProjectRepository projectRepository;
    private final ProjectFileRepository projectFileRepository;
    private final MinioClient minioClient;
    private final ProjectFileMapper projectFileMapper;

    @Value("${minio.project-bucket}")
    private String BUCKET_NAME;

    @Override
    public FileTreeResponse getFileTree(Long projectId) {
        List<ProjectFile> projectFileList = projectFileRepository.findByProjectId(projectId);
        List<FileNode> projectFileNodes =  projectFileMapper.toListOfFileNode(projectFileList);
        return new FileTreeResponse(projectFileNodes);
    }

    @Override
    public FileContentResponse getFileContent(Long projectId, String path) {
        String objectName = projectId + "/" + path;
        try{
            InputStream is = minioClient.getObject(
                    GetObjectArgs.builder()
                            .bucket(BUCKET_NAME)
                            .object(objectName)
                            .build()
            );
            String content = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            return new FileContentResponse(path, content);
        } catch(Exception e){
            throw new RuntimeException("Failed to read file contents", e);
        }
    }

    @Override
    public void saveFile(Long projectId, String path, String content) {
        Project project = projectRepository.findById(projectId).orElseThrow(
                () -> new ResourceNotFoundException("Project", projectId.toString())
        );
        String cleanPath = path.startsWith("/") ? path.substring(1) : path;
        String objectKey = projectId+ "/" + cleanPath;

        try{
           byte[] contentBytes = content.getBytes(StandardCharsets.UTF_8);
           InputStream inputStream = new ByteArrayInputStream(contentBytes);

           // Upload file to MinIO
           minioClient.putObject(
                   PutObjectArgs.builder()
                            .bucket(BUCKET_NAME)
                            .object(objectKey)
                            .stream(inputStream, contentBytes.length, -1)
                            .contentType(determineContentType(path))
                            .build()
           );

           // Save or update ProjectFile metadata
           ProjectFile file = projectFileRepository.findByProjectIdAndPath(projectId, cleanPath)
                   .orElseGet(()-> ProjectFile.builder()
                   .project(project)
                   .path(cleanPath)
                   .minioObjectKey(objectKey) //Will be set only for new files
                   .createdAt(Instant.now())
                   .build()
           );

           file.setUpdatedAt(Instant.now());
           projectFileRepository.save(file);
           log.info("Saved file: {}", objectKey);
        }catch(Exception e){
            log.error("Failed to save file: {}/{}", projectId, cleanPath, e);
            throw new RuntimeException("Failed to save file to storage", e);
        }
    }

    private String determineContentType(String path){
        String type = URLConnection.guessContentTypeFromName(path);
        if(type != null) return type;
        if(path.endsWith(".jsx") || path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".js")) return "text/javascript";
        if(path.endsWith(".css")) return "text/css";
        if(path.endsWith(".html")) return "text/html";
        if(path.endsWith(".json")) return "application/json";
        return "text/plain";
    }
}
