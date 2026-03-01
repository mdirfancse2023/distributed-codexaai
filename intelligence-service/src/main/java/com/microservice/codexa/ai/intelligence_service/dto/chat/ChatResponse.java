package com.microservice.codexa.ai.intelligence_service.dto.chat;

import com.microservice.codexa.ai.common_library.enums.MessageRole;

import java.time.Instant;
import java.util.List;

public record ChatResponse(
        Long id,
        String content,
        String toolCalls,
        Integer tokensUsed,
        Instant createdAt,
        MessageRole role,
        List<ChatEventResponse>events
) {
}
