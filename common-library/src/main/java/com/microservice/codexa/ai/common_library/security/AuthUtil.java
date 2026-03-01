package com.microservice.codexa.ai.common_library.security;

import com.microservice.codexa.ai.common_library.dto.UserDto;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Date;

@Component
public class AuthUtil {
    @Value("${jwt.secret}")
    private String jwtSecretKey;

    private SecretKey getSecretKey(){
        return Keys.hmacShaKeyFor(jwtSecretKey.getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(JwtUserPrinciple user){
        return Jwts.builder()
                .subject(user.username())
                .claim("userId", user.userId().toString())
                .claim("name", user.name())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 1000*60*10*12)) // 2 hrs expiration
                .signWith(getSecretKey())
                .compact();
    }

    public JwtUserPrinciple verifyAccessToken(String token){
        Claims claims = Jwts.parser()
                .verifyWith(getSecretKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();

        // Extract user details from claims after converting userId to string and then to Long
        Long userId = Long.parseLong(claims.get("userId", String.class));
        String name = claims.get("name", String.class);
        String username = claims.getSubject();
        return new JwtUserPrinciple(userId, name, username, null, new ArrayList<>());
    }

    public Long getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof JwtUserPrinciple userPrinciple)) {
            throw new AuthenticationCredentialsNotFoundException("No JWT Found");
        }
        return userPrinciple.userId();
    }
}
