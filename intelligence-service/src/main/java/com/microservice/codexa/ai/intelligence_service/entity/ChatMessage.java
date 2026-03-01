package com.microservice.codexa.ai.intelligence_service.entity;

import com.microservice.codexa.ai.common_library.enums.MessageRole;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "chat_messages")
@Getter
@Setter
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ChatMessage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumns({
        @JoinColumn(name="project_id", referencedColumnName="project_id", nullable=false),
        @JoinColumn(name="user_id", referencedColumnName="user_id", nullable=false)
    })
    ChatSession chatSession;

    @Column(columnDefinition = "text", nullable = false)
    String content;
    String toolCalls; // JSON representation of tool calls

    Integer tokensUsed = 0;

    @CreationTimestamp
    Instant createdAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable=false)
    MessageRole role; // USER, ASSISTANT

    @OneToMany(mappedBy = "chatMessage", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @OrderBy("sequenceOrder ASC")
    List<ChatEvent> events;
}
