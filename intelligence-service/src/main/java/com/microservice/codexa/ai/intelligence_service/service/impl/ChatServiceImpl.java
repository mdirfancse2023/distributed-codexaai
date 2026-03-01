package com.microservice.codexa.ai.intelligence_service.service.impl;

import com.microservice.codexa.ai.common_library.security.AuthUtil;
import com.microservice.codexa.ai.intelligence_service.dto.chat.ChatResponse;
import com.microservice.codexa.ai.intelligence_service.entity.ChatMessage;
import com.microservice.codexa.ai.intelligence_service.entity.ChatSession;
import com.microservice.codexa.ai.intelligence_service.entity.ChatSessionId;
import com.microservice.codexa.ai.intelligence_service.mapper.ChatMapper;
import com.microservice.codexa.ai.intelligence_service.repository.ChatMessageRepository;
import com.microservice.codexa.ai.intelligence_service.repository.ChatSessionRepository;
import com.microservice.codexa.ai.intelligence_service.service.ChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatServiceImpl implements ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final AuthUtil authUtil;
    private final ChatSessionRepository chatSessionRepository;
    private final ChatMapper chatMapper;

    @Override
    public List<ChatResponse> getProjectChatHistory(Long projectId) {
        Long userId = authUtil.getCurrentUserId();
        ChatSession chatSession = chatSessionRepository.getReferenceById(
                new ChatSessionId(projectId, userId)
        );

        List<ChatMessage> chatMessageList = chatMessageRepository.findByChatSession(chatSession);
        return chatMapper.fromListOfChatMessage(chatMessageList);
    }
}
