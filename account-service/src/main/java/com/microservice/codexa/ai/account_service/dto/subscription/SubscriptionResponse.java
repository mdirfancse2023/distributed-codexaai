package com.microservice.codexa.ai.account_service.dto.subscription;

import java.time.Instant;

public record SubscriptionResponse(PlanResponse plan, String status, Instant currentPeriodEnd, Long tokensUsedThisCycle) {
}
