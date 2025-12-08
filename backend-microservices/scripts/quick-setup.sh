#!/bin/bash

# Quick Setup Script for Music Stream CI/CD
# Tự động hóa quá trình setup CI/CD pipeline

set -e

echo "🎵 Music Stream CI/CD Setup Script"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

check_command() {
    if command -v $1 &> /dev/null; then
        print_success "$1 is installed"
        return 0
    else
        print_error "$1 is not installed"
        return 1
    fi
}

# Check prerequisites
echo "Checking prerequisites..."
echo ""

MISSING_DEPS=0

if ! check_command kubectl; then
    print_warning "Install kubectl: https://kubernetes.io/docs/tasks/tools/"
    MISSING_DEPS=1
fi

if ! check_command doctl; then
    print_warning "Install doctl: https://docs.digitalocean.com/reference/doctl/how-to/install/"
    MISSING_DEPS=1
fi

if ! check_command git; then
    print_warning "Install git: https://git-scm.com/downloads"
    MISSING_DEPS=1
fi

echo ""

if [ $MISSING_DEPS -eq 1 ]; then
    print_error "Please install missing dependencies first"
    exit 1
fi

# DigitalOcean Authentication
echo "=================================="
echo "Step 1: DigitalOcean Authentication"
echo "=================================="
echo ""

if [ -z "$DIGITALOCEAN_ACCESS_TOKEN" ]; then
    print_info "DIGITALOCEAN_ACCESS_TOKEN not found in environment"
    echo -n "Enter your DigitalOcean Personal Access Token: "
    read -s DIGITALOCEAN_ACCESS_TOKEN
    echo ""
fi

# Authenticate with doctl
doctl auth init -t $DIGITALOCEAN_ACCESS_TOKEN > /dev/null 2>&1
if [ $? -eq 0 ]; then
    print_success "DigitalOcean authentication successful"
else
    print_error "DigitalOcean authentication failed"
    exit 1
fi

echo ""

# List and select cluster
echo "=================================="
echo "Step 2: Select Kubernetes Cluster"
echo "=================================="
echo ""

CLUSTERS=$(doctl kubernetes cluster list --format Name --no-header)

if [ -z "$CLUSTERS" ]; then
    print_error "No Kubernetes clusters found"
    print_info "Create a cluster at: https://cloud.digitalocean.com/kubernetes/clusters"
    exit 1
fi

echo "Available clusters:"
select CLUSTER_NAME in $CLUSTERS; do
    if [ -n "$CLUSTER_NAME" ]; then
        print_success "Selected cluster: $CLUSTER_NAME"
        break
    fi
done

echo ""

# Connect to cluster
echo "=================================="
echo "Step 3: Connect to Cluster"
echo "=================================="
echo ""

doctl kubernetes cluster kubeconfig save $CLUSTER_NAME
print_success "Cluster connection configured"

# Verify connection
kubectl cluster-info > /dev/null 2>&1
if [ $? -eq 0 ]; then
    print_success "Cluster connection verified"
else
    print_error "Failed to connect to cluster"
    exit 1
fi

echo ""

# Collect secrets
echo "=================================="
echo "Step 4: Configure Secrets"
echo "=================================="
echo ""

print_info "Please provide the following information:"
echo ""

# MongoDB
echo "MongoDB Configuration:"
read -p "Users DB URI: " MONGODB_USERS_URI
read -p "Songs DB URI: " MONGODB_SONGS_URI
read -p "Albums DB URI: " MONGODB_ALBUMS_URI
echo ""

# Redis
echo "Redis Configuration:"
read -p "Redis URL: " REDIS_URL
echo ""

# Clerk
echo "Clerk Configuration:"
read -p "Secret Key: " CLERK_SECRET_KEY
read -p "Publishable Key: " CLERK_PUBLISHABLE_KEY
echo ""

# Cloudinary
echo "Cloudinary Configuration:"
read -p "Cloud Name: " CLOUDINARY_CLOUD_NAME
read -p "API Key: " CLOUDINARY_API_KEY
read -p "API Secret: " CLOUDINARY_API_SECRET
echo ""

