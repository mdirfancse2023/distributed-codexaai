package com.microservice.codexa.ai.common_library.event;

import lombok.Builder;

@Builder
public record FileStoreRequestEvent(
        Long projectId,
        String sagaId,
        String filePath,
        String content,
        Long userId
) {
}
