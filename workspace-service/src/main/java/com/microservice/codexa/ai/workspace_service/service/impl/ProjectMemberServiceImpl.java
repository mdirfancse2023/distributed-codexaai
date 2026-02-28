package com.microservice.codexa.ai.workspace_service.service.impl;

import com.microservice.codexa.ai.common_library.dto.UserDto;
import com.microservice.codexa.ai.common_library.error.ResourceNotFoundException;
import com.microservice.codexa.ai.common_library.security.AuthUtil;
import com.microservice.codexa.ai.workspace_service.client.AccountClient;
import com.microservice.codexa.ai.workspace_service.dto.member.InviteMemberRequest;
import com.microservice.codexa.ai.workspace_service.dto.member.MemberResponse;
import com.microservice.codexa.ai.workspace_service.dto.member.UpdateMemberRoleRequest;
import com.microservice.codexa.ai.workspace_service.entity.Project;
import com.microservice.codexa.ai.workspace_service.entity.ProjectMember;
import com.microservice.codexa.ai.workspace_service.entity.ProjectMemberId;
import com.microservice.codexa.ai.workspace_service.mapper.ProjectMemberMapper;
import com.microservice.codexa.ai.workspace_service.repository.ProjectMemberRepository;
import com.microservice.codexa.ai.workspace_service.repository.ProjectRepository;
import com.microservice.codexa.ai.workspace_service.service.ProjectMemberService;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@FieldDefaults(makeFinal = true, level = AccessLevel.PRIVATE)
@RequiredArgsConstructor
@Transactional
public class ProjectMemberServiceImpl implements ProjectMemberService {

    ProjectMemberRepository projectMemberRepository;
    ProjectRepository projectRepository;
    ProjectMemberMapper projectMemberMapper;
    AuthUtil authUtil;
    AccountClient accountClient;

    @Override
    @PreAuthorize("@security.canViewMembers(#projectId)")
    public List<MemberResponse> getProjectMembers(Long projectId) {
        return  projectMemberRepository.findByIdProjectId(projectId)
                .stream()
                .map(projectMemberMapper::toProjectMemberResponseFromMember)
                .toList();
    }

    @Override
    @PreAuthorize("@security.canManageMembers(#projectId)")
    public MemberResponse inviteMember(Long projectId, InviteMemberRequest request) {
        Long userId = authUtil.getCurrentUserId();
        Project project = getAccessibleProjectById(projectId, userId);

        UserDto invitee = accountClient.getUserByEmail(request.username()).orElseThrow(
                ()-> new ResourceNotFoundException("User", request.username()));
        if(invitee.id().equals(userId)){
            throw new RuntimeException("Can't invite yourself");
        }

        ProjectMemberId projectMemberId = new ProjectMemberId(projectId, invitee.id());
        if(projectMemberRepository.existsById(projectMemberId)){
            throw new RuntimeException("Can't invite once again");
        }

        ProjectMember member = ProjectMember.builder()
                .id(projectMemberId)
                .project(project)
                .projectRole(request.role())
                .invitedAt(Instant.now())
                .build();

        projectMemberRepository.save(member);
        return projectMemberMapper.toProjectMemberResponseFromMember(member);
    }

    @Override
    @PreAuthorize("@security.canManageMembers(#projectId)")
    public MemberResponse updateMemberRole(Long projectId, Long memberId, UpdateMemberRoleRequest request) {
        Long userId = authUtil.getCurrentUserId();
        Project project = getAccessibleProjectById(projectId, userId);

        ProjectMemberId projectMemberId = new ProjectMemberId(projectId, memberId);
        ProjectMember projectMember = projectMemberRepository.findById(projectMemberId).orElseThrow();
        projectMember.setProjectRole(request.role());
        projectMemberRepository.save(projectMember);
        return projectMemberMapper.toProjectMemberResponseFromMember(projectMember);
    }

    @Override
    @PreAuthorize("@security.canManageMembers(#projectId)")
    public void removeProjectMember(Long projectId, Long memberId) {
        Long userId = authUtil.getCurrentUserId();
        Project project = getAccessibleProjectById(projectId, userId);

        ProjectMemberId projectMemberId = new ProjectMemberId(projectId, memberId);
        if(!projectMemberRepository.existsById(projectMemberId)){
            throw new RuntimeException("Member not found in project");
        }
        projectMemberRepository.deleteById(projectMemberId);

    }

    // Internal functions
    public Project getAccessibleProjectById(Long id, Long userId) {
        return projectRepository.findAccessibleProjectById(id, userId).orElseThrow();
    }
}
