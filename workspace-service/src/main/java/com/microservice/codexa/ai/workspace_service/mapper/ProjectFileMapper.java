package com.microservice.codexa.ai.workspace_service.mapper;


import com.microservice.codexa.ai.common_library.dto.FileNode;
import com.microservice.codexa.ai.workspace_service.entity.ProjectFile;
import org.mapstruct.Mapper;

import java.util.List;

@Mapper(componentModel = "spring")
public interface ProjectFileMapper {
    List<FileNode> toListOfFileNode(List<ProjectFile> projectFileList);
}