# Recombee (optional)
echo "Recombee Configuration (Optional - press Enter to skip):"
read -p "Database ID: " RECOMBEE_DATABASE_ID
read -p "Private Token: " RECOMBEE_PRIVATE_TOKEN
read -p "Region (default: ap-se): " RECOMBEE_REGION
RECOMBEE_REGION=${RECOMBEE_REGION:-ap-se}
echo ""

# Create namespace
echo "=================================="
echo "Step 5: Create Namespace"
echo "=================================="
echo ""

kubectl create namespace music-stream --dry-run=client -o yaml | kubectl apply -f - > /dev/null 2>&1
print_success "Namespace 'music-stream' created/updated"

echo ""

# Create secrets
echo "=================================="
echo "Step 6: Create Kubernetes Secrets"
echo "=================================="
echo ""

# MongoDB Secret
kubectl create secret generic mongodb-secret \
  --from-literal=users-db-uri="$MONGODB_USERS_URI" \
  --from-literal=songs-db-uri="$MONGODB_SONGS_URI" \
  --from-literal=albums-db-uri="$MONGODB_ALBUMS_URI" \
  --namespace=music-stream \
  --dry-run=client -o yaml | kubectl apply -f - > /dev/null 2>&1
print_success "MongoDB secret created"

# Redis Secret
kubectl create secret generic redis-secret \
  --from-literal=url="$REDIS_URL" \
  --namespace=music-stream \
  --dry-run=client -o yaml | kubectl apply -f - > /dev/null 2>&1
print_success "Redis secret created"

# Clerk Secret
kubectl create secret generic clerk-secret \
  --from-literal=secret-key="$CLERK_SECRET_KEY" \
  --from-literal=publishable-key="$CLERK_PUBLISHABLE_KEY" \
  --namespace=music-stream \
  --dry-run=client -o yaml | kubectl apply -f - > /dev/null 2>&1
print_success "Clerk secret created"

# Cloudinary Secret
kubectl create secret generic cloudinary-secret \
  --from-literal=cloud-name="$CLOUDINARY_CLOUD_NAME" \
  --from-literal=api-key="$CLOUDINARY_API_KEY" \
  --from-literal=api-secret="$CLOUDINARY_API_SECRET" \
  --namespace=music-stream \
  --dry-run=client -o yaml | kubectl apply -f - > /dev/null 2>&1
print_success "Cloudinary secret created"

# Recombee Secret (if provided)
if [ -n "$RECOMBEE_DATABASE_ID" ]; then
  kubectl create secret generic recombee-secret \
    --from-literal=database-id="$RECOMBEE_DATABASE_ID" \
    --from-literal=private-token="$RECOMBEE_PRIVATE_TOKEN" \
    --from-literal=region="$RECOMBEE_REGION" \
    --namespace=music-stream \
    --dry-run=client -o yaml | kubectl apply -f - > /dev/null 2>&1
  print_success "Recombee secret created"
fi

# Docker Registry Secret
kubectl create secret docker-registry regcred \
  --docker-server=registry.digitalocean.com \
  --docker-username=$DIGITALOCEAN_ACCESS_TOKEN \
  --docker-password=$DIGITALOCEAN_ACCESS_TOKEN \
  --namespace=music-stream \
  --dry-run=client -o yaml | kubectl apply -f - > /dev/null 2>&1
print_success "Docker registry secret created"

echo ""

# Install Ingress Controller
echo "=================================="
echo "Step 7: Install Ingress Controller"
echo "=================================="
echo ""

# Check if ingress-nginx exists
if kubectl get namespace ingress-nginx > /dev/null 2>&1; then
    print_warning "Ingress controller already installed"
else
    print_info "Installing NGINX Ingress Controller..."
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/cloud/deploy.yaml > /dev/null 2>&1
    print_success "Ingress controller installed"
    
    print_info "Waiting for ingress controller to be ready..."
    kubectl wait --namespace ingress-nginx \
      --for=condition=ready pod \
      --selector=app.kubernetes.io/component=controller \
      --timeout=300s > /dev/null 2>&1
    print_success "Ingress controller is ready"
fi

echo ""

# Install cert-manager
echo "=================================="
echo "Step 8: Install cert-manager"
echo "=================================="
echo ""

if kubectl get namespace cert-manager > /dev/null 2>&1; then
    print_warning "cert-manager already installed"
