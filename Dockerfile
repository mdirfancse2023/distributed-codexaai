# Complete Codexa AI Microservices Dockerfile
# Merged all backend services into single deployment

ARG SERVICE_NAME=merged-backend

# Use OpenJDK 21 as base image
FROM openjdk:21-jdk-slim as base

# Set working directory
WORKDIR /app

# Copy Maven wrapper and pom files
COPY mvnw .
COPY .mvn .mvn

# Copy all service source files
COPY account-service/pom.xml ./account-pom.xml
COPY workspace-service/pom.xml ./workspace-pom.xml
COPY intelligence-service/pom.xml ./intelligence-pom.xml
COPY config-service/pom.xml ./config-pom.xml
COPY discovery-service/pom.xml ./discovery-pom.xml

# Copy all source code
COPY account-service/src ./account-src
COPY workspace-service/src ./workspace-src
COPY intelligence-service/src ./intelligence-src
COPY config-service/src ./config-src
COPY discovery-service/src ./discovery-src
COPY common-library/src ./common-src

# Copy frontend build
COPY codexa-frontend/package*.json ./
RUN npm install
COPY codexa-frontend/src ./frontend-src
COPY codexa-frontend/public ./frontend-public
RUN npm run build

# Expose ports
EXPOSE 8080

# Run the merged backend application
CMD ["java", "-jar", "target/merged-backend-0.0.1-SNAPSHOT.jar"]
