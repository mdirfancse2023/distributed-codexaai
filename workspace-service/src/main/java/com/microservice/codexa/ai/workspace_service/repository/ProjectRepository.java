package com.microservice.codexa.ai.workspace_service.repository;


import com.microservice.codexa.ai.common_library.enums.ProjectRole;
import com.microservice.codexa.ai.workspace_service.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {

    //JPAQL query to find all projects accessible by a user (owned and shared projects)
    @Query("""
    SELECT p as project, pm.projectRole as role
    FROM Project p 
    JOIN ProjectMember pm ON pm.project.id = p.id
    WHERE pm.id.userId = :userId
    AND p.deletedAt IS NULL
    ORDER BY p.updatedAt DESC
    """)
    List<ProjectWithRole> findAllAccessibleByUser(@Param("userId") Long userId);

    //JPAQL query to find a specific project by ID if accessible by a user
    @Query("""
    SELECT p from Project p
    WHERE p.id = :projectId
    AND p.deletedAt IS NULL
    AND EXISTS (
        SELECT 1 FROM ProjectMember pm 
        WHERE pm.id.userId = :userId
        AND pm.id.projectId = :projectId
    )
    """)
    Optional<Project> findAccessibleProjectById(@Param("projectId") Long projectId, @Param("userId") Long userId);

    //JPAQL query to find a specific project by ID if accessible by a user
    @Query("""
    SELECT p as project, pm.projectRole as role
    from Project p
    JOIN ProjectMember pm ON pm.project.id = p.id
    WHERE p.id = :projectId
    AND pm.id.userId = :userId
    AND p.deletedAt IS NULL
    """)
    Optional<ProjectWithRole> findAccessibleProjectByIdWithRole(@Param("projectId") Long projectId, @Param("userId") Long userId);

    interface ProjectWithRole {
        Project getProject();
        ProjectRole getRole();
    }
}
