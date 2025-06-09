#!/bin/bash

# Deployment script for Google Cloud Run
# Usage: ./deploy.sh YOUR_PROJECT_ID YOUR_BOT_TOKEN

set -e

PROJECT_ID=$1
BOT_TOKEN=$2

if [ -z "$PROJECT_ID" ] || [ -z "$BOT_TOKEN" ]; then
    echo "Usage: ./deploy.sh YOUR_PROJECT_ID YOUR_BOT_TOKEN"
    echo "Example: ./deploy.sh my-project-123 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
    exit 1
fi

echo "🚀 Deploying Bybit Event Mini App..."
echo "Project ID: $PROJECT_ID"

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "📋 Enabling required Google Cloud APIs..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com

# Build and push the image
echo "🏗️ Building and pushing Docker image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/bybit-event-app

# Deploy to Cloud Run
echo "🌐 Deploying to Cloud Run..."
gcloud run deploy bybit-event-app \
  --image gcr.io/$PROJECT_ID/bybit-event-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="TELEGRAM_BOT_TOKEN=$BOT_TOKEN" \
  --set-env-vars="MINI_APP_URL=PLACEHOLDER"

# Get the service URL
echo "🔗 Getting service URL..."
SERVICE_URL=$(gcloud run services describe bybit-event-app --platform managed --region us-central1 --format 'value(status.url)')

echo "✅ Deployment complete!"
echo "Service URL: $SERVICE_URL"

# Update the service with the correct MINI_APP_URL
echo "🔄 Updating MINI_APP_URL..."
gcloud run services update bybit-event-app \
  --platform managed \
  --region us-central1 \
  --set-env-vars="MINI_APP_URL=$SERVICE_URL"

echo ""
echo "🎉 All done! Your app is now running at: $SERVICE_URL"
echo ""
echo "Next steps:"
echo "1. Open Telegram and find your bot"
echo "2. Send /start to test the Mini App"
echo "3. Share your bot with friends for testing!"
echo ""
echo "Bot commands:"
echo "- /start - Launch the Mini App"
echo "- /start ref_USERID - Launch with referral"