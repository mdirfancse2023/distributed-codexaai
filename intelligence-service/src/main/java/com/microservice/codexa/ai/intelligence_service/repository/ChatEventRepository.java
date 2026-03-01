package com.microservice.codexa.ai.intelligence_service.repository;

import com.microservice.codexa.ai.intelligence_service.entity.ChatEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatEventRepository extends JpaRepository<ChatEvent, Long> {
}
