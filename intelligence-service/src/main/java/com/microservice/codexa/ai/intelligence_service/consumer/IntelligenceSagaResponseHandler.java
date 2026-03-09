package com.microservice.codexa.ai.intelligence_service.consumer;

import com.microservice.codexa.ai.common_library.enums.ChatEventStatus;
import com.microservice.codexa.ai.common_library.event.FileStoreResponseEvent;
import com.microservice.codexa.ai.intelligence_service.repository.ChatEventRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class IntelligenceSagaResponseHandler {
    private final ChatEventRepository chatEventRepository;

    @Transactional
    @KafkaListener(topics = "file-store-responses", groupId = "intelligence-group")
    public void handleSagaResponse(FileStoreResponseEvent response){
        chatEventRepository.findBySagaId(response.sagaId()).ifPresent(event -> {
            if(!ChatEventStatus.PENDING.equals(event.getStatus())){ // Idempotence check: If the event is not in PENDING status, it means the response has already been processed
                log.info("Saga response for event with id {} has already been processed. Skipping.", response.sagaId());
                return;
            }
            if(response.success()) {
                event.setStatus(ChatEventStatus.CONFIRMED);
                log.info("Saga with id {} completed successfully.", response.sagaId());
            }else{
                log.warn("Saga with id {} failed", response.sagaId());
                event.setStatus(ChatEventStatus.FAILED);
            }
        });
    }
}
