# Codexa AI Backend Dockerfile
# Build all microservices: common, workspace, intelligence, api-gateway, account

ARG SERVICE_NAME=backend-sgad

# Use Eclipse Temurin OpenJDK 21 with Maven as base image
FROM maven:3.9-eclipse-temurin-21 as build

# Set working directory
WORKDIR /app

# Build common-library first
COPY common-library/src ./common-library/src
COPY common-library/pom.xml ./common-library/pom.xml
RUN cd common-library && mvn clean install -DskipTests -Djib.skip=true

# Build workspace service
COPY workspace-service/src ./workspace-service/src
COPY workspace-service/pom.xml ./workspace-service/pom.xml
RUN cd workspace-service && mvn clean install -DskipTests -Djib.skip=true

# Build intelligence service
COPY intelligence-service/src ./intelligence-service/src
COPY intelligence-service/pom.xml ./intelligence-service/pom.xml
RUN cd intelligence-service && mvn clean install -DskipTests -Djib.skip=true

# Build api-gateway service
COPY api-gateway/src ./api-gateway/src
COPY api-gateway/pom.xml ./api-gateway/pom.xml
RUN cd api-gateway && mvn clean install -DskipTests -Djib.skip=true

# Build config service
COPY config-service/src ./config-service/src
COPY config-service/pom.xml ./config-service/pom.xml
RUN cd config-service && mvn clean install -DskipTests -Djib.skip=true

# Copy account-service source code
COPY account-service/src ./src
COPY account-service/pom.xml ./

# Build account-service (now can find all other services)
RUN mvn clean package -DskipTests -Djib.skip=true

# Runtime stage
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
