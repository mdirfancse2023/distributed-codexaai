package com.microservice.codexa.ai.intelligence_service.repository;

import com.microservice.codexa.ai.intelligence_service.entity.ChatSession;
import com.microservice.codexa.ai.intelligence_service.entity.ChatSessionId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatSessionRepository extends JpaRepository<ChatSession, ChatSessionId> {
}
