// Data Migration Tool - Move from SQLite to PostgreSQL
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

// Configuration
const BACKUP_BEFORE_MIGRATION = true;
const PRODUCTION_URL = 'https://bybit-event-mini-app-production-ae87.up.railway.app';

class DataMigration {
    constructor() {
        this.sqliteDb = null;
        this.postgresDb = null;
        this.migrationLog = [];
    }

    async initialize() {
        console.log('🔄 INITIALIZING DATA MIGRATION');
        console.log('==============================\n');

        // Initialize SQLite (source)
        this.sqliteDb = new sqlite3.Database('./data/event_app.db', (err) => {
            if (err) {
                console.error('❌ SQLite connection failed:', err.message);
            } else {
                console.log('✅ Connected to SQLite database');
            }
        });

        // Initialize PostgreSQL (destination)
        if (process.env.DATABASE_URL) {
            this.postgresDb = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            });
            console.log('✅ PostgreSQL connection configured');
        } else {
            console.log('⚠️  DATABASE_URL not set. This will be available after adding PostgreSQL to Railway.');
        }
    }

    async backupCurrentData() {
        if (!BACKUP_BEFORE_MIGRATION) return;

        console.log('💾 CREATING BACKUP BEFORE MIGRATION');
        console.log('===================================\n');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = `./migration-backup-${timestamp}`;
        
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
        }

        // Backup all tables
        const tables = ['Users', 'Quests', 'UserQuests', 'PointTransactions', 'PendingReferrals', 'EventConfig'];
        
        for (const table of tables) {
            try {
                const data = await this.getSQLiteData(`SELECT * FROM ${table}`);
                fs.writeFileSync(`${backupDir}/${table}.json`, JSON.stringify(data, null, 2));
                console.log(`✅ Backed up ${table}: ${data.length} records`);
                this.migrationLog.push(`Backed up ${table}: ${data.length} records`);
            } catch (error) {
                console.log(`⚠️  Could not backup ${table}: ${error.message}`);
                this.migrationLog.push(`Backup failed for ${table}: ${error.message}`);
            }
        }

        console.log(`\n📁 Backup saved to: ${backupDir}\n`);
        return backupDir;
    }

    getSQLiteData(query) {
        return new Promise((resolve, reject) => {
            this.sqliteDb.all(query, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async migrateTable(tableName, data, schema) {
        if (!this.postgresDb) {
            throw new Error('PostgreSQL not configured');
        }

        console.log(`📊 Migrating ${tableName}...`);

        if (data.length === 0) {
            console.log(`  ℹ️  No data to migrate for ${tableName}`);
            return;
        }

        try {
            // Clear existing data
            await this.postgresDb.query(`DELETE FROM ${tableName}`);
            
            // Insert data
            for (const row of data) {
                const columns = Object.keys(row);
                const values = Object.values(row);
                const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
                
                const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
                await this.postgresDb.query(query, values);
            }

            console.log(`  ✅ Migrated ${data.length} records to ${tableName}`);
            this.migrationLog.push(`Successfully migrated ${tableName}: ${data.length} records`);

        } catch (error) {
            console.log(`  ❌ Migration failed for ${tableName}: ${error.message}`);
            this.migrationLog.push(`Migration failed for ${tableName}: ${error.message}`);
            throw error;
        }
    }

    async performMigration() {
        console.log('🚀 STARTING DATA MIGRATION');
        console.log('==========================\n');

        if (!this.postgresDb) {
            console.log('❌ PostgreSQL not configured. Add PostgreSQL to Railway first!');
            console.log('\nSteps to add PostgreSQL:');
            console.log('1. Go to Railway dashboard');
            console.log('2. Select your project');
            console.log('3. Click "New" → "Database" → "PostgreSQL"');
            console.log('4. Railway will provide DATABASE_URL environment variable');
            console.log('5. Redeploy your app');
            return false;
        }

        try {
            // Create backup first
            const backupDir = await this.backupCurrentData();

            // Read data from SQLite
            const userData = await this.getSQLiteData('SELECT * FROM Users');
            const questData = await this.getSQLiteData('SELECT * FROM Quests');
            const userQuestData = await this.getSQLiteData('SELECT * FROM UserQuests');
            const transactionData = await this.getSQLiteData('SELECT * FROM PointTransactions');
            const pendingReferralData = await this.getSQLiteData('SELECT * FROM PendingReferrals');
            const eventConfigData = await this.getSQLiteData('SELECT * FROM EventConfig');

            console.log('📊 MIGRATION SUMMARY:');
            console.log(`Users: ${userData.length}`);
            console.log(`Quests: ${questData.length}`);
            console.log(`UserQuests: ${userQuestData.length}`);
            console.log(`Transactions: ${transactionData.length}`);
            console.log(`Pending Referrals: ${pendingReferralData.length}`);
            console.log(`Event Config: ${eventConfigData.length}`);
            console.log('');

            // Migrate in order (respecting foreign keys)
            await this.migrateTable('Users', userData);
            await this.migrateTable('Quests', questData);
            await this.migrateTable('UserQuests', userQuestData);
            await this.migrateTable('PointTransactions', transactionData);
            await this.migrateTable('PendingReferrals', pendingReferralData);
            await this.migrateTable('EventConfig', eventConfigData);

            // Save migration log
            const logFile = `migration-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            fs.writeFileSync(logFile, JSON.stringify({
                timestamp: new Date().toISOString(),
                backup_directory: backupDir,
                migration_log: this.migrationLog,
                success: true
            }, null, 2));

            console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!');
            console.log('=====================================');
            console.log(`📁 Backup: ${backupDir}`);
            console.log(`📋 Log: ${logFile}`);
            console.log('\n✅ Your data is now in PostgreSQL and will persist across deployments!');

            return true;

        } catch (error) {
            console.error('\n❌ MIGRATION FAILED:', error.message);
            this.migrationLog.push(`Migration failed: ${error.message}`);
            
            // Save error log
            const errorLogFile = `migration-error-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            fs.writeFileSync(errorLogFile, JSON.stringify({
                timestamp: new Date().toISOString(),
                error: error.message,
                migration_log: this.migrationLog,
                success: false
            }, null, 2));

            return false;
        }
    }

    async close() {
        if (this.sqliteDb) {
            this.sqliteDb.close();
        }
        if (this.postgresDb) {
            await this.postgresDb.end();
        }
    }
}

// CLI interface
async function main() {
    const migration = new DataMigration();
    
    try {
        await migration.initialize();
        
        const args = process.argv.slice(2);
        const command = args[0];

        switch (command) {
            case 'backup':
                await migration.backupCurrentData();
                break;

            case 'migrate':
                const success = await migration.performMigration();
                process.exit(success ? 0 : 1);
                break;

            case 'check':
                console.log('🔍 CHECKING MIGRATION READINESS');
                console.log('==============================\n');
                
                // Check if SQLite exists
                if (fs.existsSync('./data/event_app.db')) {
                    const userData = await migration.getSQLiteData('SELECT COUNT(*) as count FROM Users');
                    console.log(`✅ SQLite database found with ${userData[0].count} users`);
                } else {
                    console.log('❌ SQLite database not found');
                }

                // Check if PostgreSQL is configured
                if (process.env.DATABASE_URL) {
                    console.log('✅ PostgreSQL URL configured');
                } else {
                    console.log('❌ PostgreSQL URL not configured');
                    console.log('   Add PostgreSQL to Railway first!');
                }
                break;

            default:
                console.log('🔄 DATA MIGRATION TOOL');
                console.log('=====================\n');
                console.log('Commands:');
                console.log('  node migrate-to-postgres.js check   - Check migration readiness');
                console.log('  node migrate-to-postgres.js backup  - Backup current data');
                console.log('  node migrate-to-postgres.js migrate - Perform full migration');
                console.log('\nSteps:');
                console.log('1. Add PostgreSQL to Railway project');
                console.log('2. Set DATABASE_URL environment variable');
                console.log('3. Run: node migrate-to-postgres.js migrate');
                console.log('4. Deploy updated app with PostgreSQL support');
                break;
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await migration.close();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = DataMigration;