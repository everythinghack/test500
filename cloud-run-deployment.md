# Deploying to Google Cloud Run

## Prerequisites
1. Google Cloud account with billing enabled
2. Google Cloud CLI installed (gcloud)
3. Docker installed locally (for testing)

## Steps to Deploy

### 1. Set up environment
```bash
# Install Google Cloud SDK if not already installed
# https://cloud.google.com/sdk/docs/install

# Login to Google Cloud
gcloud auth login

# Set your project ID
gcloud config set project YOUR_PROJECT_ID
```

### 2. Build and test Docker image locally
```bash
# Build the Docker image
docker build -t bybit-event-app .

# Test locally (set environment variables)
docker run -p 8080:8080 \
  -e TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN" \
  -e MINI_APP_URL="https://your-future-cloud-run-url.run.app" \
  bybit-event-app
```

### 3. Deploy to Google Cloud Run
```bash
# Enable required APIs
gcloud services enable cloudbuild.googleapis.com run.googleapis.com

# Build and push the image to Google Container Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/bybit-event-app

# Deploy to Cloud Run
gcloud run deploy bybit-event-app \
  --image gcr.io/YOUR_PROJECT_ID/bybit-event-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN" \
  --set-env-vars="MINI_APP_URL=https://bybit-event-app-xxxx.run.app"
```

### 4. Update MINI_APP_URL with actual URL
After deployment, Cloud Run will provide a URL for your service. Update the MINI_APP_URL environment variable with this actual URL:

```bash
gcloud run services update bybit-event-app \
  --set-env-vars="MINI_APP_URL=https://bybit-event-app-xxxx.run.app"
```

### 5. Verify deployment
- Visit your Cloud Run URL to ensure the app is running
- Test the Telegram bot to make sure it can send the Mini App link correctly

## Important Notes
- The SQLite database is stored in the container's filesystem. For production, consider using a managed database service like Cloud SQL
- Set up proper secrets management for your bot token using Secret Manager
- For high availability, consider implementing database persistence using Cloud Storage or a managed database