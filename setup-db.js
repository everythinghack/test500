// One-time database setup script
// Run this only once when first deploying to a new database

const { initDb } = require('./database.js');

async function setupDatabase() {
    console.log('🚀 Starting one-time database setup...');
    
    try {
        await initDb();
        console.log('✅ Database setup completed successfully!');
        console.log('🎯 Your database is now ready for production use.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Database setup failed:', error);
        process.exit(1);
    }
}

setupDatabase();