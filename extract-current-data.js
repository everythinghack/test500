// Extract current production data using existing endpoints
const fetch = require('node-fetch');
const fs = require('fs');

const PRODUCTION_URL = 'https://bybit-event-mini-app-production-ae87.up.railway.app';

async function extractCurrentData() {
    console.log('🌐 EXTRACTING CURRENT PRODUCTION DATA');
    console.log('====================================\n');
    
    try {
        // Get users from debug endpoint
        console.log('📥 Fetching user data from /api/debug/referrals...');
        const debugResponse = await fetch(`${PRODUCTION_URL}/api/debug/referrals`);
        const debugData = await debugResponse.json();
        
        console.log('✅ Production Data Found!');
        console.log(`📊 Total Users: ${debugData.total_users}`);
        console.log(`🌍 Environment: ${debugData.environment}`);
        
        if (debugData.your_user) {
            const user = debugData.your_user;
            console.log('\n👤 USER DETAILS:');
            console.log(`   Name: ${user.first_name}`);
            console.log(`   Username: @${user.username}`);
            console.log(`   Telegram ID: ${user.telegram_id}`);
            console.log(`   Points: ${user.points}`);
            console.log(`   Joined: ${user.created_at}`);
            console.log(`   Referrer: ${user.referrer_id || 'None'}`);
        }
        
        if (debugData.all_users && debugData.all_users.length > 0) {
            console.log('\n👥 ALL USERS:');
            debugData.all_users.forEach((user, index) => {
                console.log(`${index + 1}. ${user.first_name} (@${user.username})`);
                console.log(`   📱 ID: ${user.telegram_id}`);
                console.log(`   🏆 Points: ${user.points}`);
                console.log(`   📅 Joined: ${user.created_at}`);
                console.log('');
            });
        }
        
        // Get leaderboard
        console.log('📥 Fetching leaderboard...');
        const leaderboardResponse = await fetch(`${PRODUCTION_URL}/api/leaderboard`);
        const leaderboard = await leaderboardResponse.json();
        
        console.log('🏆 LEADERBOARD:');
        leaderboard.forEach((user, index) => {
            console.log(`${index + 1}. ${user.username || user.first_name || 'Unknown'} - ${user.points} points`);
        });
        
        // Save data
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const exportData = {
            timestamp: new Date().toISOString(),
            source: 'production_debug_endpoint',
            production_url: PRODUCTION_URL,
            user_data: debugData,
            leaderboard: leaderboard
        };
        
        fs.writeFileSync(`current-production-data-${timestamp}.json`, JSON.stringify(exportData, null, 2));
        
        console.log(`\n✅ DATA SAVED TO: current-production-data-${timestamp}.json`);
        
        return exportData;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Check if we need to install node-fetch
try {
    require('node-fetch');
    extractCurrentData();
} catch (e) {
    console.log('📦 Installing node-fetch...');
    const { execSync } = require('child_process');
    execSync('npm install node-fetch@2', { stdio: 'inherit' });
    delete require.cache[require.resolve('node-fetch')];
    extractCurrentData();
}