# 🚀 Codexa AI — Distributed AI Code Generation Platform

> Production-grade AI platform inspired by Lovable.dev, built using Spring Boot Microservices, React, Kubernetes, Kafka, MinIO, Redis, and OpenAI.

---

## 📌 Overview

Codexa AI is a distributed system that allows users to:

- Generate full applications using AI
- Manage project files dynamically
- Run live previews in Kubernetes pods
- Collaborate via chat-based development
- Scale using microservices architecture

---

## 🏗️ System Architecture

- API Gateway → routes all requests
- Account Service → authentication & billing
- Workspace Service → project & file management
- Intelligence Service → AI processing
- Kafka → async communication
- MinIO → file storage
- Redis → caching
- Kubernetes → execution & scaling

---

## 🧩 Microservices

### Account Service
- Handles authentication (JWT)
- Manages users, plans, subscriptions
- Integrates with Stripe
- PostgreSQL database

### Workspace Service
- Manages projects and files
- Stores metadata in PostgreSQL
- Stores files in MinIO
- Uses Redis for caching
- Handles Kubernetes preview lifecycle

### Intelligence Service
- AI code generation
- Context building (file tree + file content)
- LLM interaction
- Parses AI responses
- Stores chat history

### Common Library
- JWT filter
- Feign interceptor
- Shared DTOs

---

## 🖥️ Frontend (React)

### Features
- Login / Signup UI
- Dashboard
- Project management
- Code editor
- Chat with AI
- Live preview panel

### Flow
1. User logs in
2. Creates project
3. Opens editor
4. Sends prompt to AI
5. Receives streaming response
6. Updates files
7. Runs preview

---

## 🗄️ Database Design

Main tables:

- User
- Project
- ProjectMember
- ProjectFile
- ChatSession
- ChatMessage
- Subscription
- UsageLog

Relationships:

- User → owns Projects
- Project → has Members
- Project → has Files
- Project → has Chat Sessions

---

## 🔄 End-to-End Flow

1. User sends prompt
2. API Gateway routes request
3. Intelligence Service:
   - Fetch file tree
   - Fetch file content
4. LLM processes input
5. Response streamed (SSE)
6. Files updated
7. Kafka event triggered
8. Workspace updates project

---

## 📡 API Documentation

### Auth APIs
POST /api/auth/login  
POST /api/auth/signup  
GET /api/auth/me  

---

### Project APIs
GET /api/projects  
POST /api/projects  
GET /api/projects/{id}  
PUT /api/projects/{id}  
DELETE /api/projects/{id}  

---

### File APIs
GET /api/projects/{id}/files  
GET /api/projects/{id}/files/**  
GET /api/projects/{id}/download-zip  

---

### Member APIs
GET /api/projects/{id}/members  
POST /api/projects/{id}/members  
PATCH /api/projects/{id}/members/{userId}  
DELETE /api/projects/{id}/members/{userId}  

---

### Billing APIs
GET /api/plans  
GET /api/me/subscription  
POST /api/stripe/checkout  
POST /api/stripe/portal  

---

### Usage APIs
GET /api/usage/today  
GET /api/usage/limits  

---

### Chat APIs
GET /api/projects/{id}/chat-sessions  
POST /api/projects/{id}/chat-sessions  
GET /api/chat/sessions/{sessionId}/messages  
POST /api/chat/stream  

---

### Preview APIs
POST /api/projects/{id}/preview  
GET /api/previews/{previewId}/status  
GET /api/previews/{previewId}/logs  
DELETE /api/previews/{previewId}  

---

## 🧠 AI Processing Pipeline

Input to LLM:

User Prompt  
+ System Prompt  
+ File Tree  
+ File Content  

Output:

- File updates
- Tool calls
- Code generation

---

## ⚙️ Code Execution System

- Files stored in MinIO
- Kubernetes pod created per project
- Runner executes:

npm install  
npm run dev  

- Each preview runs in isolation
- Logs streamed to frontend

---

## ☸️ Kubernetes Deployment

### Connect to cluster
gcloud container clusters get-credentials lovable-me-cluster --region asia-south1  

### Create namespaces
kubectl create namespace lovable-core  
kubectl create namespace lovable-previews  

### Apply configs
kubectl create secret generic app-secrets --from-env-file=.env  
kubectl apply -f k8s/configmaps/  

### Deploy databases
kubectl apply -f k8s/databases/  

### Deploy services
kubectl apply -f k8s/services/  

### Setup ingress
kubectl apply -f k8s/ingress.yaml  

---

## 🔄 CI/CD Pipeline

- GitHub Actions
- OIDC authentication (no static keys)
- Docker images built using Jib
- Kubernetes rolling updates

Example:

kubectl set image deployment/account-service account-service=image:tag  

---

## ⚙️ Tech Stack

### Backend
- Java 17
- Spring Boot
- Spring Cloud
- Spring Security

### Frontend
- React
- Tailwind CSS

### Infrastructure
- Docker
- Kubernetes (GKE)

### Messaging
- Kafka

### Storage
- PostgreSQL
- MinIO
- Redis

### AI
- OpenAI (Spring AI)

---

## ✨ Features

### Core
- AI code generation
- File management
- Live preview
- Chat-based development
- Multi-user collaboration

### Advanced
- Stripe billing
- Quota management
- Rate limiting
- Usage tracking
- Distributed tracing

---

## 👨‍💻 Author

Md Irfan  
Software Engineer | Java | Microservices | AI  

---

## ⭐ Support

If you like this project:

- Star the repo  
- Fork it  
- Share it  

---

## 📜 License

MIT License