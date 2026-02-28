package com.microservice.codexa.ai.workspace_service.dto.project;



import com.microservice.codexa.ai.common_library.enums.ProjectRole;

import java.time.Instant;

public record ProjectSummaryResponse(Long id, String name, Instant createdAt, Instant updatedAt, ProjectRole role) {
}
