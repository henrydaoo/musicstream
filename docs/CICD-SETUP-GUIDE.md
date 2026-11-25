# CI/CD Setup Guide – DigitalOcean Kubernetes

## Prerequisites

1. **GitHub Repository** containing your project code.
2. **DigitalOcean Account** with:
   - A Kubernetes Cluster already created.
   - A Container Registry already created.
   - A Personal Access Token.
3. **Required Services:**
   - MongoDB Atlas
   - Redis Cloud
   - Clerk Account
   - Cloudinary Account
   - Recombee Account (optional)

## Step-by-Step Setup

### Step 1: Create DigitalOcean Resources

#### 1.1 Create a Kubernetes Cluster

```bash
# Via DigitalOcean Dashboard:
# 1. Click "Create" → "Kubernetes"
# 2. Select a region closest to your users
# 3. Choose a node plan (Basic: $12/month or Professional)
# 4. Name the cluster: music-stream-cluster
# 5. Click "Create Cluster"
```

#### 1.2 Create a Container Registry

```bash
# Via DigitalOcean Dashboard:
# 1. Click "Create" → "Container Registry"
# 2. Choose a plan (Basic: $5/month for 500MB)
# 3. Name the registry: musicstream
# 4. Click "Create Registry"
```

#### 1.3 Create a Personal Access Token

```bash
# 1. Click your Avatar → API
# 2. Click "Generate New Token"
# 3. Name the token: github-actions-cicd
# 4. Select scopes: read, write
# 5. Copy the token (it will only be displayed once!)
```

### Step 2: Configure GitHub Secrets

Navigate to:

GitHub Repository → Settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

#### DigitalOcean

```text
DIGITALOCEAN_ACCESS_TOKEN: <your_do_access_token>
```

#### MongoDB

```text
MONGODB_USERS_URI: mongodb+srv://user:pass@cluster.mongodb.net/users_db?retryWrites=true&w=majority
MONGODB_SONGS_URI: mongodb+srv://user:pass@cluster.mongodb.net/songs_db?retryWrites=true&w=majority
MONGODB_ALBUMS_URI: mongodb+srv://user:pass@cluster.mongodb.net/albums_db?retryWrites=true&w=majority
```

#### Redis

```text
REDIS_URL: redis://default:password@redis-host:port
```

#### Clerk

```text
CLERK_SECRET_KEY: sk_test_xxxxxxxxxxxxxxxxxxxxx
CLERK_PUBLISHABLE_KEY: pk_test_xxxxxxxxxxxxxxxxxxxxx
```

#### Cloudinary

```text
CLOUDINARY_CLOUD_NAME: your_cloud_name
CLOUDINARY_API_KEY: your_api_key
CLOUDINARY_API_SECRET: your_api_secret
```

#### Recombee (Optional)

```text
RECOMBEE_DATABASE_ID: musicstream-dev
RECOMBEE_PRIVATE_TOKEN: your_private_token
RECOMBEE_REGION: ap-se
```

### Step 3: Add GitHub Actions Workflow

Create the `.github/workflows/backend-cicd.yml` file using the content from the CI/CD Pipeline artifact.

### Step 4: Set Up Dockerfiles for Each Service

Ensure that each service has its own Dockerfile. Below is an example for `user-service`:

```dockerfile
# backend-microservices/user-service/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app .

USER node

EXPOSE 3001

CMD ["node", "src/app.js"]
```

### Step 5: Install DigitalOcean CLI (Local Testing)

```bash
# macOS
brew install doctl

# Linux
cd ~
wget https://github.com/digitalocean/doctl/releases/download/v1.98.1/doctl-1.98.1-linux-amd64.tar.gz
tar xf doctl-1.98.1-linux-amd64.tar.gz
sudo mv doctl /usr/local/bin

# Authenticate
doctl auth init
# Paste your Personal Access Token

# Verify
doctl account get
```

### Step 6: Connect to the Kubernetes Cluster (Local)

```bash
# List clusters
doctl kubernetes cluster list

# Download kubeconfig
doctl kubernetes cluster kubeconfig save music-stream-cluster

# Verify connection
kubectl cluster-info
kubectl get nodes
```

### Step 7: Perform Initial Manual Deployment (First Time)

```bash
cd backend-microservices

# Create namespace
kubectl apply -f k8s/namespace.yaml

# Create secrets manually (first time)
kubectl apply -f k8s/secrets.yaml

# Deploy cert-manager for SSL
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.yaml

# Wait for cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager

# Deploy Let's Encrypt issuer
kubectl apply -f k8s/letsencrypt-issuer.yaml

# Deploy all services
kubectl apply -f k8s/user-service-deployment.yaml
kubectl apply -f k8s/song-service-deployment.yaml
kubectl apply -f k8s/album-service-deployment.yaml
kubectl apply -f k8s/api-gateway-deployment.yaml

# Deploy monitoring
kubectl apply -f k8s/prometheus.yaml
kubectl apply -f k8s/grafana.yaml

# Deploy ingress
kubectl apply -f k8s/ingress.yaml

# Wait for deployments
kubectl wait --for=condition=available --timeout=300s \
  deployment/user-service \
  deployment/song-service \
  deployment/album-service \
  deployment/api-gateway \
  -n music-stream

# Check status
kubectl get all -n music-stream
```

### Step 8: Configure DNS (nip.io or Custom Domain)

#### Option A: Using nip.io (Free, for Testing)

