package com.microservice.codexa.ai.account_service.service;


import com.microservice.codexa.ai.account_service.dto.subscription.PlanResponse;

import java.util.List;

public interface PlanService {
    List<PlanResponse> getAllActivePlans();
}
