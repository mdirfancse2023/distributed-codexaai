package com.microservice.codexa.ai.workspace_service.dto.member;


import com.microservice.codexa.ai.common_library.enums.ProjectRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record InviteMemberRequest(@Email @NotBlank String username, @NotNull ProjectRole role) {
}
