# 🚀 Deployment Instructions

## Option 1: Manual Deployment to Railway

1. **Zip the project files**:
   ```bash
   zip -r bybit-app-update.zip . -x "node_modules/*" "*.git*" "data/*" "*.json"
   ```

2. **Deploy to Railway**:
   - Go to your Railway dashboard
   - Select your project
   - Click "Deploy" → "Deploy from GitHub" or upload the zip file
   - Wait for deployment to complete

## Option 2: GitHub Integration

If Railway is connected to your GitHub:
1. Push these files to your GitHub repository
2. Railway will auto-deploy

## Option 3: Railway CLI

```bash
npm install -g @railway/cli
railway login
railway link [your-project-id]
railway up
```

## ✅ After Deployment

Test the new admin endpoints:
- `https://your-app.railway.app/api/admin/export/users?key=admin123`
- `https://your-app.railway.app/api/admin/export/quests?key=admin123`
- `https://your-app.railway.app/api/admin/export/transactions?key=admin123`

## 🔐 Security Note

Change the admin key from 'admin123' to something secure before deploying!