else
    print_info "Installing cert-manager..."
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.yaml > /dev/null 2>&1
    print_success "cert-manager installed"
    
    print_info "Waiting for cert-manager to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager > /dev/null 2>&1
    print_success "cert-manager is ready"
fi

echo ""

# Get LoadBalancer IP
echo "=================================="
echo "Step 9: Get LoadBalancer IP"
echo "=================================="
echo ""

print_info "Waiting for LoadBalancer IP..."
sleep 10

LOAD_BALANCER_IP=""
for i in {1..30}; do
    LOAD_BALANCER_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
    if [ -n "$LOAD_BALANCER_IP" ]; then
        break
    fi
    sleep 5
done

if [ -n "$LOAD_BALANCER_IP" ]; then
    print_success "LoadBalancer IP: $LOAD_BALANCER_IP"
else
    print_error "Failed to get LoadBalancer IP"
    print_info "Check manually: kubectl get svc -n ingress-nginx"
fi

echo ""

# GitHub Secrets Summary
echo "=================================="
echo "Step 10: GitHub Secrets Summary"
echo "=================================="
echo ""

print_info "Add these secrets to your GitHub repository:"
echo ""
echo "Repository → Settings → Secrets and variables → Actions"
echo ""
echo "DIGITALOCEAN_ACCESS_TOKEN: ********"
echo "MONGODB_USERS_URI: $MONGODB_USERS_URI"
echo "MONGODB_SONGS_URI: $MONGODB_SONGS_URI"
echo "MONGODB_ALBUMS_URI: $MONGODB_ALBUMS_URI"
echo "REDIS_URL: $REDIS_URL"
echo "CLERK_SECRET_KEY: $CLERK_SECRET_KEY"
echo "CLERK_PUBLISHABLE_KEY: $CLERK_PUBLISHABLE_KEY"
echo "CLOUDINARY_CLOUD_NAME: $CLOUDINARY_CLOUD_NAME"
echo "CLOUDINARY_API_KEY: $CLOUDINARY_API_KEY"
echo "CLOUDINARY_API_SECRET: $CLOUDINARY_API_SECRET"

if [ -n "$RECOMBEE_DATABASE_ID" ]; then
    echo "RECOMBEE_DATABASE_ID: $RECOMBEE_DATABASE_ID"
    echo "RECOMBEE_PRIVATE_TOKEN: $RECOMBEE_PRIVATE_TOKEN"
    echo "RECOMBEE_REGION: $RECOMBEE_REGION"
fi

echo ""

# DNS Configuration
echo "=================================="
echo "Step 11: DNS Configuration"
echo "=================================="
echo ""

if [ -n "$LOAD_BALANCER_IP" ]; then
    print_info "Update your ingress.yaml with:"
    echo ""
    echo "  - host: api.$LOAD_BALANCER_IP.nip.io"
    echo "  - host: grafana.$LOAD_BALANCER_IP.nip.io"
    echo ""
    print_info "Or configure custom domain A records:"
    echo "  api.yourdomain.com → $LOAD_BALANCER_IP"
    echo "  grafana.yourdomain.com → $LOAD_BALANCER_IP"
fi

echo ""

# Summary
echo "=================================="
echo "✅ Setup Complete!"
echo "=================================="
echo ""

print_success "Kubernetes cluster configured"
print_success "Secrets created"
print_success "Ingress controller installed"
print_success "cert-manager installed"

echo ""
print_info "Next steps:"
echo "1. Update ingress.yaml with your domain"
echo "2. Add GitHub secrets"
echo "3. Create .github/workflows/backend-cicd.yml"
echo "4. Push to main branch to trigger CI/CD"
echo ""

print_info "Verify cluster status:"
echo "kubectl get all -n music-stream"
echo ""

print_info "Monitor deployments:"
echo "kubectl get pods -n music-stream -w"
echo ""

print_info "Access services:"
if [ -n "$LOAD_BALANCER_IP" ]; then
    echo "API: https://api.$LOAD_BALANCER_IP.nip.io"
    echo "Grafana: https://grafana.$LOAD_BALANCER_IP.nip.io"
fi

echo ""
echo "🎉 Happy deploying!"