package com.microservice.codexa.ai.account_service.dto.subscription;

public record PlanResponse(
        Long id,
        String name,
        String stripePriceId,
        Integer maxProjects,
        Integer maxTokensPerDay,
        Boolean unlimitedAi, //Unlimited access to AI features
        Boolean active
) {
}
