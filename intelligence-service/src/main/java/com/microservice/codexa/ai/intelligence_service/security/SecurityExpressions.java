package com.microservice.codexa.ai.intelligence_service.security;


import com.microservice.codexa.ai.common_library.enums.ProjectPermission;
import com.microservice.codexa.ai.common_library.security.AuthUtil;
import com.microservice.codexa.ai.intelligence_service.client.WorkspaceClient;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.security.authentication.CredentialsExpiredException;
import org.springframework.stereotype.Component;

@Component("security")
@RequiredArgsConstructor
@Slf4j
public class SecurityExpressions {
    private final AuthUtil authUtil;
    private final WorkspaceClient workspaceClient;

    public boolean hasPermission(Long projectId, ProjectPermission projectPermission){
      try{
          return workspaceClient.checkPermission(projectId, projectPermission);
      }catch(FeignException.Unauthorized e){
          log.warn("Unauthorized access when checking permission for projectId: {}", projectId);
          throw new CredentialsExpiredException("User credentials are expired or invalid. Please log in again.");
      }catch(FeignException e){
          log.error("Workspace service is unavailable when checking permission for projectId: {}", e.getMessage());
          return false;
      }
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
