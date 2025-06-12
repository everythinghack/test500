# Google Cloud Run Deployment Guide

Google Cloud Run is perfect for your Telegram bot project. Here's the complete setup:

## Prerequisites
1. Google Cloud account with billing enabled
2. Google Cloud CLI installed: `gcloud --version`
3. Docker installed locally

## Step 1: Setup Google Cloud Project

```bash
# Login to Google Cloud
gcloud auth login

# Create new project (or use existing)
gcloud projects create bybit-telegram-bot --name="Bybit Telegram Bot"
gcloud config set project bybit-telegram-bot

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable sqladmin.googleapis.com
```

## Step 2: Create Cloud SQL PostgreSQL Database

```bash
# Create PostgreSQL instance
gcloud sql instances create bybit-db \
    --database-version=POSTGRES_14 \
    --tier=db-f1-micro \
    --region=us-central1

# Create database
gcloud sql databases create eventapp --instance=bybit-db

# Create database user
gcloud sql users create appuser \
    --instance=bybit-db \
    --password=your-secure-password

# Get connection string
gcloud sql instances describe bybit-db
```

## Step 3: Build and Deploy to Cloud Run

```bash
# Build container image
gcloud builds submit --tag gcr.io/PROJECT_ID/bybit-telegram-bot

# Deploy to Cloud Run
gcloud run deploy bybit-telegram-bot \
    --image gcr.io/PROJECT_ID/bybit-telegram-bot \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN \
    --set-env-vars DATABASE_URL="postgresql://appuser:your-secure-password@/eventapp?host=/cloudsql/PROJECT_ID:us-central1:bybit-db" \
    --add-cloudsql-instances PROJECT_ID:us-central1:bybit-db
```

## Step 4: One-Time Database Setup

After deployment, run the setup script once:

```bash
# Get the Cloud Run service URL
SERVICE_URL=$(gcloud run services describe bybit-telegram-bot --region=us-central1 --format="value(status.url)")

# Trigger database setup (one-time only)
curl "$SERVICE_URL/setup-database"
```

## Step 5: Environment Variables Setup

```bash
# Set environment variables
gcloud run services update bybit-telegram-bot \
    --region=us-central1 \
    --set-env-vars TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN \
    --set-env-vars NODE_ENV=production \
    --set-env-vars MINI_APP_URL=$SERVICE_URL
```

## Alternative: Automated Deployment Script

Create `deploy-cloudrun.sh`:

```bash
#!/bin/bash
PROJECT_ID="bybit-telegram-bot"
SERVICE_NAME="bybit-telegram-bot"
REGION="us-central1"

# Set project
gcloud config set project $PROJECT_ID

# Build and deploy
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME
gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN \
    --set-env-vars DATABASE_URL=$DATABASE_URL \
    --set-env-vars NODE_ENV=production

echo "Deployed successfully!"
```

## Benefits of Cloud Run:
- ✅ **Pay per use** - only charged when bot is active
- ✅ **Auto-scaling** - handles traffic spikes automatically  
- ✅ **Reliable** - 99.95% uptime SLA
- ✅ **Fast deployments** - updates in seconds
- ✅ **PostgreSQL integration** - managed Cloud SQL database
- ✅ **No data resets** - persistent database storage

## Cost Estimate:
- **Cloud Run**: ~$0-5/month (2M requests free tier)
- **Cloud SQL**: ~$7/month (db-f1-micro instance)
- **Total**: ~$7-12/month

## Quick Setup Commands:
```bash
# Clone your repo locally
git clone YOUR_REPO_URL
cd bybit-event-mini-app

# Deploy in one command
gcloud run deploy --source .
```

Would you like me to help you set this up step by step?