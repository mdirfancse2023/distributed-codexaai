package com.microservice.codexa.ai.account_service.service.impl;


import com.microservice.codexa.ai.account_service.dto.auth.UserProfileResponse;
import com.microservice.codexa.ai.account_service.entity.User;
import com.microservice.codexa.ai.account_service.repository.UserRepository;
import com.microservice.codexa.ai.common_library.error.ResourceNotFoundException;
import com.microservice.codexa.ai.common_library.security.JwtUserPrinciple;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;

@Service
@RequiredArgsConstructor
@FieldDefaults(makeFinal = true, level = AccessLevel.PRIVATE)
public class UserServiceImpl implements UserDetailsService {

    UserRepository userRepository;

    @Override
     public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found", username));

        return new JwtUserPrinciple(
                user.getId(),
                user.getName(),
                user.getUsername(),
                user.getPassword(),
                new ArrayList<>()
        );
    }
}
