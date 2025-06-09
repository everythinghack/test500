# Deployment Guide

## Quick Deployment Options

### Option 1: Railway (Recommended - Free & Easy)

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/bybit-event-mini-app.git
   git push -u origin main
   ```

2. **Deploy on Railway**:
   - Go to [railway.app](https://railway.app)
   - Click "Start a New Project"
   - Choose "Deploy from GitHub repo"
   - Select your repository
   - Railway will automatically detect and deploy your app

3. **Get your URL**:
   - Railway will provide a URL like `https://your-app-xyz.railway.app`

### Option 2: Render (Also Free & Easy)

1. **Push to GitHub** (same as above)

2. **Deploy on Render**:
   - Go to [render.com](https://render.com)
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Render will automatically deploy using the `render.yaml` config

### Option 3: Google Cloud Run

If you prefer Google Cloud, install the CLI:

**Windows**:
```bash
# Download and install from: https://cloud.google.com/sdk/docs/install
```

**Linux/WSL**:
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
```

Then run:
```bash
./deploy.sh YOUR_PROJECT_ID 7414638833:AAGLMQHQHScDJohRrIvcmYvUAcLwdV0vA5I
```

## After Deployment

1. **Get your app URL** from the hosting service
2. **Update your bot** with the Mini App URL
3. **Test with friends**!

## Bot Configuration

Your bot: @testbla500bot
Token: 7414638833:AAGLMQHQHScDJohRrIvcmYvUAcLwdV0vA5I

Once deployed, you'll need to configure the Mini App in BotFather:
1. Go to @BotFather
2. Send `/mybots`
3. Select your bot
4. Choose "Bot Settings" → "Menu Button"
5. Add your deployed URL