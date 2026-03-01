package com.microservice.codexa.ai.account_service.service.impl;

import com.microservice.codexa.ai.account_service.dto.subscription.CheckoutRequest;
import com.microservice.codexa.ai.account_service.dto.subscription.CheckoutResponse;
import com.microservice.codexa.ai.account_service.dto.subscription.PortalResponse;
import com.microservice.codexa.ai.account_service.entity.User;
import com.microservice.codexa.ai.account_service.repository.PlanRepository;
import com.microservice.codexa.ai.account_service.repository.UserRepository;
import com.microservice.codexa.ai.account_service.service.PaymentProcessor;
import com.microservice.codexa.ai.account_service.service.SubscriptionService;
import com.microservice.codexa.ai.common_library.enums.SubscriptionStatus;
import com.microservice.codexa.ai.common_library.error.BadRequestException;
import com.microservice.codexa.ai.common_library.error.ResourceNotFoundException;
import com.microservice.codexa.ai.common_library.security.AuthUtil;
import com.stripe.exception.StripeException;
import com.stripe.model.*;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import com.microservice.codexa.ai.account_service.entity.Plan;
import java.time.Instant;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class StripePaymentProcessor implements PaymentProcessor {
    private final AuthUtil authUtil;
    private final PlanRepository planRepository;
    private final UserRepository userRepository;
    private final SubscriptionService subscriptionService;

    @Value("${app.frontend.url}")
    private String frontendUrl;

    @Override
    public CheckoutResponse createCheckoutSessionUrl(CheckoutRequest request) {
        Plan plan  = planRepository.findById(request.planId()).orElseThrow(() ->
                     new ResourceNotFoundException("Plan", request.planId().toString()));
        Long userId = authUtil.getCurrentUserId();
        User user = getUser(userId);

        var params =
                SessionCreateParams.builder()
                        .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                        .setSubscriptionData(
                                new SessionCreateParams.SubscriptionData.Builder()
                                        .setBillingMode(SessionCreateParams.SubscriptionData.BillingMode.builder()
                                                .setType(SessionCreateParams.SubscriptionData.BillingMode.Type.FLEXIBLE)
                                                .build())
                                        .build()
                        )
                        .setSuccessUrl(frontendUrl + "/success.html?session_id={CHECKOUT_SESSION_ID}")
                        .setCancelUrl(frontendUrl + "/cancel.html")
                        .putMetadata("user_id", userId.toString())
                        .putMetadata("plan_id", plan.getId().toString())
                        .addLineItem(
                                SessionCreateParams.LineItem.builder()
                                        .setQuantity(1L)
                                        .setPrice(plan.getStripePriceId())
                                        .build());
        try {
            String stripeCustomerId = user.getStripeCustomerId();
            if (stripeCustomerId == null || stripeCustomerId.isEmpty()) {
                params.setCustomerEmail(user.getUsername());
            } else {
                params.setCustomer(stripeCustomerId); // associating existing customer
            }
            Session session = Session.create(params.build()); // making the API call to Stripe
            return new CheckoutResponse(session.getUrl());
        } catch (StripeException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public PortalResponse openCustomerPortal() {
        Long userId = authUtil.getCurrentUserId();
        User user = getUser(userId);
        String stripeCustomerId = user.getStripeCustomerId();
        if(stripeCustomerId==null || stripeCustomerId.isEmpty()){
            log.error("User {} does not have a Stripe customer ID for opening customer portal", userId);
            throw new BadRequestException("User does not have a Stripe customer ID:"+ userId);
        }
        try {
            com.stripe.model.billingportal.Session portalSession =
                com.stripe.model.billingportal.Session.create(
                    com.stripe.param.billingportal.SessionCreateParams.builder()
                        .setCustomer(stripeCustomerId)
                        .setReturnUrl(frontendUrl)
                        .build()
                );
            return new PortalResponse(portalSession.getUrl());
        } catch (StripeException e) {
            throw new RuntimeException(e);
        }
    }

    // Webhook event handler for Stripe events like checkout.session.completed etc.
    @Override
    public void handleWebhookEvent(String type, StripeObject stripeObject, Map<String, String> metadata) {
        log.info("Handling webhook event: {}", type);
        switch(type){
            case "checkout.session.completed" -> handleCheckoutSessionCompleted((Session) stripeObject, metadata); // new checkout session completed
            case "customer.subscription.updated" -> handleCustomerSubscriptionUpdated((Subscription) stripeObject); // new subscription created or updated
            case "customer.subscription.deleted" -> handleCustomerSubscriptionDeleted((Subscription) stripeObject); // subscription cancelled
            case "invoice.paid" -> handleInvoicePaid((Invoice) stripeObject); // invoice paid
            case "invoice.payment_failed" -> handleInvoicePaymentFailed((Invoice) stripeObject); // invoice payment failed
            default -> log.debug("Unhandled webhook event type: {}", type); // other events we are not handling
        }
    }

    private void handleCheckoutSessionCompleted(Session session, Map<String, String> metadata) {
        if(session==null){
            log.error("Stripe session is null in checkout.session.completed event");
            return;
        }
        Long userId = Long.parseLong(metadata.get("user_id"));
        Long planId = Long.parseLong(metadata.get("plan_id"));

        String subscriptionId = session.getSubscription();
        String customerId = session.getCustomer();

        User user = getUser(userId);
        if(user.getStripeCustomerId()==null){
            user.setStripeCustomerId(customerId);
            userRepository.save(user);
        }

        subscriptionService.activateSubscription(userId, planId, subscriptionId, customerId);
    }

    private void handleCustomerSubscriptionUpdated(Subscription subscription) {
        if(subscription==null){
            log.error("Stripe subscription is null in customer.subscription.updated event");
            return;
        }

        SubscriptionStatus status = mapStripeStatusToEnum(subscription.getStatus());
        if(status==null){
            log.warn("Unknown subscription status received from Stripe: {}", subscription.getStatus(), subscription.getId());
            return;
        }

        SubscriptionItem item = subscription.getItems().getData().get(0); // assuming single item subscriptions
        Instant periodStart = toInsant(item.getCurrentPeriodStart());
        Instant periodEnd = toInsant(item.getCurrentPeriodEnd());

        Long planId = resolvePlanId(item.getPrice());

        subscriptionService.updateSubscription(subscription.getId(), status, periodStart, periodEnd, subscription.getCancelAtPeriodEnd(), planId);

    }

    private void handleCustomerSubscriptionDeleted(Subscription subscription) {
        if(subscription==null){
            log.error("Stripe subscription is null in customer.subscription.deleted event");
            return;
        }
        subscriptionService.cancelSubscription(subscription.getId());
    }

    private void handleInvoicePaid(Invoice invoice){
        String subId = extractSubscriptionId(invoice);
        if(subId==null) {
            log.error("Failed to extract subscription id from invoice in invoice.paid event");
            return;
        }
        try {
            Subscription subscription = Subscription.retrieve(subId); // Fetch subscription details from Stripe
            var item = subscription.getItems().getData().get(0); // assuming single item subscriptions
            Instant periodStart = toInsant(item.getCurrentPeriodStart());
            Instant periodEnd = toInsant(item.getCurrentPeriodEnd());

            subscriptionService.renewSubscriptionPeriod(subId, periodStart, periodEnd);

        }catch(StripeException e){
            log.error("Failed to retrieve subscription from Stripe for invoice.paid event; {}", subId, e.getMessage());
        }

    }

    private void handleInvoicePaymentFailed(Invoice invoice){
        String subId = extractSubscriptionId(invoice);
        if(subId==null) {
            log.error("Failed to extract subscription id from invoice in invoice.paid event");
            return;
        }
        subscriptionService.markSubscriptionPastDue(subId);

    }

    // Helper methods
    private User getUser(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() ->
                new ResourceNotFoundException("User", userId.toString()));
        return user;
    }

    private SubscriptionStatus mapStripeStatusToEnum(String status) {
        return switch (status) {
            case "active" -> SubscriptionStatus.ACTIVE;
            case "past_due" -> SubscriptionStatus.PAST_DUE;
            case "canceled" -> SubscriptionStatus.CANCELED;
            case "incomplete" -> SubscriptionStatus.INCOMPLETE;
            case "trialing" -> SubscriptionStatus.TRIALING;
            default -> null;
        };
    }

    private Instant toInsant(Long epoch) {
        return epoch != null ? Instant.ofEpochSecond(epoch) : null;
    }

    private Long resolvePlanId(Price price) {
        if(price==null || price.getId()==null){
            log.error("Price object is null while resolving plan id");
            return null;
        }
        return planRepository.findByStripePriceId(price.getId())
                .map(Plan::getId)
                .orElse(null);
    }

    private String extractSubscriptionId(Invoice invoice){
        var parent = invoice.getParent();
        if(parent == null) return null;
        var subDetails = parent.getSubscriptionDetails();
        if(subDetails == null) return null;
        return subDetails.getSubscription();
    }
}
