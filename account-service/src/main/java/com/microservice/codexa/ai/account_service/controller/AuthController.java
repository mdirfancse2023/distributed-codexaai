package com.microservice.codexa.ai.account_service.controller;


import com.microservice.codexa.ai.account_service.dto.auth.AuthResponse;
import com.microservice.codexa.ai.account_service.dto.auth.LoginRequest;
import com.microservice.codexa.ai.account_service.dto.auth.SignupRequest;
import com.microservice.codexa.ai.account_service.dto.auth.UserProfileResponse;
import com.microservice.codexa.ai.account_service.service.AuthService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/auth")
@FieldDefaults(makeFinal = true, level = AccessLevel.PRIVATE)
public class AuthController {
    AuthService authService;

    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@RequestBody SignupRequest request){
        return ResponseEntity.ok(authService.signup(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request){
        return ResponseEntity.ok(authService.login(request));
    }
}
