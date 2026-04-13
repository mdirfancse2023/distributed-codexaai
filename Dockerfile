# Codexa AI Backend Dockerfile
# Build common-library first, then account-service

ARG SERVICE_NAME=backend-sgad

# Use Eclipse Temurin OpenJDK 21 with Maven as base image
FROM maven:3.9-eclipse-temurin-21 as build

# Set working directory
WORKDIR /app

# Build common-library first
COPY common-library/src ./common-library/src
COPY common-library/pom.xml ./common-library/pom.xml
RUN cd common-library && mvn clean install -DskipTests

# Copy account-service source code
COPY account-service/src ./src
COPY account-service/pom.xml ./

# Build account-service (now can find common-library)
RUN mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
