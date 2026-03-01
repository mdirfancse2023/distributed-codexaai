package com.microservice.codexa.ai.account_service.mapper;

import com.microservice.codexa.ai.account_service.dto.auth.SignupRequest;
import com.microservice.codexa.ai.account_service.dto.auth.UserProfileResponse;
import com.microservice.codexa.ai.account_service.entity.User;
import com.microservice.codexa.ai.common_library.dto.UserDto;
import com.microservice.codexa.ai.common_library.security.JwtUserPrinciple;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface UserMapper {
    User toEntity(SignupRequest signupRequest);

    @Mapping(target = "id", source = "userId")
    UserProfileResponse toUserProfileResponse(JwtUserPrinciple user);

    UserDto toUserDto(User user);
}
