#!/usr/bin/env node

// Script to clean up duplicate quests
const { db } = require('./database');

console.log("🧹 Cleaning up duplicate quests...\n");

// First, let's see what we have
db.all("SELECT * FROM Quests ORDER BY id", (err, quests) => {
    if (err) {
        console.error("Error fetching quests:", err);
        return;
    }
    
    console.log(`Found ${quests.length} quests. Looking for duplicates...\n`);
    
    // Group by title to find duplicates
    const questGroups = {};
    quests.forEach(quest => {
        const key = quest.title.toLowerCase().trim();
        if (!questGroups[key]) {
            questGroups[key] = [];
        }
        questGroups[key].push(quest);
    });
    
    // Find duplicates
    const duplicates = Object.values(questGroups).filter(group => group.length > 1);
    
    if (duplicates.length === 0) {
        console.log("✅ No duplicates found!");
        db.close();
        return;
    }
    
    console.log(`🔍 Found ${duplicates.length} sets of duplicates:`);
    duplicates.forEach((group, index) => {
        console.log(`\n${index + 1}. "${group[0].title}" (${group.length} duplicates):`);
        group.forEach(quest => {
            console.log(`   - ID: ${quest.id}, Points: ${quest.points_reward}, Type: ${quest.type}`);
        });
    });
    
    console.log("\n🗑️  Removing duplicates (keeping the first occurrence of each)...\n");
    
    let deletePromises = [];
    duplicates.forEach(group => {
        // Keep the first (lowest ID), delete the rest
        const toKeep = group[0];
        const toDelete = group.slice(1);
        
        console.log(`✅ Keeping: "${toKeep.title}" (ID: ${toKeep.id})`);
        
        toDelete.forEach(quest => {
            console.log(`❌ Deleting: "${quest.title}" (ID: ${quest.id})`);
            
            deletePromises.push(new Promise((resolve, reject) => {
                // First, delete any user quest completions for this quest
                db.run("DELETE FROM UserQuests WHERE quest_id = ?", [quest.id], (err) => {
                    if (err) {
                        console.error(`Error deleting UserQuests for quest ${quest.id}:`, err);
                        return reject(err);
                    }
                    
                    // Then delete the quest itself
                    db.run("DELETE FROM Quests WHERE id = ?", [quest.id], (err) => {
                        if (err) {
                            console.error(`Error deleting quest ${quest.id}:`, err);
                            return reject(err);
                        }
                        resolve();
                    });
                });
            }));
        });
    });
    
    // Execute all deletions
    Promise.all(deletePromises).then(() => {
        console.log("\n✅ Cleanup complete! Checking final state...\n");
        
        // Verify cleanup
        db.all("SELECT * FROM Quests ORDER BY id", (err, finalQuests) => {
            if (err) {
                console.error("Error checking final state:", err);
                return;
            }
            
            console.log(`📋 Final quest count: ${finalQuests.length}`);
            finalQuests.forEach((quest, index) => {
                console.log(`${index + 1}. ${quest.title} (ID: ${quest.id}, Type: ${quest.type})`);
            });
            
            db.close();
            console.log("\n🎉 Database cleanup completed successfully!");
        });
    }).catch(err => {
        console.error("Error during cleanup:", err);
        db.close();
    });
});