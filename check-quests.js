#!/usr/bin/env node

// Script to check current quests in database
const { db } = require('./database');

console.log("🔍 Checking current quests in database...\n");

// Get all quests
db.all("SELECT * FROM Quests ORDER BY id", (err, quests) => {
    if (err) {
        console.error("Error fetching quests:", err);
        return;
    }
    
    console.log(`📋 Found ${quests.length} quests in database:\n`);
    
    quests.forEach((quest, index) => {
        console.log(`${index + 1}. ID: ${quest.id}`);
        console.log(`   Title: ${quest.title}`);
        console.log(`   Description: ${quest.description}`);
        console.log(`   Points: ${quest.points_reward}`);
        console.log(`   Type: ${quest.type}`);
        console.log(`   Active: ${quest.is_active ? 'Yes' : 'No'}`);
        
        if (quest.quest_data) {
            try {
                const data = JSON.parse(quest.quest_data);
                console.log(`   Data: ${JSON.stringify(data, null, 6)}`);
            } catch (e) {
                console.log(`   Data: ${quest.quest_data}`);
            }
        }
        console.log(''); // Empty line
    });
    
    // Group by type
    const byType = quests.reduce((acc, quest) => {
        acc[quest.type] = (acc[quest.type] || 0) + 1;
        return acc;
    }, {});
    
    console.log("📊 Quests by type:");
    Object.entries(byType).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} quests`);
    });
    
    db.close();
});