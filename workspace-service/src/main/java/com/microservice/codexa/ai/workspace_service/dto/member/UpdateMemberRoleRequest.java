package com.microservice.codexa.ai.workspace_service.dto.member;


import com.microservice.codexa.ai.common_library.enums.ProjectRole;
import jakarta.validation.constraints.NotNull;

//To be updated
public record UpdateMemberRoleRequest(@NotNull ProjectRole role) {
}
