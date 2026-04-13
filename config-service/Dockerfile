# Codexa AI Config Server Dockerfile

# Use Eclipse Temurin OpenJDK 21 with Maven as base image
FROM maven:3.9-eclipse-temurin-21 as build

# Set working directory
WORKDIR /app

# Copy source code
COPY src ./src
COPY pom.xml ./

# Build the application
RUN mvn clean package -DskipTests -Djib.skip=true

# Runtime stage
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8888
CMD ["java", "-jar", "app.jar"]
