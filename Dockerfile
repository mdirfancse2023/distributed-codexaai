# Codexa AI Backend Dockerfile
# Simplified build using standard Maven

ARG SERVICE_NAME=backend-sgad

# Use Eclipse Temurin OpenJDK 21 with Maven as base image
FROM maven:3.9-eclipse-temurin-21 as build

# Set working directory
WORKDIR /app

# Copy source code
COPY account-service/src ./src
COPY account-service/pom.xml ./

# Build the application
RUN mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
