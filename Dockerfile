# Codexa AI Backend Dockerfile
# Simplified build for merged backend service

ARG SERVICE_NAME=backend-sgad

# Use Eclipse Temurin OpenJDK 21 as base image
FROM eclipse-temurin:21-jdk as build

# Set working directory
WORKDIR /app

# Copy project files
COPY pom.xml ./
COPY mvnw .*

# Copy source code
COPY account-service/src ./src
COPY account-service/pom.xml ./

# Build the application
RUN chmod +x mvnw && ./mvnw clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
