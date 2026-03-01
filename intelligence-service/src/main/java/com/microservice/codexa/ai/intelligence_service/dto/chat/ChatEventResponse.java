package com.microservice.codexa.ai.intelligence_service.dto.chat;


import com.microservice.codexa.ai.common_library.enums.ChatEventType;

public record ChatEventResponse(
        Long id,
        Integer sequenceOrder,
        ChatEventType type,
        String content,
        String filePath,
        String metadata
) {
}
