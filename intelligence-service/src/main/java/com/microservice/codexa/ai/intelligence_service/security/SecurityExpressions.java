package com.microservice.codexa.ai.intelligence_service.security;


import com.microservice.codexa.ai.common_library.enums.ProjectPermission;
import com.microservice.codexa.ai.common_library.security.AuthUtil;
import com.microservice.codexa.ai.intelligence_service.client.WorkspaceClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component("security")
@RequiredArgsConstructor
public class SecurityExpressions {
    private final AuthUtil authUtil;
    private final WorkspaceClient workspaceClient;

    public boolean hasPermission(Long projectId, ProjectPermission projectPermission){
      return workspaceClient.checkPermission(projectId, projectPermission);
    }

    public boolean canViewProject(Long projectId){
        return hasPermission(projectId, ProjectPermission.VIEW);
    }

    public boolean canEditProject(Long projectId){
        return hasPermission(projectId, ProjectPermission.EDIT);
    }

    public boolean canDeleteProject(Long projectId){
        return hasPermission(projectId, ProjectPermission.DELETE);
    }

    public boolean canViewMembers(Long projectId){
        return hasPermission(projectId, ProjectPermission.VIEW_MEMBERS);
    }

    public boolean canManageMembers(Long projectId){
        return hasPermission(projectId, ProjectPermission.MANAGE_MEMBERS);
    }
}
