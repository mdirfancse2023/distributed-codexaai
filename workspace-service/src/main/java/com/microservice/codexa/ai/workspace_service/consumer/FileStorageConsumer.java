package com.microservice.codexa.ai.workspace_service.consumer;

import com.microservice.codexa.ai.common_library.event.FileStoreRequestEvent;
import com.microservice.codexa.ai.common_library.event.FileStoreResponseEvent;
import com.microservice.codexa.ai.workspace_service.entity.ProcessedEvent;
import com.microservice.codexa.ai.workspace_service.repository.ProcessedEventRepository;
import com.microservice.codexa.ai.workspace_service.service.ProjectFileService;
import jakarta.transaction.Transactional;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import javax.annotation.processing.ProcessingEnvironment;
import java.time.LocalDateTime;

@Service
@Slf4j
@RequiredArgsConstructor
public class FileStorageConsumer {

    private final ProjectFileService projectFileService;
    private final ProcessedEventRepository processedEventRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Transactional
    @KafkaListener(topics = "file-store-request-event", groupId = "workspace-group")
    public void consumerFileEvent(FileStoreRequestEvent requestEvent){

        // Idempotence check: If the event with the same sagaId has already been processed, skip processing
        if(processedEventRepository.existsById(requestEvent.sagaId())){
            log.info("Event with id {} has already been processed. Skipping.", requestEvent.sagaId());
            sendResponse(requestEvent, true, null);
            return;
        }

        try{
            log.info("Received file store request event for projectId: {}, filePath: {}", requestEvent.projectId(), requestEvent.filePath());
            projectFileService.saveFile(requestEvent.projectId(), requestEvent.filePath(), requestEvent.content());
            processedEventRepository.save(new ProcessedEvent(
                    requestEvent.sagaId(),
                    LocalDateTime.now()
            ));
            sendResponse(requestEvent, true, null);
        }catch(Exception e){
           log.error("Error saving file: {}", e.getMessage());
           sendResponse(requestEvent, false, e.getMessage());
        }
    }

    private void sendResponse(FileStoreRequestEvent req, boolean success, String error){
        FileStoreResponseEvent response = FileStoreResponseEvent.builder()
                .sagaId(req.sagaId())
                .success(success)
                .projectId(req.projectId())
                .errorMessage(error)
                .build();

        kafkaTemplate.send("file-store-responses", response);
    }
}
