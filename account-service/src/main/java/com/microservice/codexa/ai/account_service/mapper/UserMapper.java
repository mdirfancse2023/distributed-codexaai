package com.microservice.codexa.ai.account_service.mapper;

import com.microservice.codexa.ai.account_service.dto.auth.SignupRequest;
import com.microservice.codexa.ai.account_service.dto.auth.UserProfileResponse;
import com.microservice.codexa.ai.account_service.entity.User;
import com.microservice.codexa.ai.common_library.dto.UserDto;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface UserMapper {
    User toEntity(SignupRequest signupRequest);
    UserProfileResponse toUserProfileResponse(User user);
    UserDto toUserDto(User user);
}
