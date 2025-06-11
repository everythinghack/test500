// User Data Export Script
const { db } = require('./database.js');

async function exportUsers() {
    console.log('📊 BYBIT EVENT APP - USER DATA EXPORT');
    console.log('======================================\n');
    
    // Get all users
    const users = await new Promise((resolve, reject) => {
        db.all(`
            SELECT 
                u.telegram_id, 
                u.username, 
                u.first_name, 
                u.points, 
                u.bybit_uid, 
                u.referrer_id,
                u.created_at,
                (SELECT COUNT(*) FROM Users WHERE referrer_id = u.telegram_id) as referral_count
            FROM Users u 
            ORDER BY u.created_at DESC
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    // Get quest completion stats
    const questStats = await new Promise((resolve, reject) => {
        db.all(`
            SELECT 
                COUNT(DISTINCT user_id) as users_completed,
                COUNT(*) as total_completions,
                quest_id
            FROM UserQuests 
            GROUP BY quest_id
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    // Get point transaction summary
    const pointStats = await new Promise((resolve, reject) => {
        db.get(`
            SELECT 
                SUM(points_change) as total_points_distributed,
                COUNT(*) as total_transactions,
                COUNT(DISTINCT user_id) as active_users
            FROM PointTransactions
        `, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

    // Display summary
    console.log('📈 SUMMARY STATISTICS');
    console.log(`Total Users: ${users.length}`);
    console.log(`Total Points Distributed: ${pointStats.total_points_distributed || 0}`);
    console.log(`Total Transactions: ${pointStats.total_transactions || 0}`);
    console.log(`Active Users: ${pointStats.active_users || 0}`);
    console.log('\n' + '='.repeat(50) + '\n');

    // Display each user
    console.log('👥 USER DETAILS');
    users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.first_name || 'Unknown'} (@${user.username || 'no_username'})`);
        console.log(`   📱 Telegram ID: ${user.telegram_id}`);
        console.log(`   🏆 Points: ${user.points}`);
        console.log(`   💰 Bybit UID: ${user.bybit_uid || 'Not submitted'}`);
        console.log(`   👨‍👩‍👧‍👦 Referrals: ${user.referral_count}`);
        console.log(`   📅 Joined: ${user.created_at}`);
        if (user.referrer_id) {
            console.log(`   🔗 Referred by: ${user.referrer_id}`);
        }
        console.log('');
    });

    // Export to JSON
    const exportData = {
        timestamp: new Date().toISOString(),
        summary: {
            total_users: users.length,
            total_points_distributed: pointStats.total_points_distributed || 0,
            total_transactions: pointStats.total_transactions || 0,
            active_users: pointStats.active_users || 0
        },
        users: users,
        quest_stats: questStats
    };

    require('fs').writeFileSync('./user-export.json', JSON.stringify(exportData, null, 2));
    console.log('✅ Data exported to user-export.json');
    
    db.close();
}

exportUsers().catch(console.error);