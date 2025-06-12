# Cloud Run Deployment Guide

**Bot Configuration:**
- Token: `8120704547:AAEPEn9EY8bZmiGyIFh7dtFwPVwPs0zGpyA`
- Username: `@testbla700bot`
- Cloud Run URL: `https://bybit-telegram-bot-464578924371.asia-south1.run.app`
- Container Image: `everythinghack/bybit-telegram-bot`

## Current Deployment

## Step 1: Build Docker Image

```bash
# Navigate to your project directory
cd "D:\Telegram Bot\bybit-event-mini-app - working 07June - Copy - Copy - Copy"

# Build the Docker image
docker build -t everythinghack/bybit-telegram-bot .
```

## Step 2: Login to Docker Hub

```bash
# Login to Docker Hub
docker login

# Enter your Docker Hub credentials when prompted
```

## Step 3: Push to Docker Hub

```bash
# Push the image to Docker Hub
docker push everythinghack/bybit-telegram-bot
```

## Step 4: Current Configuration

**Environment Variables Set in Cloud Run:**
- `TELEGRAM_BOT_TOKEN`: `8120704547:AAEPEn9EY8bZmiGyIFh7dtFwPVwPs0zGpyA`
- `MINI_APP_URL`: `https://bybit-telegram-bot-464578924371.asia-south1.run.app`
- `NODE_ENV`: `production`

## Step 5: Update Deployment

To update the deployment with new code:

### Option B: Command Line (if you have gcloud CLI)
```bash
gcloud run deploy bybit-telegram-bot \
    --image everythinghack/bybit-telegram-bot \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN \
    --set-env-vars NODE_ENV=production
```

## Step 6: Initialize Database (One-time)

After deployment, visit your Cloud Run URL + `/setup-database`:
```
https://your-cloud-run-url/setup-database
```

## Complete Commands Summary

```bash
# 1. Build image
docker build -t everythinghack/bybit-telegram-bot .

# 2. Login to Docker Hub
docker login

# 3. Push to Docker Hub
docker push everythinghack/bybit-telegram-bot

# 4. Your Container Image URL is now:
# everythinghack/bybit-telegram-bot
```

## Benefits of This Approach

- ✅ **Simple**: Uses your existing Docker setup
- ✅ **Fast**: No need for Google Cloud CLI
- ✅ **Public**: Image accessible from anywhere
- ✅ **Free**: Docker Hub free tier
- ✅ **Reusable**: Can deploy to multiple platforms

## Next Steps

1. Run the Docker commands above
2. Use `everythinghack/bybit-telegram-bot` as your Container Image URL in Cloud Run
3. Deploy and test!

Your image will be public at: https://hub.docker.com/r/everythinghack/bybit-telegram-bot