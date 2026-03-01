package com.microservice.codexa.ai.intelligence_service.service;


import com.microservice.codexa.ai.intelligence_service.dto.chat.ChatResponse;

import java.util.List;

public interface ChatService {
    List<ChatResponse> getProjectChatHistory(Long projectId);
}
