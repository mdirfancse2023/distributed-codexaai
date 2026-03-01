package com.microservice.codexa.ai.workspace_service.dto.member;



import com.microservice.codexa.ai.common_library.enums.ProjectRole;

import java.time.Instant;

public record MemberResponse(Long userId, String username, String name, ProjectRole projectRole, Instant invitedAt) {
}
