package com.microservice.codexa.ai.workspace_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.io.Serializable;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Embeddable
@EqualsAndHashCode
@ToString
public class ProjectMemberId implements Serializable {

    @Column(name = "project_id")
    Long projectId;

    @Column(name = "user_id")
    Long userId;
}
