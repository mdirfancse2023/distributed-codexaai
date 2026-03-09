package com.microservice.codexa.ai.intelligence_service.service.impl;

import com.microservice.codexa.ai.common_library.enums.ChatEventStatus;
import com.microservice.codexa.ai.common_library.enums.ChatEventType;
import com.microservice.codexa.ai.common_library.enums.MessageRole;
import com.microservice.codexa.ai.common_library.error.ResourceNotFoundException;
import com.microservice.codexa.ai.common_library.event.FileStoreRequestEvent;
import com.microservice.codexa.ai.common_library.security.AuthUtil;
import com.microservice.codexa.ai.intelligence_service.client.WorkspaceClient;
import com.microservice.codexa.ai.intelligence_service.dto.chat.StreamResponse;
import com.microservice.codexa.ai.intelligence_service.entity.ChatEvent;
import com.microservice.codexa.ai.intelligence_service.entity.ChatMessage;
import com.microservice.codexa.ai.intelligence_service.entity.ChatSession;
import com.microservice.codexa.ai.intelligence_service.entity.ChatSessionId;
import com.microservice.codexa.ai.intelligence_service.llm.LlmResponseParser;
import com.microservice.codexa.ai.intelligence_service.llm.PromptUtils;
import com.microservice.codexa.ai.intelligence_service.llm.advisors.FileTreeContextAdvisor;
import com.microservice.codexa.ai.intelligence_service.llm.tools.CodeGenerationTools;
import com.microservice.codexa.ai.intelligence_service.repository.ChatEventRepository;
import com.microservice.codexa.ai.intelligence_service.repository.ChatMessageRepository;
import com.microservice.codexa.ai.intelligence_service.repository.ChatSessionRepository;
import com.microservice.codexa.ai.intelligence_service.service.AIGenerationService;
import com.microservice.codexa.ai.intelligence_service.service.UsageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class AIGenerationServiceImpl implements AIGenerationService {
    private final ChatSessionRepository chatSessionRepository;
    private final ChatClient chatClient;
    private final AuthUtil authUtil;
    private final FileTreeContextAdvisor fileTreeContextAdvisor;
    private final LlmResponseParser llmResponseParser;
    private final ChatMessageRepository chatMessageRepository;
    private final ChatEventRepository chatEventRepository;
    private final UsageService usageService;
    private final WorkspaceClient workspaceClient;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private static final Pattern FILE_TAG_PATTERN = Pattern.compile("<file path=\"([^\"]+)\">(.*?)</file>", Pattern.DOTALL);
    @Override
    @PreAuthorize("@security.canEditProject(#projectId)")
    public Flux<StreamResponse> streamResponse(String userMessage, Long projectId) {
        //usageService.checkDailyTokensUsage();
        Long userId = authUtil.getCurrentUserId();
        ChatSession chatSession = createChatSessionIfNotExists(projectId, userId);

        Map<String, Object> advisorParams = Map.of(
                "userId", userId,
                "projectId", projectId
        );

        StringBuilder fullResponseBuffer = new StringBuilder();

        CodeGenerationTools codeGenerationTools = new CodeGenerationTools(projectId, workspaceClient);

        AtomicReference<Long> startTime = new AtomicReference<>(System.currentTimeMillis());
        AtomicReference<Long> endTime = new AtomicReference<>(0L);
        AtomicReference<Usage> usageRef = new AtomicReference<>();

        return chatClient.prompt()
                .system(PromptUtils.CODE_GENERATION_SYSTEM_PROMPT) // add system prompt
                .user(userMessage) // add user message
                .tools(codeGenerationTools)
                .advisors(advisorSpec -> { // configure advisors
                    advisorSpec.params(advisorParams);// pass parameters to advisors
                    advisorSpec.advisors(fileTreeContextAdvisor); // add file tree context advisor
                }).stream() // enable streaming
                .chatResponse() // get streaming chat responses
                .doOnNext(response -> { // for each streamed response chunk
                    String content = response.getResult().getOutput().getText(); // extract content from response
                    if(content != null && !content.isEmpty() && endTime.get() == 0L){ // set end time on first content receipt
                        endTime.set(System.currentTimeMillis());
                    }
                    if(response.getMetadata().getUsage()!=null){
                        usageRef.set(response.getMetadata().getUsage());
                    }
                    fullResponseBuffer.append(content); // accumulate the full response
                }).doOnComplete(() -> { // when streaming is complete
                    Schedulers.boundedElastic().schedule(() -> { // offload to separate thread
                        Long duration = (endTime.get() - startTime.get()) / 1000;
                        finalizeChats(userMessage, chatSession, fullResponseBuffer.toString(), duration, usageRef.get(), userId); // finalize chat logs and handle file edits
                    });
                }).doOnError(error -> // handle errors
                    log.error("Error during AI chat response streaming for project: {}", projectId) // log error with project context
                ).map(response -> {
                    String text = response.getResult().getOutput().getText();
                    return new StreamResponse(text != null ? text : ""); // map to response text
                }); // map to response text
    }

    private void finalizeChats(String userMessage, ChatSession chatSession, String fullText, Long durationInSeconds, Usage usage, Long userId) {
        // Implementation to finalize user chat logs, save messages, etc.
        Long projectId = chatSession.getId().getProjectId();
        if(usage != null) {
            int totalTokens = usage.getTotalTokens();
            usageService.recordTokenUsage(chatSession.getId().getUserId(), totalTokens);
        }
        chatMessageRepository.save(
                ChatMessage.builder()
                        .chatSession(chatSession)
                        .role(MessageRole.USER)
                        .content(userMessage)
                        .tokensUsed(usage.getPromptTokens())
                        .build()
        );

        ChatMessage assistantChatMessage = ChatMessage.builder()
                .role(MessageRole.ASSISTANT)
                .content("Assistant Message here...") // Placeholder, will be updated after parsing
                .chatSession(chatSession)
                .tokensUsed(usage.getCompletionTokens())
                .build();
        assistantChatMessage = chatMessageRepository.save(assistantChatMessage);

        List<ChatEvent> chatEventList = llmResponseParser.parseChatEvents(fullText, assistantChatMessage);
        chatEventList.addFirst(ChatEvent.builder()
                        .type(ChatEventType.THOUGHT)
                        .status(ChatEventStatus.CONFIRMED)
                        .chatMessage(assistantChatMessage)
                        .content("Thought for "+durationInSeconds+"s")
                        .sequenceOrder(0)
                        .build());

        chatEventList.stream()
                .filter(e -> e.getType() == ChatEventType.FILE_EDIT)
                .forEach(e -> {
                    String sagaId = UUID.randomUUID().toString(); // Generate unique sagaId for idempotency
                    e.setSagaId(sagaId);
                    FileStoreRequestEvent fileStoreRequestEvent = new FileStoreRequestEvent(
                            projectId,
                            sagaId,
                            e.getFilePath(),
                            e.getContent(),
                            userId
                    );
                    log.info("Storage request event sent: {}", e.getFilePath());
                    kafkaTemplate.send("file-store-request-event", "project-"+projectId, fileStoreRequestEvent);
                });

        chatEventRepository.saveAll(chatEventList);
    }

    private ChatSession createChatSessionIfNotExists(Long projectId, Long userId) {
        ChatSessionId chatSessionId = new ChatSessionId(projectId, userId);
        ChatSession chatSession = chatSessionRepository.findById(chatSessionId).orElse(null);
        System.out.println("createChatSessionIfNotExists called");
        if(chatSession == null) {
            chatSession = ChatSession.builder()
                    .id(chatSessionId)
                    .build();
            chatSession = chatSessionRepository.save(chatSession);
        }
        return chatSession;
    }

}
