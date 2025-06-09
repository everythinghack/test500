#!/usr/bin/env node

// Real-time database monitoring for testing
const { db } = require('./database');

console.log("🔍 Starting database monitoring...");
console.log("Press Ctrl+C to stop\n");

let lastUserCount = 0;
let lastTransactionCount = 0;
let lastQuestCount = 0;

function displayStats() {
    const timestamp = new Date().toLocaleTimeString();
    
    // Get current counts
    db.get("SELECT COUNT(*) as count FROM Users", (err, userResult) => {
        if (err) return console.error("Users error:", err);
        
        db.get("SELECT COUNT(*) as count FROM PointTransactions", (err, txResult) => {
            if (err) return console.error("Transactions error:", err);
            
            db.get("SELECT COUNT(*) as count FROM UserQuests", (err, questResult) => {
                if (err) return console.error("UserQuests error:", err);
                
                const userCount = userResult.count;
                const txCount = txResult.count;
                const questCount = questResult.count;
                
                // Show changes
                const userChange = userCount - lastUserCount;
                const txChange = txCount - lastTransactionCount;
                const questChange = questCount - lastQuestCount;
                
                if (userChange > 0 || txChange > 0 || questChange > 0) {
                    console.log(`\n⚡ [${timestamp}] ACTIVITY DETECTED:`);
                    if (userChange > 0) console.log(`   👤 +${userChange} new users (total: ${userCount})`);
                    if (txChange > 0) console.log(`   💰 +${txChange} new transactions (total: ${txCount})`);
                    if (questChange > 0) console.log(`   ✅ +${questChange} quests completed (total: ${questCount})`);
                    
                    // Show latest user activity
                    if (userChange > 0) {
                        db.all("SELECT telegram_id, username, first_name, points, created_at FROM Users ORDER BY created_at DESC LIMIT ?", [userChange], (err, newUsers) => {
                            if (!err && newUsers.length > 0) {
                                console.log("   📋 New users:");
                                newUsers.forEach(user => {
                                    console.log(`      • ${user.first_name || user.username || 'User'} (ID: ${user.telegram_id}) - ${user.points} points`);
                                });
                            }
                        });
                    }
                    
                    // Show latest transactions
                    if (txChange > 0) {
                        db.all("SELECT user_id, points_change, reason, timestamp FROM PointTransactions ORDER BY timestamp DESC LIMIT ?", [txChange], (err, newTx) => {
                            if (!err && newTx.length > 0) {
                                console.log("   💸 Recent transactions:");
                                newTx.forEach(tx => {
                                    console.log(`      • User ${tx.user_id}: ${tx.points_change > 0 ? '+' : ''}${tx.points_change} points (${tx.reason})`);
                                });
                            }
                        });
                    }
                }
                
                lastUserCount = userCount;
                lastTransactionCount = txCount;
                lastQuestCount = questCount;
            });
        });
    });
}

// Initial display
setTimeout(() => {
    db.get("SELECT COUNT(*) as count FROM Users", (err, result) => {
        if (!err) lastUserCount = result.count;
    });
    db.get("SELECT COUNT(*) as count FROM PointTransactions", (err, result) => {
        if (!err) lastTransactionCount = result.count;
    });
    db.get("SELECT COUNT(*) as count FROM UserQuests", (err, result) => {
        if (!err) lastQuestCount = result.count;
    });
    
    console.log(`📊 Current database stats:`);
    console.log(`   👤 Users: ${lastUserCount}`);
    console.log(`   💰 Transactions: ${lastTransactionCount}`);
    console.log(`   ✅ Completed quests: ${lastQuestCount}`);
    console.log(`\nWatching for changes...`);
}, 1000);

// Monitor every 2 seconds
setInterval(displayStats, 2000);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Stopping database monitoring...');
    db.close();
    process.exit(0);
});