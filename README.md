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

## Render Free Tier Deployment

### Prerequisites
- Render account (free tier - no credit card required)
- GitHub repository connected to Render
- Basic environment variables configured

### Quick Start (Free Tier)

1. **Connect Repository**
   ```bash
   # Push your code to GitHub if not already done
   git add .
   git commit -m "Add Render free tier deployment configuration"
   git push origin main
   ```

2. **Create Render Environment Variables (Free Tier)**
   - `DATABASE_URL` - PostgreSQL connection URL (provided by Render)
   - `JWT_SECRET` - JWT signing secret (any random string)
   - `OPENAI_API_KEY` - OpenAI API key (optional, for AI features)

3. **Deploy to Render (Free)**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Sign up for free account (no credit card needed)
   - Click "New" -> "Blueprint"
   - Connect your GitHub repository
   - Render will automatically detect `render.yaml`
   - Configure the 3 environment variables above
   - Click "Apply"

### Free Tier Limitations

**What's Included Free:**
- 3 Private Services (microservices)
- 1 Web Service (frontend)
- 1 PostgreSQL Database (up to 256MB)
- 750 hours build time per month
- SSL certificates
- Custom domains

**What's Removed for Free Tier:**
- Redis cache (using in-memory caching instead)
- MinIO storage (using database for file storage)
- Kafka messaging (using direct API calls)
- Eureka service discovery (using direct URLs)
- Stripe integration (billing features disabled)

### Services Deployed (Free Tier)

#### Infrastructure
- **PostgreSQL** - Free Render PostgreSQL database

#### Microservices (3 of 6 for free tier)
- **API Gateway** - Request routing and load balancing
- **Account Service** - Authentication and user management
- **Intelligence Service** - AI processing (if OpenAI key provided)

#### Frontend
- **React App** - User interface with SPA routing

### Environment Configuration

#### Free Tier Setup
- Direct service-to-service communication
- Database-based file storage
- In-memory caching
- Simplified configuration management

### Service URLs (Free Tier)

After deployment, services will be available at:
- Frontend: `https://codexa-frontend.onrender.com`
- API Gateway: `https://codexa-api-gateway.onrender.com`
- Account Service: `https://codexa-account-service.onrender.com`
- Intelligence Service: `https://codexa-intelligence-service.onrender.com` (if deployed)

### Monitoring and Logs

- **Health Checks**: All services include `/actuator/health` endpoints
- **Logs**: Available in Render dashboard
- **Metrics**: Spring Boot Actuator endpoints
- **Alerts**: Configure in Render dashboard

### Scaling (Free Tier)

Free tier limitations:
- **Fixed Resources**: No automatic scaling on free tier
- **Manual Upgrade**: Upgrade to paid plans for scaling
- **Resource Limits**: 512MB RAM per service

### Troubleshooting (Free Tier)

#### Common Issues
1. **Database Connection**: Check `DATABASE_URL` environment variable
2. **Service Limits**: Free tier allows only 3 private services
3. **Build Time**: Limited to 750 hours per month
4. **Memory Issues**: Services limited to 512MB RAM

#### Debug Commands
```bash
# Check service logs
# Use Render dashboard to view logs

# Test health endpoints
curl https://codexa-api-gateway.onrender.com/actuator/health

# Test database connection
# Check DATABASE_URL format in Render dashboard
```

### Free Tier Benefits

- **No Credit Card Required**: Start completely free
- **Full Features**: Core functionality available
- **SSL Certificates**: Automatic HTTPS
- **Custom Domains**: Connect your domain
- **Always On**: Services stay running (with limits)

### When to Upgrade

Consider upgrading when:
- Need more than 3 microservices
- Require Redis caching
- Need file storage (MinIO)
- Want Kafka messaging
- Need higher memory/CPU
- Require zero-downtime deployments

### Security

- Environment variables for sensitive data
- SSL/TLS automatically configured
- Network isolation for private services
- Regular security updates

---

## License

MIT License