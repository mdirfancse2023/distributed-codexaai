package com.microservice.codexa.ai.api_gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class ApiGatewayApplication {

	public static void main(String[] args) {
		SpringApplication.run(ApiGatewayApplication.class, args);
	}

	@Bean
	public RouteLocator customRouteLocator(RouteLocatorBuilder builder) {
		return builder.routes()
			.route("preview-proxy", r -> r
				.path("/preview-proxy/**")
				.filters(f -> f
					.stripPrefix(1)
					.rewritePath("/preview-proxy/(?<segment>.*)", "http://${segment}")
				)
				.uri("lb://codexa-ai-proxy"))
			.build();
	}
}
