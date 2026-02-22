package com.microservice.codexa.ai.account_service.dto.auth;

public record AuthResponse(String token, UserProfileResponse user) { //record in java where all fields are final by default

}
