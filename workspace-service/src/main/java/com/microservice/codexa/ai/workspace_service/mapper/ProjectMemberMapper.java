package com.microservice.codexa.ai.workspace_service.mapper;

import com.microservice.codexa.ai.workspace_service.dto.member.MemberResponse;
import com.microservice.codexa.ai.workspace_service.entity.ProjectMember;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ProjectMemberMapper {

    @Mapping(target="userId",source="id")
    @Mapping(target="role", constant="OWNER")
    MemberResponse toProjectMemberResponseFromOwner(User owner);

    @Mapping(source = "user.id", target = "userId")
    @Mapping(source = "user.username", target = "username")
    @Mapping(source = "user.name", target = "name")
    @Mapping(source = "projectRole", target = "role")
    MemberResponse toProjectMemberResponseFromMember(ProjectMember projectMember);
}
