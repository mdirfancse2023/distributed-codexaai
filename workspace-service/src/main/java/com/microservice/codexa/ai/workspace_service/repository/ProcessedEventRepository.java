package com.microservice.codexa.ai.workspace_service.repository;

import com.microservice.codexa.ai.workspace_service.entity.ProcessedEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProcessedEventRepository extends JpaRepository<ProcessedEvent, String> {

}
