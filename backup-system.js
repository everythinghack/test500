// Automated Backup System for Bybit Event App
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const PRODUCTION_URL = 'https://bybit-event-mini-app-production-ae87.up.railway.app';
const ADMIN_KEY = 'admin123'; // Change this after deployment
const BACKUP_DIR = './backups';

class BackupSystem {
    constructor() {
        this.ensureBackupDirectory();
    }

    ensureBackupDirectory() {
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
            console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
        }
    }

    async createFullBackup() {
        console.log('💾 CREATING FULL BACKUP');
        console.log('=====================\n');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFolder = path.join(BACKUP_DIR, `backup-${timestamp}`);
        fs.mkdirSync(backupFolder, { recursive: true });

        const backup = {
            timestamp: new Date().toISOString(),
            production_url: PRODUCTION_URL,
            status: 'in_progress',
            files: []
        };

        try {
            // Backup 1: Debug data (always available)
            console.log('📥 Backing up debug data...');
            const debugResponse = await fetch(`${PRODUCTION_URL}/api/debug/referrals`);
            const debugData = await debugResponse.json();
            
            const debugFile = path.join(backupFolder, 'debug-data.json');
            fs.writeFileSync(debugFile, JSON.stringify(debugData, null, 2));
            backup.files.push('debug-data.json');
            console.log('✅ Debug data backed up');

            // Backup 2: Leaderboard
            console.log('📥 Backing up leaderboard...');
            const leaderboardResponse = await fetch(`${PRODUCTION_URL}/api/leaderboard`);
            const leaderboardData = await leaderboardResponse.json();
            
            const leaderboardFile = path.join(backupFolder, 'leaderboard.json');
            fs.writeFileSync(leaderboardFile, JSON.stringify(leaderboardData, null, 2));
            backup.files.push('leaderboard.json');
            console.log('✅ Leaderboard backed up');

            // Backup 3: Admin endpoints (if available)
            try {
                console.log('📥 Backing up users data...');
                const usersResponse = await fetch(`${PRODUCTION_URL}/api/admin/export/users?key=${ADMIN_KEY}`);
                if (usersResponse.ok) {
                    const usersData = await usersResponse.json();
                    const usersFile = path.join(backupFolder, 'users-complete.json');
                    fs.writeFileSync(usersFile, JSON.stringify(usersData, null, 2));
                    backup.files.push('users-complete.json');
                    console.log('✅ Complete users data backed up');
                }

                console.log('📥 Backing up quest data...');
                const questsResponse = await fetch(`${PRODUCTION_URL}/api/admin/export/quests?key=${ADMIN_KEY}`);
                if (questsResponse.ok) {
                    const questsData = await questsResponse.json();
                    const questsFile = path.join(backupFolder, 'quests-stats.json');
                    fs.writeFileSync(questsFile, JSON.stringify(questsData, null, 2));
                    backup.files.push('quests-stats.json');
                    console.log('✅ Quest statistics backed up');
                }

                console.log('📥 Backing up transactions...');
                const transactionsResponse = await fetch(`${PRODUCTION_URL}/api/admin/export/transactions?key=${ADMIN_KEY}`);
                if (transactionsResponse.ok) {
                    const transactionsData = await transactionsResponse.json();
                    const transactionsFile = path.join(backupFolder, 'transactions.json');
                    fs.writeFileSync(transactionsFile, JSON.stringify(transactionsData, null, 2));
                    backup.files.push('transactions.json');
                    console.log('✅ Transactions backed up');
                }

            } catch (adminError) {
                console.log('⚠️  Admin endpoints not available - basic backup created');
                backup.admin_endpoints_available = false;
            }

            // Create backup manifest
            backup.status = 'completed';
            backup.total_files = backup.files.length;
            backup.size_mb = this.calculateFolderSize(backupFolder);

            const manifestFile = path.join(backupFolder, 'backup-manifest.json');
            fs.writeFileSync(manifestFile, JSON.stringify(backup, null, 2));

            console.log(`\n✅ BACKUP COMPLETED`);
            console.log(`📁 Location: ${backupFolder}`);
            console.log(`📊 Files: ${backup.files.length}`);
            console.log(`💾 Size: ${backup.size_mb} MB`);

            return { success: true, backup, folder: backupFolder };

        } catch (error) {
            console.error('❌ Backup failed:', error.message);
            backup.status = 'failed';
            backup.error = error.message;
            
            const manifestFile = path.join(backupFolder, 'backup-manifest.json');
            fs.writeFileSync(manifestFile, JSON.stringify(backup, null, 2));
            
            return { success: false, error: error.message, backup };
        }
    }

    calculateFolderSize(folderPath) {
        let totalSize = 0;
        const files = fs.readdirSync(folderPath);
        
        files.forEach(file => {
            const filePath = path.join(folderPath, file);
            const stats = fs.statSync(filePath);
            totalSize += stats.size;
        });
        
        return Math.round((totalSize / (1024 * 1024)) * 100) / 100; // MB with 2 decimals
    }

    listBackups() {
        console.log('📋 BACKUP HISTORY');
        console.log('================\n');

        if (!fs.existsSync(BACKUP_DIR)) {
            console.log('No backups found.');
            return [];
        }

        const backupFolders = fs.readdirSync(BACKUP_DIR)
            .filter(item => item.startsWith('backup-'))
            .sort()
            .reverse(); // Most recent first

        if (backupFolders.length === 0) {
            console.log('No backups found.');
            return [];
        }

        backupFolders.forEach((folder, index) => {
            const manifestPath = path.join(BACKUP_DIR, folder, 'backup-manifest.json');
            
            if (fs.existsSync(manifestPath)) {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                console.log(`${index + 1}. ${folder}`);
                console.log(`   📅 Created: ${manifest.timestamp}`);
                console.log(`   📊 Status: ${manifest.status}`);
                console.log(`   📁 Files: ${manifest.total_files || 'Unknown'}`);
                console.log(`   💾 Size: ${manifest.size_mb || 'Unknown'} MB`);
                console.log('');
            } else {
                console.log(`${index + 1}. ${folder} (manifest missing)`);
            }
        });

        return backupFolders;
    }

    async scheduleBackups(intervalHours = 24) {
        console.log(`⏰ SCHEDULING AUTOMATIC BACKUPS`);
        console.log(`📅 Interval: Every ${intervalHours} hours`);
        console.log('⚠️  Keep this script running for scheduled backups\n');

        // Initial backup
        await this.createFullBackup();

        // Schedule recurring backups
        const intervalMs = intervalHours * 60 * 60 * 1000;
        setInterval(async () => {
            console.log(`\n⏰ Scheduled backup starting...`);
            await this.createFullBackup();
        }, intervalMs);

        console.log(`✅ Backup scheduler active. Next backup in ${intervalHours} hours.`);
    }

    cleanOldBackups(keepDays = 30) {
        console.log(`🧹 CLEANING OLD BACKUPS (older than ${keepDays} days)`);
        console.log('===============================================\n');

        if (!fs.existsSync(BACKUP_DIR)) {
            console.log('No backup directory found.');
            return;
        }

        const now = new Date();
        const cutoffDate = new Date(now.getTime() - (keepDays * 24 * 60 * 60 * 1000));

        const backupFolders = fs.readdirSync(BACKUP_DIR)
            .filter(item => item.startsWith('backup-'));

        let deletedCount = 0;
        let totalSize = 0;

        backupFolders.forEach(folder => {
            const folderPath = path.join(BACKUP_DIR, folder);
            const stats = fs.statSync(folderPath);
            
            if (stats.mtime < cutoffDate) {
                const size = this.calculateFolderSize(folderPath);
                console.log(`🗑️  Deleting old backup: ${folder} (${size} MB)`);
                
                // Delete folder and all contents
                fs.rmSync(folderPath, { recursive: true, force: true });
                deletedCount++;
                totalSize += size;
            }
        });

        console.log(`\n✅ Cleanup completed:`);
        console.log(`📁 Deleted ${deletedCount} old backups`);
        console.log(`💾 Freed ${totalSize.toFixed(2)} MB`);
    }

    async restoreFromBackup(backupFolder) {
        console.log(`🔄 RESTORING FROM BACKUP: ${backupFolder}`);
        console.log('======================================\n');

        const backupPath = path.join(BACKUP_DIR, backupFolder);
        
        if (!fs.existsSync(backupPath)) {
            console.error('❌ Backup folder not found:', backupPath);
            return false;
        }

        const manifestPath = path.join(backupPath, 'backup-manifest.json');
        if (!fs.existsSync(manifestPath)) {
            console.error('❌ Backup manifest not found');
            return false;
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        console.log(`📋 Backup from: ${manifest.timestamp}`);
        console.log(`📊 Status: ${manifest.status}`);
        console.log(`📁 Files: ${manifest.files.join(', ')}`);
        
        // Note: For actual restoration, you'd need database access
        console.log('\n⚠️  NOTE: This shows backup contents. Database restoration requires direct DB access.');
        
        return true;
    }
}

// CLI Interface
async function main() {
    const backup = new BackupSystem();
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
        case 'create':
            await backup.createFullBackup();
            break;
            
        case 'list':
            backup.listBackups();
            break;
            
        case 'schedule':
            const hours = parseInt(args[1]) || 24;
            await backup.scheduleBackups(hours);
            break;
            
        case 'clean':
            const days = parseInt(args[1]) || 30;
            backup.cleanOldBackups(days);
            break;
            
        case 'restore':
            if (!args[1]) {
                console.log('Usage: node backup-system.js restore <backup-folder>');
                backup.listBackups();
                break;
            }
            await backup.restoreFromBackup(args[1]);
            break;
            
        default:
            console.log('💾 BACKUP SYSTEM COMMANDS');
            console.log('========================\n');
            console.log('node backup-system.js create          - Create backup now');
            console.log('node backup-system.js list            - List all backups');
            console.log('node backup-system.js schedule [hours] - Schedule automatic backups');
            console.log('node backup-system.js clean [days]    - Clean backups older than N days');
            console.log('node backup-system.js restore <folder> - Restore from backup');
            console.log('\nExample: node backup-system.js schedule 6  (backup every 6 hours)');
            break;
    }
}

module.exports = BackupSystem;

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}