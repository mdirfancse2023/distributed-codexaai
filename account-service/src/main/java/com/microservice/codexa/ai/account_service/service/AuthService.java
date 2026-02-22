package com.microservice.codexa.ai.account_service.service;


import com.microservice.codexa.ai.account_service.dto.auth.AuthResponse;
import com.microservice.codexa.ai.account_service.dto.auth.LoginRequest;
import com.microservice.codexa.ai.account_service.dto.auth.SignupRequest;

public interface AuthService {
    AuthResponse signup(SignupRequest request);

    AuthResponse login(LoginRequest request);
}
