# Multi-service Dockerfile for Codexa AI Microservices
# Build argument to determine which service to build
ARG SERVICE_NAME

# Use OpenJDK 21 as base image
FROM openjdk:21-jdk-slim as base

# Set working directory
WORKDIR /app

# Copy Maven wrapper and pom files
COPY mvnw .
COPY .mvn .mvn

# Copy the specific service's pom.xml based on SERVICE_NAME
COPY ${SERVICE_NAME}/pom.xml ./

# Download dependencies
RUN ./mvnw dependency:go-offline

# Copy source code for the specific service
COPY ${SERVICE_NAME}/src ./src

# Build the application
RUN ./mvnw clean package -DskipTests

# Expose port (will be overridden by render.yaml)
EXPOSE 8080

# Run the application - determine JAR name based on service
CMD ["java", "-jar", "target/${SERVICE_NAME}-0.0.1-SNAPSHOT.jar"]