```bash
# Get LoadBalancer IP
kubectl get svc -n ingress-nginx

# Update ingress.yaml with the IP
# api.YOUR_IP.nip.io
# grafana.YOUR_IP.nip.io
```

#### Option B: Using a Custom Domain

```bash
# Get LoadBalancer IP
LOAD_BALANCER_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Add DNS A records:
# api.yourdomain.com → LOAD_BALANCER_IP
# grafana.yourdomain.com → LOAD_BALANCER_IP
```

### Step 9: Trigger the First CI/CD Deployment

```bash
# Commit and push your code
git add .
git commit -m "feat: setup CI/CD pipeline"
git push origin main

# Monitor the workflow in the GitHub Actions tab
```

### Step 10: Verify Deployment

```bash
# Check pods
kubectl get pods -n music-stream

# Check logs
kubectl logs -f deployment/api-gateway -n music-stream

# Check services
kubectl get svc -n music-stream

# Check ingress
kubectl get ingress -n music-stream

# Test API
curl https://api.YOUR_IP.nip.io/health/services
```

## Monitoring

### Access Grafana Dashboard

```text
URL: https://grafana.YOUR_IP.nip.io
Username: admin
Password: admin123
```

### View Logs

```bash
# Stream real-time logs for a service
kubectl logs -f deployment/song-service -n music-stream

# View logs for a specific pod
kubectl logs <pod-name> -n music-stream

# View logs for all pods
kubectl logs -l app=song-service -n music-stream
```

### Check Resource Usage

```bash
# CPU and Memory usage
kubectl top nodes
kubectl top pods -n music-stream

# HPA status
kubectl get hpa -n music-stream
```

## Common Operations

### Manual Rollback

```bash
# Roll back a deployment
kubectl rollout undo deployment/song-service -n music-stream

# Roll back to a specific revision
kubectl rollout undo deployment/song-service --to-revision=2 -n music-stream

# Check rollout history
kubectl rollout history deployment/song-service -n music-stream
```

### Scale Services Manually

```bash
# Scale up
kubectl scale deployment song-service --replicas=3 -n music-stream

# Scale down
kubectl scale deployment song-service --replicas=1 -n music-stream
```

### Update Secrets

```bash
# Update MongoDB URI
kubectl create secret generic mongodb-secret \
  --from-literal=songs-db-uri="new_uri" \
  --namespace=music-stream \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart deployment to apply the updated secret
kubectl rollout restart deployment/song-service -n music-stream
```

### Delete Everything

```bash
# Delete the namespace (removes all resources)
kubectl delete namespace music-stream

# Or delete resources individually
kubectl delete -f k8s/
```

## Troubleshooting

### Pods Fail to Start

```bash
# Check pod status
kubectl describe pod <pod-name> -n music-stream

# Check events
kubectl get events -n music-stream --sort-by='.lastTimestamp'

# Check logs
kubectl logs <pod-name> -n music-stream
```

### ImagePullBackOff Error

```bash
# Check the secret
kubectl get secret regcred -n music-stream -o yaml

# Recreate the secret
kubectl delete secret regcred -n music-stream
kubectl create secret docker-registry regcred \
  --docker-server=registry.digitalocean.com \
  --docker-username=$DIGITALOCEAN_TOKEN \
  --docker-password=$DIGITALOCEAN_TOKEN \
  --namespace=music-stream
```

### Service Is Not Accessible

```bash
# Check services
kubectl get svc -n music-stream

# Check endpoints
kubectl get endpoints -n music-stream

# Port-forward to test locally
kubectl port-forward svc/api-gateway 3000:80 -n music-stream
curl http://localhost:3000/health
```

### SSL Certificate Issues

```bash
# Check certificates
kubectl get certificate -n music-stream

# Inspect certificate details
kubectl describe certificate music-stream-tls -n music-stream

# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager
```

## Performance Optimization

### Enable HPA Metrics

```bash
# Install metrics server if it is not already installed
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

### Optimize Resource Requests and Limits

```yaml
# In deployment files
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"
```

## Security Best Practices

1. **Always use Secrets for sensitive data.**
2. **Enable RBAC for Kubernetes.**
3. **Run containers with non-root users.**
4. **Scan images before deployment.**
5. **Rotate credentials regularly.**
6. **Enable network policies.**
7. **Use SSL/TLS for all endpoints.**

## Tips & Tricks

### Fast Development Workflow

```bash
# Watch deployment changes
kubectl get pods -n music-stream -w

# Stream logs from multiple pods
kubectl logs -f -l app=song-service -n music-stream

# Quick restart
kubectl rollout restart deployment/song-service -n music-stream
```

### CI/CD Performance

- Use Docker layer caching.
- Build multiple services in parallel.
- Use artifact caching.
- Optimize Dockerfiles with multi-stage builds.

### Cost Optimization

- Use appropriately sized nodes.
- Enable cluster autoscaler.
- Set proper resource limits.
- Use spot instances for non-production environments.
- Monitor and adjust HPA thresholds.

## Additional Resources

- [DigitalOcean Kubernetes Documentation](https://docs.digitalocean.com/products/kubernetes/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [cert-manager Documentation](https://cert-manager.io/docs/)

## Support

If you encounter any issues:

1. Check GitHub Actions logs.
2. Check Kubernetes events: `kubectl get events -n music-stream`.
3. Check pod logs: `kubectl logs <pod-name> -n music-stream`.
4. Review the DigitalOcean dashboard.
5. Check service health: `curl https://api.YOUR_IP.nip.io/health/services`
