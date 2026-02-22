package com.microservice.codexa.ai.account_service.service;


import com.microservice.codexa.ai.account_service.dto.auth.UserProfileResponse;

public interface UserService {
    UserProfileResponse getProfile(Long userid);
}
