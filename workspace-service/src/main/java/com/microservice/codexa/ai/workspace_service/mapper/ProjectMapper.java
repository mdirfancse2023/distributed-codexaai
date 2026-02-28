package com.microservice.codexa.ai.workspace_service.mapper;

import com.microservice.codexa.ai.common_library.enums.ProjectRole;
import com.microservice.codexa.ai.workspace_service.dto.project.ProjectResponse;
import com.microservice.codexa.ai.workspace_service.dto.project.ProjectSummaryResponse;
import com.microservice.codexa.ai.workspace_service.entity.Project;
import org.mapstruct.Mapper;

import java.util.List;

@Mapper(componentModel = "spring")
public interface ProjectMapper {
    ProjectResponse toProjectResponse(Project project);

    //@Mapping(source="name", target="projectName")
    //@Mapping(target="createdAt", dateFormat = "yyyy-MM-dd")
    ProjectSummaryResponse toProjectSummaryResponse(Project project, ProjectRole role);
    List<ProjectSummaryResponse> toListOfProjectSummaryResponses(List<Project> projects);
}
