# MusicStream – Cloud-Native Music Streaming Platform

A microservices-based music streaming platform built around service separation, independent data ownership, distributed caching, and adaptive audio streaming.

## Overview

MusicStream covers the design, implementation, deployment, and operation of a microservices-based music streaming platform. The central challenge is coordinating independent services and their data while maintaining efficient audio delivery, personalized music discovery, and reliable content management across the platform.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
  - [For Users](#for-users)
  - [For Artists](#for-artists)
  - [For Administrators](#for-administrators)
  - [Audio Player Features](#audio-player-features)
  - [Visualizer Features](#visualizer-features)
  - [Platform Capabilities](#platform-capabilities)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
  - [Frontend](#frontend)
  - [Backend](#backend)
  - [DevOps & Infrastructure](#devops--infrastructure)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Environment Setup](#environment-setup)
  - [Run with Docker Compose](#run-with-docker-compose-development)
  - [Run Locally](#run-locally-development)
- [Production Deployment](#production-deployment-kubernetes)
  - [Quick Setup with Script](#quick-setup-with-script)
  - [Manual Deployment](#manual-deployment)
  - [CI/CD Pipeline](#cicd-pipeline)
- [Configuration](#configuration)
  - [Frontend Environment Variables](#frontend-environment-variables)
  - [Backend Environment Variables](#backend-environment-variables)
  - [GitHub Secrets](#github-secrets-for-cicd)
- [API Documentation](#api-documentation)
  - [Authentication](#authentication)
  - [Main Endpoints](#main-endpoints)
- [Monitoring & Health Checks](#monitoring--health-checks)
  - [Service Health](#service-health)
  - [Aggregated Health](#aggregated-health)
  - [Production Monitoring](#production-monitoring)
- [Security](#security)
- [DevOps Features](#devops-features)
  - [Horizontal Pod Autoscaling](#horizontal-pod-autoscaling-hpa)
  - [Rolling Updates](#rolling-updates)
  - [Health Probes](#health-probes)
  - [Monitoring Stack](#monitoring-stack)
- [Documentation](#documentation)
- [Development Workflow](#development-workflow)
  - [Local Development](#local-development)
  - [Deploy to Production](#deploy-to-production)
  - [Rollback](#rollback-if-needed)
- [Troubleshooting](#troubleshooting)
  - [Check Pod Status](#check-pod-status)
  - [Check Service Endpoints](#check-service-endpoints)
  - [View Events](#view-events)
  - [Common Issues](#common-issues)
- [Contributing](#contributing)
- [License](#license)

## Key Features

### For Users

- Authentication with Clerk (Sign In/Sign Up)
- Browse and stream public songs and albums
- AI-powered personalized recommendations via Recombee
- Trending songs feed
- Similar songs discovery
- Real-time audio visualization (Bars, Wave, Circular)
- Create and manage private playlists
- Add/remove songs to/from playlists
- Search songs and albums
- Queue management + Shuffle + Repeat
- Fullscreen visualizer mode with dynamic colors
- View and edit user profile

### For Artists

- Upload songs (image + audio via Cloudinary)
- Create public/private albums
- Edit/remove songs and albums
- Toggle visibility (public/private)
- Artist dashboard with statistics
- Track performance metrics

### For Administrators

- User management (list, block/unblock, delete, change roles)
- Song management (toggle visible/hidden)
- Album management (toggle visible/hidden)
- Admin dashboard with tabs
- Content moderation tools
- System analytics

### Audio Player Features

- Play/Pause + Next/Previous
- Seek bar with time display
- Volume control
- Queue management UI
- Now Playing metadata
- Audio Visualization (3 modes)
- Adaptive streaming quality (network-aware)
- Manual quality control (64/128/320 kbps)
- Smart AI recommendations while listening
- Playback analytics (play, complete, skip)

### Visualizer Features

- Dynamic color extraction from album art
- Gradient backgrounds and immersive animations
- Real-time frequency bars and waveforms
- Auto-hide player controls
- Keyboard shortcuts:
  - Space → Play/Pause
  - Esc → Exit fullscreen
- Spinning vinyl animation
- 3 Visualization Types:
  - Bars
  - Wave
  - Circular

### Platform Capabilities

- Smart Caching with Redis (5–10 min TTL)
- RBAC Roles: User / Artist / Admin
- AI personalized recommendations
- Adaptive streaming (Cloudinary + Web APIs)
- Microservices communication via API Gateway
- CI/CD Pipeline with GitHub Actions
- Auto-deployment to DigitalOcean Kubernetes
- Zero-downtime deployments with auto-rollback

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│          • Adaptive Streaming • Audio Visualization          │
│          • Smart Recommendations • Dynamic Theming           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  API Gateway (Port 3000)                     │
│              • Request Routing • Health Checks               │
└──────┬──────────────────┬──────────────────┬────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ User Service │  │ Song Service │  │Album Service │
│  Port 3001   │  │  Port 3002   │  │  Port 3003   │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │
       ┌─────────────────┴────────────────┐
       ▼                                  ▼
┌──────────────┐                  ┌──────────────┐
│ MongoDB Atlas│                  │ Redis Cloud  │
│ • users_db   │                  │ • Caching    │
│ • songs_db   │                  │ • TTL 5-10m  │
│ • albums_db  │                  │              │
└──────────────┘                  └──────────────┘

External Services:
- Clerk (Authentication)
- Cloudinary (Media Storage & Adaptive Streaming)
- Recombee (AI Recommendations)

CI/CD Pipeline:
GitHub Actions → Build & Test → Docker Build → DigitalOcean Registry → K8s Deploy
```

## Technology Stack

### Frontend

- React 18.2 with Vite 5
- React Router v6.20
- Zustand 4.4 (State Management)
- TailwindCSS 3.3
- Clerk 4.30 (Authentication)
- Axios 1.6
- Web Audio API
- Lucide React 0.294

### Backend

- Node.js with Express
- MongoDB with Mongoose
- Redis for caching
- Clerk SDK for authentication
- Cloudinary for media storage
- Recombee for recommendations
- Multer for file uploads

### DevOps & Infrastructure

- **Deployment**: DigitalOcean Kubernetes (DOKS)
- **Container Registry**: DigitalOcean Container Registry
- **Orchestration**: Kubernetes with HPA (Horizontal Pod Autoscaling)
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana
- **SSL/TLS**: cert-manager with Let's Encrypt
- **Ingress**: NGINX Ingress Controller

## Project Structure

```text
music-stream/
├── .github/
│   └── workflows/
│       └── backend-cicd.yml          # CI/CD Pipeline
│
├── frontend-ui/                       # React frontend application
│   ├── src/
│   │   ├── components/               # React components
│   │   ├── pages/                    # Page components
│   │   ├── services/                 # API services
│   │   ├── store/                    # Zustand stores
│   │   ├── hooks/                    # Custom hooks
│   │   └── contexts/                 # React contexts
│   ├── Dockerfile
│   └── package.json
│
├── backend-microservices/             # Microservices backend
│   ├── user-service/                 # User management
│   ├── song-service/                 # Song management & recommendations
│   ├── album-service/                # Album/playlist management
│   ├── api-gateway/                  # API gateway & routing
│   ├── k8s/                          # Kubernetes manifests
│   │   ├── namespace.yaml
│   │   ├── secrets.yaml
│   │   ├── *-deployment.yaml
│   │   ├── prometheus.yaml
│   │   ├── grafana.yaml
│   │   ├── ingress.yaml
│   │   └── letsencrypt-issuer.yaml
│   ├── scripts/
│   │   └── quick-setup.sh            # Quick setup script
│   └── docker-compose.yml
│
├── docs/
│   └── CICD-SETUP-GUIDE.md           # Complete CI/CD setup guide
│
├── .gitignore
└── README.md                         # This file
```

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- kubectl (for Kubernetes deployment)
- doctl (DigitalOcean CLI)
- MongoDB Atlas account
- Redis Cloud account
- Clerk account
- Cloudinary account
- Recombee account (optional)
- DigitalOcean account (for production deployment)

### Environment Setup

**1. Clone the repository:**

```bash
git clone <repository-url>
cd music-stream
```

**2. Setup Frontend:**

```bash
cd frontend-ui
cp .env.example .env
# Edit .env with your credentials
npm install
```

**3. Setup Backend:**

```bash
cd backend-microservices
cp .env.example .env
# Edit .env with your credentials
```

### Run with Docker Compose (Development)

```bash
cd backend-microservices
docker-compose up -d
```

Services will be available at:

- Frontend: http://localhost:5173
- API Gateway: http://localhost:3000
- User Service: http://localhost:3001
- Song Service: http://localhost:3002
- Album Service: http://localhost:3003

### Run Locally (Development)

**Terminal 1 – Frontend:**

```bash
cd frontend-ui
npm run dev
```

**Terminal 2 – User Service:**

```bash
cd backend-microservices/user-service
npm run dev
```

**Terminal 3 – Song Service:**

```bash
cd backend-microservices/song-service
npm run dev
```

**Terminal 4 – Album Service:**

```bash
cd backend-microservices/album-service
npm run dev
```

**Terminal 5 – API Gateway:**

```bash
cd backend-microservices/api-gateway
npm run dev
```

## Production Deployment (Kubernetes)

### Quick Setup with Script

```bash
cd backend-microservices

# Make script executable
chmod +x scripts/quick-setup.sh

# Run automated setup
./scripts/quick-setup.sh
```

The script will:

- Check prerequisites (kubectl, doctl)
- Authenticate with DigitalOcean
- Connect to your Kubernetes cluster
- Create namespace and secrets
- Install Ingress Controller
- Install cert-manager
- Get LoadBalancer IP

### Manual Deployment

See detailed instructions in [CI/CD Setup Guide](./docs/CICD-SETUP-GUIDE.md).

### CI/CD Pipeline

The project includes automated CI/CD pipeline that:

1. **Build & Test** – Tests all microservices
2. **Docker Build** – Builds and tags images
3. **Push to Registry** – Pushes to DigitalOcean Registry
4. **Deploy to K8s** – Deploys to Kubernetes cluster
5. **Auto Rollback** – Rolls back on failure

**Trigger Deployment:**

```bash
git add .
git commit -m "feat: your changes"
git push origin main
```

**Monitor Deployment:**

- Go to GitHub → Actions tab
- Watch the pipeline execution
- Check deployment logs

## Configuration

### Frontend Environment Variables

```env
VITE_API_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

### Backend Environment Variables

```env
# MongoDB
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net

# Redis
REDIS_URL=redis://user:pass@redis-cloud.com:port

# Clerk
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Recombee (Optional)
RECOMBEE_DATABASE_ID=your_database_id
RECOMBEE_PRIVATE_TOKEN=your_private_token
RECOMBEE_REGION=us-west
```

### GitHub Secrets (for CI/CD)

Add these secrets in GitHub Repository Settings:

```text
DIGITALOCEAN_ACCESS_TOKEN
MONGODB_USERS_URI
MONGODB_SONGS_URI
MONGODB_ALBUMS_URI
REDIS_URL
CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
RECOMBEE_DATABASE_ID (optional)
RECOMBEE_PRIVATE_TOKEN (optional)
RECOMBEE_REGION (optional)
```

## API Documentation

### Authentication

All authenticated requests require Clerk JWT token in headers:

```http
Authorization: Bearer <token>
```

### Main Endpoints

**Songs:**

- `GET /api/songs` – List all public songs
- `GET /api/songs/trending` – Get trending songs
- `GET /api/songs/:id/similar` – Get similar songs
- `GET /api/songs/recommendations/for-you` – Personalized recommendations
- `POST /api/songs` – Upload song (Artist)
- `POST /api/songs/:id/track/play` – Track play interaction

**Albums:**

- `GET /api/albums` – List all public albums
- `GET /api/albums/:id` – Get album with songs
- `POST /api/albums` – Create album/playlist
- `POST /api/albums/:id/songs` – Add song to album

**Admin:**

- `GET /api/admin/users` – List all users
- `PATCH /api/admin/users/:id/block` – Block/unblock user
- `GET /api/admin/songs` – List all songs
- `PATCH /api/admin/songs/:id/visible` – Toggle visibility

For complete API documentation, see [Backend README](./backend-microservices/README.md).

## Monitoring & Health Checks

### Service Health

Each service exposes a `/health` endpoint:

```bash
curl http://localhost:3001/health  # User Service
curl http://localhost:3002/health  # Song Service
curl http://localhost:3003/health  # Album Service
```

### Aggregated Health

API Gateway provides consolidated health status:

```bash
curl http://localhost:3000/health/services
```

### Production Monitoring

Access Grafana dashboard:

```text
URL: https://grafana.YOUR_IP.nip.io
Username: admin
Password: admin123
```

View metrics:

- Request rates
- Response times
- Error rates
- Resource usage (CPU, Memory)
- Pod status

## Security

- JWT-based authentication via Clerk
- Role-based access control (RBAC)
- CORS configured for trusted origins
- Secrets managed via Kubernetes Secrets
- HTTPS enforced in production
- Input validation and sanitization
- Non-root containers
- Security contexts in Kubernetes

## DevOps Features

### Horizontal Pod Autoscaling (HPA)

- Auto-scales based on CPU/Memory usage
- Min replicas: 1
- Max replicas: 8–15 (depends on service)
- Target CPU: 70%
- Target Memory: 75–80%

### Rolling Updates

- Zero-downtime deployments
- maxSurge: 1–2 pods
- maxUnavailable: 0
- Gradual rollout

### Health Probes

- **Liveness**: Restart unhealthy pods
- **Readiness**: Remove pod from service if not ready
- **Startup**: Give pod time to start

### Monitoring Stack

- **Prometheus**: Metrics collection
- **Grafana**: Visualization dashboards
- Real-time metrics and alerts

## Documentation

- [Backend README](./backend-microservices/README.md) – Microservices documentation
- [CI/CD Setup Guide](./docs/CICD-SETUP-GUIDE.md) – Complete deployment guide
- [Frontend README](./frontend-ui/README.md) – React app documentation

## Development Workflow

### Local Development

```bash
# 1. Make changes to code

# 2. Test locally with docker-compose
docker-compose up -d

# 3. Verify changes
curl http://localhost:3000/health/services
```

### Deploy to Production

```bash
# 1. Commit changes
git add .
git commit -m "feat: your feature"

# 2. Push to trigger CI/CD
git push origin main

# 3. Monitor deployment
# - Check GitHub Actions
# - Watch kubectl get pods -n music-stream -w
```

### Rollback if Needed

```bash
# Manual rollback
kubectl rollout undo deployment/song-service -n music-stream

# Or CI/CD auto-rollback on failure
```

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods -n music-stream
kubectl describe pod <pod-name> -n music-stream
kubectl logs <pod-name> -n music-stream
```

### Check Service Endpoints

```bash
kubectl get svc -n music-stream
kubectl get ingress -n music-stream
```

### View Events

```bash
kubectl get events -n music-stream --sort-by='.lastTimestamp'
```

### Common Issues

**ImagePullBackOff**: Check registry credentials.

```bash
kubectl delete secret regcred -n music-stream
# Recreate secret with correct credentials
```

**CrashLoopBackOff**: Check pod logs.

```bash
kubectl logs <pod-name> -n music-stream --previous
```

**Service Unavailable**: Check ingress and service.

```bash
kubectl describe ingress music-stream-ingress -n music-stream
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License
