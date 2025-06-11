// Control Panel - Easy Interface for All Tools
const readline = require('readline');
const MonitoringSuite = require('./monitoring-suite');
const AnalyticsDashboard = require('./analytics-dashboard');
const BackupSystem = require('./backup-system');

class ControlPanel {
    constructor() {
        this.monitoring = new MonitoringSuite();
        this.analytics = new AnalyticsDashboard();
        this.backup = new BackupSystem();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    showHeader() {
        console.clear();
        console.log('🚀 BYBIT EVENT APP - CONTROL PANEL');
        console.log('==================================\n');
        console.log('📱 Production URL: https://bybit-event-mini-app-production-ae87.up.railway.app');
        console.log('📊 Current User: MaiHu (@google_baba440) - 120 points');
        console.log('');
    }

    showMainMenu() {
        this.showHeader();
        console.log('📋 MAIN MENU');
        console.log('============\n');
        console.log('1. 📊 View Analytics Dashboard');
        console.log('2. 🏥 System Health Check');
        console.log('3. 💾 Backup Management');
        console.log('4. 👥 User Activity Monitor');
        console.log('5. ⚡ Performance Test');
        console.log('6. 📋 Generate Daily Report');
        console.log('7. 🔄 Start Continuous Monitoring');
        console.log('8. 🌐 View Production Data');
        console.log('9. ⚙️  System Management');
        console.log('0. ❌ Exit');
        console.log('');
    }

    async getUserChoice(prompt = 'Enter your choice: ') {
        return new Promise((resolve) => {
            this.rl.question(prompt, (answer) => {
                resolve(answer.trim());
            });
        });
    }

    async showAnalyticsDashboard() {
        this.showHeader();
        console.log('📊 ANALYTICS DASHBOARD');
        console.log('=====================\n');
        
        console.log('Loading analytics data...\n');
        await this.analytics.runFullAnalysis();
        
        console.log('\n📈 Analytics completed! Check the generated JSON file for detailed data.');
        await this.getUserChoice('Press Enter to continue...');
    }

    async showSystemHealth() {
        this.showHeader();
        console.log('🏥 SYSTEM HEALTH CHECK');
        console.log('======================\n');
        
        const health = await this.monitoring.checkSystemHealth();
        
        console.log('\n✅ Health check completed!');
        if (health.alerts && health.alerts.length > 0) {
            console.log('\n🚨 Alerts found - check the generated health report.');
        }
        await this.getUserChoice('Press Enter to continue...');
    }

    async showBackupManagement() {
        while (true) {
            this.showHeader();
            console.log('💾 BACKUP MANAGEMENT');
            console.log('===================\n');
            
            console.log('1. 📦 Create New Backup');
            console.log('2. 📋 List All Backups');
            console.log('3. 🧹 Clean Old Backups');
            console.log('4. ⏰ Schedule Automatic Backups');
            console.log('5. 🔙 Back to Main Menu');
            console.log('');

            const choice = await this.getUserChoice();

            switch (choice) {
                case '1':
                    console.log('\n📦 Creating backup...');
                    await this.backup.createFullBackup();
                    await this.getUserChoice('Press Enter to continue...');
                    break;

                case '2':
                    console.log('\n📋 Listing backups...');
                    this.backup.listBackups();
                    await this.getUserChoice('Press Enter to continue...');
                    break;

                case '3':
                    const days = await this.getUserChoice('Keep backups for how many days? (default 30): ');
                    this.backup.cleanOldBackups(parseInt(days) || 30);
                    await this.getUserChoice('Press Enter to continue...');
                    break;

                case '4':
                    const hours = await this.getUserChoice('Backup interval in hours? (default 24): ');
                    console.log('\n⏰ Starting scheduled backups...');
                    console.log('⚠️  This will run continuously. Press Ctrl+C to stop.');
                    await this.backup.scheduleBackups(parseInt(hours) || 24);
                    break;

                case '5':
                    return;

                default:
                    console.log('❌ Invalid choice!');
                    await this.getUserChoice('Press Enter to try again...');
            }
        }
    }

    async showUserActivity() {
        this.showHeader();
        console.log('👥 USER ACTIVITY MONITOR');
        console.log('========================\n');
        
        await this.monitoring.userActivityMonitor();
        
        console.log('\n✅ User activity analysis completed!');
        await this.getUserChoice('Press Enter to continue...');
    }

    async showPerformanceTest() {
        this.showHeader();
        console.log('⚡ PERFORMANCE TEST');
        console.log('==================\n');
        
        const duration = await this.getUserChoice('Test duration in seconds? (default 60): ');
        const durationMs = (parseInt(duration) || 60) * 1000;
        
        console.log(`\n🚀 Running ${durationMs/1000}s performance test...\n`);
        await this.monitoring.performanceMonitor(durationMs);
        
        console.log('\n✅ Performance test completed!');
        await this.getUserChoice('Press Enter to continue...');
    }

    async showDailyReport() {
        this.showHeader();
        console.log('📋 DAILY REPORT GENERATION');
        console.log('==========================\n');
        
        console.log('🔄 Generating comprehensive daily report...\n');
        console.log('This includes:');
        console.log('- System health check');
        console.log('- User activity analysis');
        console.log('- Analytics dashboard');
        console.log('- Automatic backup');
        console.log('');
        
        const confirm = await this.getUserChoice('Continue? (y/n): ');
        if (confirm.toLowerCase() === 'y') {
            await this.monitoring.generateDailyReport();
            console.log('\n✅ Daily report completed!');
        }
        
        await this.getUserChoice('Press Enter to continue...');
    }

    async showContinuousMonitoring() {
        this.showHeader();
        console.log('🔄 CONTINUOUS MONITORING');
        console.log('========================\n');
        
        const interval = await this.getUserChoice('Check interval in minutes? (default 60): ');
        
        console.log('\n⚠️  Starting continuous monitoring...');
        console.log('⚠️  This will run indefinitely. Press Ctrl+C to stop.');
        console.log('');
        
        const confirm = await this.getUserChoice('Continue? (y/n): ');
        if (confirm.toLowerCase() === 'y') {
            await this.monitoring.startContinuousMonitoring(parseInt(interval) || 60);
        }
    }

    async showProductionData() {
        this.showHeader();
        console.log('🌐 PRODUCTION DATA VIEWER');
        console.log('=========================\n');
        
        console.log('Available data sources:');
        console.log('1. Current user data (debug endpoint)');
        console.log('2. Leaderboard');
        console.log('3. Complete data export (requires deployment)');
        console.log('');
        
        const choice = await this.getUserChoice('Select data source (1-3): ');
        
        switch (choice) {
            case '1':
                console.log('\n📥 Fetching current user data...');
                const { exec } = require('child_process');
                exec('node extract-current-data.js', (error, stdout, stderr) => {
                    if (error) {
                        console.error('❌ Error:', error);
                    } else {
                        console.log(stdout);
                    }
                });
                break;
                
            case '2':
                console.log('\n📥 Fetching leaderboard...');
                try {
                    const fetch = require('node-fetch');
                    const response = await fetch('https://bybit-event-mini-app-production-ae87.up.railway.app/api/leaderboard');
                    const data = await response.json();
                    
                    console.log('🏆 CURRENT LEADERBOARD:');
                    data.forEach((user, index) => {
                        console.log(`${index + 1}. ${user.username || user.first_name} - ${user.points} points`);
                    });
                } catch (error) {
                    console.error('❌ Error fetching leaderboard:', error.message);
                }
                break;
                
            case '3':
                console.log('\n⚠️  Complete data export requires deploying the admin endpoints first.');
                console.log('Run: node fetch-production-data.js');
                break;
                
            default:
                console.log('❌ Invalid choice!');
        }
        
        await this.getUserChoice('Press Enter to continue...');
    }

    async showSystemManagement() {
        while (true) {
            this.showHeader();
            console.log('⚙️  SYSTEM MANAGEMENT');
            console.log('====================\n');
            
            console.log('1. 🚀 Deploy Admin Endpoints');
            console.log('2. 📁 View All Generated Files');
            console.log('3. 🧹 Clean Generated Files');
            console.log('4. 🔧 Run Custom Command');
            console.log('5. 📖 View Deployment Instructions');
            console.log('6. 🔙 Back to Main Menu');
            console.log('');

            const choice = await this.getUserChoice();

            switch (choice) {
                case '1':
                    console.log('\n🚀 DEPLOYMENT INSTRUCTIONS');
                    console.log('==========================');
                    console.log('1. Your server.js has been updated with admin endpoints');
                    console.log('2. Push changes to GitHub or upload to Railway');
                    console.log('3. Admin endpoints will be available at:');
                    console.log('   - /api/admin/export/users?key=admin123');
                    console.log('   - /api/admin/export/quests?key=admin123');
                    console.log('   - /api/admin/export/transactions?key=admin123');
                    console.log('4. Change admin key from "admin123" for security!');
                    await this.getUserChoice('Press Enter to continue...');
                    break;

                case '2':
                    console.log('\n📁 Generated Files:');
                    const { exec } = require('child_process');
                    exec('ls -la *.json backups/ 2>/dev/null || echo "No files found"', (error, stdout, stderr) => {
                        console.log(stdout);
                    });
                    await this.getUserChoice('Press Enter to continue...');
                    break;

                case '3':
                    const confirm = await this.getUserChoice('Delete all generated JSON files and reports? (y/n): ');
                    if (confirm.toLowerCase() === 'y') {
                        const { exec } = require('child_process');
                        exec('rm -f *.json && echo "✅ Files cleaned"', (error, stdout, stderr) => {
                            console.log(stdout || stderr);
                        });
                    }
                    await this.getUserChoice('Press Enter to continue...');
                    break;

                case '4':
                    const command = await this.getUserChoice('Enter command to run: ');
                    if (command) {
                        const { exec } = require('child_process');
                        exec(command, (error, stdout, stderr) => {
                            if (error) {
                                console.error('❌ Error:', error);
                            }
                            console.log(stdout);
                            if (stderr) console.error(stderr);
                        });
                    }
                    await this.getUserChoice('Press Enter to continue...');
                    break;

                case '5':
                    console.log('\n📖 DEPLOYMENT INSTRUCTIONS');
                    console.log('===========================');
                    const fs = require('fs');
                    try {
                        const instructions = fs.readFileSync('./DEPLOYMENT_INSTRUCTIONS.md', 'utf8');
                        console.log(instructions);
                    } catch (error) {
                        console.log('❌ Instructions file not found');
                    }
                    await this.getUserChoice('Press Enter to continue...');
                    break;

                case '6':
                    return;

                default:
                    console.log('❌ Invalid choice!');
                    await this.getUserChoice('Press Enter to try again...');
            }
        }
    }

    async run() {
        while (true) {
            this.showMainMenu();
            const choice = await this.getUserChoice();

            switch (choice) {
                case '1':
                    await this.showAnalyticsDashboard();
                    break;

                case '2':
                    await this.showSystemHealth();
                    break;

                case '3':
                    await this.showBackupManagement();
                    break;

                case '4':
                    await this.showUserActivity();
                    break;

                case '5':
                    await this.showPerformanceTest();
                    break;

                case '6':
                    await this.showDailyReport();
                    break;

                case '7':
                    await this.showContinuousMonitoring();
                    break;

                case '8':
                    await this.showProductionData();
                    break;

                case '9':
                    await this.showSystemManagement();
                    break;

                case '0':
                    console.log('\n👋 Goodbye! Thanks for using the Bybit Event App Control Panel!');
                    this.rl.close();
                    return;

                default:
                    console.log('❌ Invalid choice!');
                    await this.getUserChoice('Press Enter to try again...');
            }
        }
    }
}

// Run the control panel
if (require.main === module) {
    const panel = new ControlPanel();
    panel.run().catch(console.error);
}