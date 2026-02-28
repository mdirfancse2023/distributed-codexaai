package com.microservice.codexa.ai.account_service.mapper;



import com.microservice.codexa.ai.account_service.dto.subscription.SubscriptionResponse;
import com.microservice.codexa.ai.account_service.entity.Plan;
import com.microservice.codexa.ai.account_service.entity.Subscription;
import com.microservice.codexa.ai.common_library.dto.PlanDto;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface SubscriptionMapper {
    SubscriptionResponse toSubscriptionResponse(Subscription subscription);

    PlanDto toPlanResponse(Plan plan);
}
