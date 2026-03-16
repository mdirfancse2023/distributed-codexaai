package com.microservice.codexa.ai.account_service.controller;


import com.microservice.codexa.ai.account_service.dto.subscription.*;
import com.microservice.codexa.ai.account_service.service.PaymentProcessor;
import com.microservice.codexa.ai.account_service.service.PlanService;
import com.microservice.codexa.ai.account_service.service.SubscriptionService;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.StripeObject;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@Slf4j
public class BillingController {
    private final SubscriptionService subscriptionService;
    private final PaymentProcessor paymentProcessor;

    @Value("${stripe.webhook.secret}")
    private String webhookSecret;

    @GetMapping("/subscription")
    public ResponseEntity<SubscriptionResponse> getMySubscription() {
        return ResponseEntity.ok(subscriptionService.getCurrentSubscription()); // Placeholder response
    }

    @PostMapping("/payments/checkout")
    public ResponseEntity<CheckoutResponse> createCheckoutSession(@RequestBody CheckoutRequest request) {

        return ResponseEntity.ok(paymentProcessor.createCheckoutSessionUrl(request)); // Placeholder response
    }

    @PostMapping("/payments/portal")
    public ResponseEntity<PortalResponse> openCustomerPortal() {
        return ResponseEntity.ok(paymentProcessor.openCustomerPortal()); // Placeholder response
    }

    @PostMapping("/webhooks/payment")
    public ResponseEntity<String> handlePaymentWebhook(@RequestBody String payload, @RequestHeader("Stripe-Signature") String sigHeader) {
        try {
            Event event = Webhook.constructEvent(payload, sigHeader, webhookSecret);
            EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
            StripeObject stripeObject = null;

            if(deserializer.getObject().isPresent()) { // Safe deserialization
                stripeObject = deserializer.getObject().get();
            } else {
                // Fallback to unsafe deserialization
                try{
                    stripeObject = deserializer.deserializeUnsafe();
                    if(stripeObject == null) {
                        log.error("Failed to deserialize Stripe object from webhook event; {}", event.getType());
                        return ResponseEntity.ok().build();
                    }
                } catch (Exception e) {
                    log.error("Unsafe deserialization of Stripe object failed; {}", event.getType(), e.getMessage());
                    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Deserialization failed");
                }
            }

            //Now extract metadata only if it's a Checkout Session
            Map<String, String> metadata = new HashMap<>();
            if(stripeObject instanceof Session session) {
                metadata = session.getMetadata();
            }

            //Pass to your processor
            paymentProcessor.handleWebhookEvent(event.getType(), stripeObject, metadata);
            return ResponseEntity.ok().build();


        } catch (SignatureVerificationException e) {
            throw new RuntimeException(e);
        }
    }
}
