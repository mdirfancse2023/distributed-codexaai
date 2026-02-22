package com.microservice.codexa.ai.common_library.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
@Getter
public enum ProjectPermission {
    VIEW("project:view"), //resource:action
    EDIT("project:edit"),
    DELETE("project:delete"),
    VIEW_MEMBERS("project_members:view"),
    MANAGE_MEMBERS("project_members:manage");

    private final String value;
}
