package com.microservice.codexa.ai.intelligence_service.service;


import com.microservice.codexa.ai.intelligence_service.dto.chat.StreamResponse;
import reactor.core.publisher.Flux;

public interface AIGenerationService {
   Flux<StreamResponse> streamResponse(String message, Long aLong);
}
