// Production Data Fetcher
// This script fetches real user data from your deployed Railway app

const fetch = require('node-fetch');
const fs = require('fs');

const PRODUCTION_URL = 'https://bybit-event-mini-app-production-ae87.up.railway.app';
const ADMIN_KEY = 'admin123'; // Change this to a secure key in production

async function fetchProductionData() {
    console.log('🌐 Fetching Production Data from Railway...');
    console.log('===============================================\n');
    
    try {
        // Fetch users data
        console.log('📥 Fetching users data...');
        const usersResponse = await fetch(`${PRODUCTION_URL}/api/admin/export/users?key=${ADMIN_KEY}`);
        
        if (!usersResponse.ok) {
            throw new Error(`Failed to fetch users: ${usersResponse.status} ${usersResponse.statusText}`);
        }
        
        const usersData = await usersResponse.json();
        console.log(`✅ Found ${usersData.total_users} users`);
        console.log(`📊 Total Points: ${usersData.summary.total_points}`);
        console.log(`📈 Average Points: ${Math.round(usersData.summary.avg_points || 0)}`);
        
        // Display user summary
        console.log('\n👥 USER SUMMARY:');
        usersData.users.slice(0, 10).forEach((user, index) => {
            console.log(`${index + 1}. ${user.first_name || 'Unknown'} (@${user.username || 'no_username'})`);
            console.log(`   📱 ID: ${user.telegram_id} | 🏆 Points: ${user.points} | 👥 Referrals: ${user.referral_count}`);
            if (user.bybit_uid) {
                console.log(`   💰 Bybit UID: ${user.bybit_uid}`);
            }
            console.log(`   📅 Joined: ${user.created_at}`);
            console.log('');
        });
        
        // Fetch quest completion data
        console.log('📥 Fetching quest completion data...');
        const questsResponse = await fetch(`${PRODUCTION_URL}/api/admin/export/quests?key=${ADMIN_KEY}`);
        const questsData = await questsResponse.json();
        
        console.log('\n🎯 QUEST COMPLETION STATS:');
        questsData.quest_completion_stats.forEach(quest => {
            console.log(`📋 ${quest.title}: ${quest.completion_count} completions (${quest.points_reward} points each)`);
        });
        
        // Fetch recent transactions
        console.log('\n📥 Fetching transaction data...');
        const transactionsResponse = await fetch(`${PRODUCTION_URL}/api/admin/export/transactions?key=${ADMIN_KEY}`);
        const transactionsData = await transactionsResponse.json();
        
        console.log(`\n💰 RECENT TRANSACTIONS (Last 10):`);
        transactionsData.transactions.slice(0, 10).forEach(tx => {
            const sign = tx.points_change > 0 ? '+' : '';
            console.log(`${tx.first_name || 'Unknown'}: ${sign}${tx.points_change} points (${tx.reason}) - ${tx.timestamp}`);
        });
        
        // Save all data to files
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        fs.writeFileSync(`production-users-${timestamp}.json`, JSON.stringify(usersData, null, 2));
        fs.writeFileSync(`production-quests-${timestamp}.json`, JSON.stringify(questsData, null, 2));
        fs.writeFileSync(`production-transactions-${timestamp}.json`, JSON.stringify(transactionsData, null, 2));
        
        // Create combined summary
        const summary = {
            timestamp: new Date().toISOString(),
            production_url: PRODUCTION_URL,
            summary: {
                total_users: usersData.total_users,
                total_points: usersData.summary.total_points,
                avg_points: usersData.summary.avg_points,
                total_transactions: transactionsData.total_transactions
            },
            top_users: usersData.users.slice(0, 10),
            quest_stats: questsData.quest_completion_stats,
            recent_transactions: transactionsData.transactions.slice(0, 20)
        };
        
        fs.writeFileSync(`production-summary-${timestamp}.json`, JSON.stringify(summary, null, 2));
        
        console.log('\n✅ DATA EXPORT COMPLETE!');
        console.log('📁 Files saved:');
        console.log(`   - production-users-${timestamp}.json`);
        console.log(`   - production-quests-${timestamp}.json`);
        console.log(`   - production-transactions-${timestamp}.json`);
        console.log(`   - production-summary-${timestamp}.json`);
        
    } catch (error) {
        console.error('❌ Error fetching production data:', error.message);
        
        if (error.message.includes('403')) {
            console.log('\n🔑 Make sure you deploy the updated server.js with admin endpoints first!');
        } else if (error.message.includes('ENOTFOUND')) {
            console.log('\n🌐 Check your internet connection and production URL');
        }
    }
}

// Check if we need to install node-fetch
try {
    require('node-fetch');
    fetchProductionData();
} catch (e) {
    console.log('📦 Installing node-fetch dependency...');
    const { execSync } = require('child_process');
    execSync('npm install node-fetch@2', { stdio: 'inherit' });
    console.log('✅ Dependency installed, running script...\n');
    delete require.cache[require.resolve('node-fetch')];
    fetchProductionData();
}