package com.microservice.codexa.ai.common_library.dto;

public record PlanDto(
        Long id,
        String name,
        Integer maxProjects,
        Integer maxTokensPerDay,
        Boolean unlimtedAi,
        String price
) {
}
