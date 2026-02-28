package com.microservice.codexa.ai.workspace_service.service.impl;

import com.microservice.codexa.ai.common_library.error.ResourceNotFoundException;
import com.microservice.codexa.ai.workspace_service.entity.Project;
import com.microservice.codexa.ai.workspace_service.entity.ProjectFile;
import com.microservice.codexa.ai.workspace_service.repository.ProjectFileRepository;
import com.microservice.codexa.ai.workspace_service.repository.ProjectRepository;
import com.microservice.codexa.ai.workspace_service.service.ProjectTemplateService;
import io.minio.*;
import io.minio.messages.Item;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@RequiredArgsConstructor
@Slf4j
@Service
//@Data
public class ProjectTemplateServiceImpl implements ProjectTemplateService {

    private final MinioClient minioClient;
    private final ProjectFileRepository projectFileRepository;
    private final ProjectRepository projectRepository;

    private static final String TEMPLATE_BUCKET = "starter-projects";
    private static final String TARGET_BUCKET = "projects";
    private static final String TEMPLATE_NAME = "react-vite-tailwind-daisyui-starter";

    @Override
    public void initializeProjectFromTemplate(Long projectId) {
        Project project = projectRepository.findById(projectId).orElseThrow(
                () -> new ResourceNotFoundException("Project not found with id: " , projectId.toString())
        );

        // Logic to copy files from TEMPLATE_BUCKET/TEMPLATE_NAME to TARGET_BUCKET/projectId
        try{
            Iterable<Result<Item>> results = minioClient.listObjects(
                    ListObjectsArgs.builder()
                            .bucket(TEMPLATE_BUCKET)
                            .prefix(TEMPLATE_NAME + "/")
                            .recursive(true) // List all files recursively means include files in subdirectories
                            .build()
            );

            List<ProjectFile> fileToSave = new ArrayList<>(); // for metadata saving in postgres

            for(Result<Item> result: results){
                Item item = result.get();
                String sourceKey = item.objectName();

                String cleanPath = sourceKey.replaceFirst(TEMPLATE_NAME+"/", "");
                String destKey = projectId + "/" + cleanPath;

                minioClient.copyObject(
                        CopyObjectArgs.builder()
                                .bucket(TARGET_BUCKET)
                                .object(destKey)
                                .source(
                                        CopySource.builder()
                                                .bucket(TEMPLATE_BUCKET)
                                                .object(sourceKey)
                                                .build()
                                )
                                .build()
                );

                ProjectFile pf = ProjectFile.builder()
                        .project(project)
                        .path(cleanPath)
                        .minioObjectKey(destKey)
                        .createdAt(Instant.now())
                        .updatedAt(Instant.now())
                        .build();

                fileToSave.add(pf);
            }
            projectFileRepository.saveAll(fileToSave);
        }catch(Exception e){
            throw new RuntimeException("Failed to initialize project from template: " + e.getMessage(), e);
        }
    }
}
