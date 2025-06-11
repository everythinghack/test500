# 🛠️ Bybit Event App - Complete Tools Suite

## 🚀 Quick Start

### Launch Control Panel (Recommended)
```bash
node control-panel.js
```
**Interactive menu with all tools in one place!**

---

## 📊 1. Admin Endpoints for Complete Data Access

### Status: ⚠️ Needs Deployment
Your `server.js` has been updated with admin endpoints. **Deploy to Railway first!**

#### New Endpoints:
- `GET /api/admin/export/users?key=admin123` - All user data
- `GET /api/admin/export/quests?key=admin123` - Quest completion stats  
- `GET /api/admin/export/transactions?key=admin123` - Point transaction history

#### Deploy Options:
1. **Railway Dashboard**: Upload updated `server.js`
2. **GitHub**: Push changes (auto-deploy if connected)
3. **Manual**: Copy files to your Railway project

#### Test After Deployment:
```bash
node fetch-production-data.js
```

---

## 📈 2. Analytics Tools

### Current Analytics (Works Now):
```bash
node analytics-dashboard.js
```

**Provides:**
- User segmentation (beginners, active, power users)
- Growth projections  
- Referral analysis
- Registration timeline

### Enhanced Analytics (After Deployment):
- Quest completion rates
- Transaction pattern analysis
- Daily/weekly engagement metrics

---

## 💾 3. Automated Backup System

### Create Backup Now:
```bash
node backup-system.js create
```

### Schedule Automatic Backups:
```bash
node backup-system.js schedule 6    # Every 6 hours
node backup-system.js schedule 24   # Daily
```

### Manage Backups:
```bash
node backup-system.js list          # List all backups
node backup-system.js clean 30      # Delete backups older than 30 days
```

**Backup Location:** `./backups/` folder

---

## 🔍 4. System Monitoring

### Quick Health Check:
```bash
node monitoring-suite.js health
```

### Performance Testing:
```bash
node monitoring-suite.js performance 120   # 2-minute test
```

### User Activity Analysis:
```bash
node monitoring-suite.js activity
```

### Complete Daily Report:
```bash
node monitoring-suite.js daily
```

### Continuous Monitoring:
```bash
node monitoring-suite.js continuous 30     # Check every 30 minutes
```

---

## 🌐 5. Production Data Access

### Current User Data (Works Now):
```bash
node extract-current-data.js
```

**Shows:**
- User: MaiHu (@google_baba440)
- Points: 120 BP
- Registration: June 11, 2025
- Referrals: 0

### Complete Data Export (After Deployment):
```bash
node fetch-production-data.js
```

---

## 📁 6. Generated Files

All tools create timestamped files:
- `analytics-report-TIMESTAMP.json` - Analytics data
- `backup-TIMESTAMP/` - Complete backups
- `health-report-TIMESTAMP.json` - System health
- `performance-report-TIMESTAMP.json` - Performance metrics
- `daily-report-TIMESTAMP.json` - Complete daily summary

---

## ⚙️ 7. Individual Commands

### Analytics:
```bash
# Current analytics (available now)
node analytics-dashboard.js

# Specific user data extraction  
node extract-current-data.js
```

### Backups:
```bash
# One-time backup
node backup-system.js create

# Scheduled backups (runs continuously)
node backup-system.js schedule 24

# Cleanup old backups
node backup-system.js clean 30
```

### Monitoring:
```bash
# System health
node monitoring-suite.js health

# 5-minute performance test
node monitoring-suite.js performance 300

# User activity
node monitoring-suite.js activity

# Full daily report
node monitoring-suite.js daily

# Continuous monitoring (runs forever)
node monitoring-suite.js continuous 60
```

---

## 🔐 Security Notes

1. **Change Admin Key**: Update `admin123` in all files before deploying
2. **Secure Endpoints**: Admin endpoints require the key parameter
3. **Access Control**: Only you have access to these tools

---

## 🎯 Current Status

### ✅ Working Now:
- Analytics dashboard with current user data
- System health monitoring
- Backup system
- User activity analysis
- Performance testing

### ⚠️ After Deployment:
- Complete user data export
- Quest completion statistics
- Transaction history analysis
- Enhanced analytics with admin data

---

## 🆘 Need Help?

### Common Issues:

**"Admin endpoints not available"**
- Deploy updated `server.js` to Railway first

**"Module not found" errors**
- Run: `npm install node-fetch@2`

**"Permission denied" for backups**
- Check folder permissions: `chmod 755 backups/`

### Support:
- Check deployment instructions: `DEPLOYMENT_INSTRUCTIONS.md`
- Run control panel: `node control-panel.js`
- Test individual tools with the commands above

---

## 🎉 Quick Demo

Try this 2-minute demo:
```bash
# 1. Launch control panel
node control-panel.js

# 2. Choose option 2 (System Health Check)
# 3. Choose option 1 (Analytics Dashboard)  
# 4. Choose option 3 (Backup Management) -> 1 (Create Backup)
```

**You now have complete monitoring and analytics for your Bybit Event App!** 🚀