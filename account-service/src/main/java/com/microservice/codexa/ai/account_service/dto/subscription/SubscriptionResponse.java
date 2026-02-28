package com.microservice.codexa.ai.account_service.dto.subscription;

import com.microservice.codexa.ai.common_library.dto.PlanDto;

import java.time.Instant;

public record SubscriptionResponse(PlanDto plan, String status, Instant currentPeriodEnd, Long tokensUsedThisCycle) {
}
