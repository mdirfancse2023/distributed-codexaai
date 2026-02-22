package com.microservice.codexa.ai.account_service.dto.subscription;

public record UsageTodayResponse(Integer tokensUsed, Integer tokenLimit, Integer previewsRunning, Integer previewLimit) {
}
