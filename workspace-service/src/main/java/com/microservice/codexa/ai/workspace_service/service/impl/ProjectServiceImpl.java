package com.microservice.codexa.ai.workspace_service.service.impl;

import com.microservice.codexa.ai.common_library.dto.PlanDto;
import com.microservice.codexa.ai.common_library.enums.ProjectPermission;
import com.microservice.codexa.ai.common_library.enums.ProjectRole;
import com.microservice.codexa.ai.common_library.error.BadRequestException;
import com.microservice.codexa.ai.common_library.error.ResourceNotFoundException;
import com.microservice.codexa.ai.common_library.security.AuthUtil;
import com.microservice.codexa.ai.workspace_service.client.AccountClient;
import com.microservice.codexa.ai.workspace_service.dto.project.ProjectRequest;
import com.microservice.codexa.ai.workspace_service.dto.project.ProjectResponse;
import com.microservice.codexa.ai.workspace_service.dto.project.ProjectSummaryResponse;
import com.microservice.codexa.ai.workspace_service.entity.Project;
import com.microservice.codexa.ai.workspace_service.entity.ProjectMember;
import com.microservice.codexa.ai.workspace_service.entity.ProjectMemberId;
import com.microservice.codexa.ai.workspace_service.mapper.ProjectMapper;
import com.microservice.codexa.ai.workspace_service.repository.ProjectMemberRepository;
import com.microservice.codexa.ai.workspace_service.repository.ProjectRepository;
import com.microservice.codexa.ai.workspace_service.security.SecurityExpressions;
import com.microservice.codexa.ai.workspace_service.service.ProjectService;
import com.microservice.codexa.ai.workspace_service.service.ProjectTemplateService;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@FieldDefaults(makeFinal = true, level = AccessLevel.PRIVATE)
@Transactional // Ensures that all public methods are transactional
public class ProjectServiceImpl implements ProjectService {

    ProjectRepository projectRepository;
    ProjectMapper projectMapper;
    ProjectMemberRepository projectMemberRepository;
    AuthUtil authUtil;
    ProjectTemplateService projectTemplateService;
    AccountClient accountClient;
    SecurityExpressions securityExpressions;

    @Override
    public List<ProjectSummaryResponse> getUserProjects() {
        Long userId = authUtil.getCurrentUserId();
        var projectsWithRole = projectRepository.findAllAccessibleByUser(userId);
        return projectsWithRole.stream()
                .map(p->projectMapper.toProjectSummaryResponse(p.getProject(), p.getRole()))
                .toList();
    }

    @Override
    @PreAuthorize("@security.canViewProject(#projectId)") //Spring expression language
    public ProjectSummaryResponse getUserProjectById(Long projectId) {
        Long userId = authUtil.getCurrentUserId();
        Project project = getAccessibleProjectById(projectId, userId);
        var projectWithRole = projectRepository.findAccessibleProjectByIdWithRole(projectId, userId)
                .orElseThrow(() -> new BadRequestException("Project Not Found"));
        return projectMapper.toProjectSummaryResponse(projectWithRole.getProject(), projectWithRole.getRole());
    }

    @Override
    public ProjectResponse createProject(ProjectRequest request) {
        if(!canCreateProject()){
            throw new BadRequestException("Project creation limit reached for your current subscription plan. Please upgrade your plan to create more projects.");
        }

        Long ownerUserId = authUtil.getCurrentUserId();


        Project project = Project.builder()
                .name(request.name())
                .isPublic(false)
                .build();

        project = projectRepository.save(project);
        ProjectMemberId projectMemberId= new ProjectMemberId(project.getId(), ownerUserId);
        ProjectMember projectMember = ProjectMember.builder()
                .id(projectMemberId)
                .projectRole(ProjectRole.OWNER)
                .acceptedAt(Instant.now())
                .invitedAt(Instant.now())
                .project(project)
                .build();
        projectMemberRepository.save(projectMember);
        projectTemplateService.initializeProjectFromTemplate(project.getId());
        return projectMapper.toProjectResponse(project);
    }

    @Override
    @PreAuthorize("@security.canEditProject(#projectId)")
    public ProjectResponse updateProject(Long projectId, ProjectRequest request) {
        Long userId = authUtil.getCurrentUserId();
        Project project = getAccessibleProjectById(projectId, userId);

        project.setName(request.name());
        project = projectRepository.save(project); //Not required updating is managed by JPA within a transaction
        return projectMapper.toProjectResponse(project);
    }

    @Override
    @PreAuthorize("@security.canDeleteProject(#projectId)")
    public void softDelete(Long projectId) {
        Long userId = authUtil.getCurrentUserId();
        Project project = getAccessibleProjectById(projectId, userId);

        project.setDeletedAt(Instant.now());
        projectRepository.save(project);
    }

    @Override
    public boolean hasPermission(Long projectId, ProjectPermission permission) {
        return securityExpressions.hasPermission(projectId, permission);
    }

    // Internal functions
    public Project getAccessibleProjectById(Long projectId, Long userId) {
        return projectRepository.findAccessibleProjectById(projectId, userId).orElseThrow(() -> new ResourceNotFoundException("Project", projectId.toString()));
    }

    private boolean canCreateProject(){
        Long userId = authUtil.getCurrentUserId();
        if(userId == null){
            return false;
        }
        PlanDto plan = accountClient.getCurrentSubscribedPlanByUser();
        int maxAllowed = plan.maxProjects();
        //int maxAllowed = 10;
        int ownedCount = projectMemberRepository.countProjectOwnedByUser(userId);
        return ownedCount < maxAllowed;
    }
}
