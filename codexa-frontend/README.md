# Codexa AI

AI‑powered project workspace with real‑time chat, live code updates, file tree navigation, and project collaboration.

## ✨ Frontend features

- **Project dashboard** with searchable cards and live thumbnails
- **Smart project icons** (consistent per project name)
- **Real‑time chat** with streaming responses
- **Structured events** (Thought, Tool, File Edit, Message)
- **Live file updates** (code editor updates as the response completes)
- **Auto‑refresh file tree** when new files appear
- **Resizable panels** for chat, code, and preview
- **Preview panel** with runtime error capture
- **Share dialog** with role management
- **Project members** management (owner, editor, viewer)
- **Authentication flow** (login/signup)

## Quick start

1) Install dependencies:
	 npm i
2) Start the frontend:
	 npm run dev

## Environment

Create or update [.env](.env):

VITE_API_URL=http://localhost:8080

If you use Unsplash thumbnails (optional):

VITE_UNSPLASH_ACCESS_KEY=YOUR_ACCESS_KEY

## Connect the backend

This frontend talks to a Spring Boot backend at VITE_API_URL (default: http://localhost:8080).
Make sure the backend is running before using the app.

### Authentication

Login to get a JWT token:

POST /api/auth/login
{
	"username": "user@example.com",
	"password": "your_password"
}

Signup:

POST /api/auth/signup
{
	"username": "user@example.com",
	"name": "Your Name",
	"password": "your_password"
}

Include the token on all protected routes:

Authorization: Bearer <token>

### Core API endpoints (OpenAPI summary)

Projects
- GET /api/projects
- POST /api/projects
- GET /api/projects/{id}
- PATCH /api/projects/{id}
- DELETE /api/projects/{id}

Project files
- GET /api/projects/{projectId}/files
- GET /api/projects/{projectId}/files/content?path=...

Chat
- GET /api/chat/projects/{projectId}
- POST /api/chat/stream (SSE)

Project members
- GET /api/projects/{projectId}/members
- POST /api/projects/{projectId}/members
- PATCH /api/projects/{projectId}/members/{memberId}
- DELETE /api/projects/{projectId}/members/{memberId}

Billing
- GET /
- POST /api/payments/checkout
- POST /api/payments/portal
- GET /api/me/subscription
- POST /webhooks/payment (requires Stripe-Signature header)

## Streaming chat (SSE)

Endpoint:
POST /api/chat/stream

Request body:
{
	"message": "Build a todo app",
	"projectId": 1
}

Response: text/event-stream with JSON payloads containing:
{ "text": "..." }

## Tech stack

- Vite
- React + TypeScript
- shadcn-ui
- Tailwind CSS

## Troubleshooting

- If the frontend can’t reach the backend, confirm VITE_API_URL and that the backend is running.
- If SSE disconnects, increase backend timeouts and ensure the stream completes cleanly.
