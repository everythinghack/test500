// bybit-event-mini-app/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
const DB_PATH = path.join(dataDir, 'event_app.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run("PRAGMA foreign_keys = ON;", (fkErr) => {
            if (fkErr) console.error("Failed to enable foreign key support:", fkErr.message);
        });
    }
});

const initDb = () => {
    db.serialize(() => {
        console.log('Initializing database schema...');
        db.run(`CREATE TABLE IF NOT EXISTS Users (
            telegram_id TEXT PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            points INTEGER DEFAULT 0,
            bybit_uid TEXT,
            referrer_id TEXT,
            last_check_in TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (referrer_id) REFERENCES Users(telegram_id) ON DELETE SET NULL ON UPDATE CASCADE
        )`);
        
        // Check if created_at column exists, add it if not
        db.all("PRAGMA table_info(Users)", (err, rows) => {
            if (err) {
                console.error("Error checking Users table schema:", err);
                return;
            }
            
            console.log("Table info rows:", rows);
            
            // If created_at column doesn't exist, add it
            if (!Array.isArray(rows) || !rows.some(row => row.name === 'created_at')) {
                db.run("ALTER TABLE Users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP", (err) => {
                    if (err) {
                        console.error("Error adding created_at column to Users table:", err);
                    } else {
                        console.log("Added created_at column to Users table");
                    }
                });
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS Quests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            points_reward INTEGER NOT NULL,
            type TEXT CHECK(type IN ('qa', 'mcq', 'social_follow')) DEFAULT 'qa',
            is_active BOOLEAN DEFAULT TRUE,
            quest_data TEXT 
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS UserQuests (
            user_id INTEGER,
            quest_id INTEGER,
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, quest_id),
            FOREIGN KEY (user_id) REFERENCES Users(telegram_id) ON DELETE CASCADE ON UPDATE CASCADE,
            FOREIGN KEY (quest_id) REFERENCES Quests(id) ON DELETE CASCADE ON UPDATE CASCADE
        )`);
        
        db.run(`CREATE TABLE IF NOT EXISTS PointTransactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            points_change INTEGER NOT NULL,
            reason TEXT,
            related_quest_id INTEGER,
            related_referred_user_id INTEGER,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES Users(telegram_id) ON DELETE SET NULL ON UPDATE CASCADE,
            FOREIGN KEY (related_quest_id) REFERENCES Quests(id) ON DELETE SET NULL ON UPDATE CASCADE,
            FOREIGN KEY (related_referred_user_id) REFERENCES Users(telegram_id) ON DELETE SET NULL ON UPDATE CASCADE
        )`);

        // New table for pending referrals
        db.run(`CREATE TABLE IF NOT EXISTS PendingReferrals (
            new_user_telegram_id INTEGER PRIMARY KEY,
            referrer_telegram_id INTEGER NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (referrer_telegram_id) REFERENCES Users(telegram_id) ON DELETE CASCADE ON UPDATE CASCADE
        )`);

        console.log('Database schema initialized (or already exists).');

        // =====================================
        // QUEST MANAGEMENT SYSTEM
        // Add new quests here - they will be safely added without affecting existing data
        // =====================================
        
        const questsToAdd = [
            // ORIGINAL QUESTS (will be skipped if already exist)
            { 
                id: 'join_telegram_1', 
                title: 'Join Bybit Telegram', 
                description: 'Join our official Telegram channel.', 
                points_reward: 50, 
                type: 'social_follow', 
                quest_data: '{"url": "https://t.me/test3bybitG", "chatId": "-1002001387968"}' 
            },
            { 
                id: 'follow_twitter_1', 
                title: 'Follow Bybit on X', 
                description: 'Follow our official X (Twitter) account.', 
                points_reward: 50, 
                type: 'social_follow', 
                quest_data: '{"url": "https://twitter.com/bybit_official"}' 
            },
            { 
                id: 'what_is_bybit_1', 
                title: 'What is Bybit?', 
                description: 'Answer this simple question.', 
                points_reward: 20, 
                type: 'qa', 
                quest_data: '{"question": "What is Bybit?", "answer": "A crypto exchange"}' 
            },
            
            // =====================================
            // ADD YOUR NEW QUESTS BELOW THIS LINE
            // Copy the template and modify as needed
            // =====================================
            
            // Example Q&A Quest (uncomment to activate):
            { 
                id: 'crypto_quiz_1',
                title: 'DeFi Knowledge Test', 
                description: 'Test your knowledge about decentralized finance!', 
                points_reward: 30, 
                type: 'qa', 
                quest_data: '{"question": "What does DeFi stand for?", "answer": "Decentralized Finance"}' 
            },
            
            // Example Social Quest (uncomment to activate):
            { 
                id: 'instagram_follow_1',
                title: 'Follow on Instagram', 
                description: 'Follow our Instagram account for updates.', 
                points_reward: 35, 
                type: 'social_follow', 
                quest_data: '{"url": "https://instagram.com/bybit_official"}' 
            },
            
            // Example Advanced Q&A Quest:
            { 
                id: 'bitcoin_quiz_1',
                title: 'Bitcoin Basics', 
                description: 'Answer this question about Bitcoin.', 
                points_reward: 25, 
                type: 'qa', 
                quest_data: '{"question": "What is the maximum supply of Bitcoin?", "answer": "21 million"}' 
            }
            
            // Template for adding more quests:
            // { 
            //     id: 'unique_quest_id',
            //     title: 'Your Quest Title', 
            //     description: 'What users need to do', 
            //     points_reward: 50, 
            //     type: 'qa', // or 'social_follow'
            //     quest_data: '{"question": "Your question?", "answer": "Expected answer"}' // for Q&A
            //     // quest_data: '{"url": "https://social.media/link"}' // for social
            //     // quest_data: '{"url": "https://t.me/channel", "chatId": "-100123456"}' // for Telegram with verification
            // }
        ];

        // Safely add quests (only new ones)
        addQuestsSafely(questsToAdd);
    });
};

// Function to safely add quests without affecting existing data
const addQuestsSafely = (questsToAdd) => {
    console.log('QUEST_MANAGER: Checking for new quests to add...');
    
    questsToAdd.forEach(quest => {
        // Check if quest with this title already exists
        db.get("SELECT id FROM Quests WHERE title = ?", [quest.title], (err, existingQuest) => {
            if (err) {
                console.error(`QUEST_MANAGER: Error checking quest "${quest.title}":`, err);
                return;
            }
            
            if (existingQuest) {
                console.log(`QUEST_MANAGER: Quest "${quest.title}" already exists, skipping...`);
                return;
            }
            
            // Quest doesn't exist, add it
            db.run(
                "INSERT INTO Quests (title, description, points_reward, type, quest_data, is_active) VALUES (?, ?, ?, ?, ?, TRUE)",
                [quest.title, quest.description, quest.points_reward, quest.type, quest.quest_data],
                function(err) {
                    if (err) {
                        console.error(`QUEST_MANAGER: Error adding quest "${quest.title}":`, err);
                    } else {
                        console.log(`QUEST_MANAGER: ✅ Added new quest "${quest.title}" (ID: ${this.lastID})`);
                    }
                }
            );
        });
    });
};

// Function to add points and handle referral bonus
const addPoints = (userId, points, reason, relatedQuestId = null, relatedReferredUserId = null, callback) => {
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // Add points to the user
        db.run(`UPDATE Users SET points = points + ? WHERE telegram_id = ?`, [points, userId], function(err) {
            if (err) {
                db.run("ROLLBACK");
                return callback(err);
            }
            if (this.changes === 0) {
                 db.run("ROLLBACK");
                 return callback(new Error("User not found or points not updated."));
            }
            // Log transaction
            db.run(`INSERT INTO PointTransactions (user_id, points_change, reason, related_quest_id, related_referred_user_id) 
                    VALUES (?, ?, ?, ?, ?)`,
                    [userId, points, reason, relatedQuestId, relatedReferredUserId], (err) => {
                if (err) {
                    db.run("ROLLBACK");
                    return callback(err);
                }
            });

            // Check if this user was referred and give bonus to referrer
            db.get(`SELECT referrer_id FROM Users WHERE telegram_id = ? AND referrer_id IS NOT NULL`, [userId], (err, row) => {
                if (err) {
                    db.run("ROLLBACK");
                    return callback(err);
                }
                if (row && row.referrer_id) {
                    const referrerId = row.referrer_id;
                    const referralBonus = Math.floor(points * 0.10); // 10% bonus
                    if (referralBonus > 0) {
                        db.run(`UPDATE Users SET points = points + ? WHERE telegram_id = ?`, [referralBonus, referrerId], function(err) {
                            if (err) {
                                db.run("ROLLBACK");
                                return callback(err);
                            }
                            // Log referral bonus transaction
                            db.run(`INSERT INTO PointTransactions (user_id, points_change, reason, related_referred_user_id) 
                                    VALUES (?, ?, ?, ?)`,
                                    [referrerId, referralBonus, 'referral_bonus', userId], (err) => {
                                if (err) {
                                    db.run("ROLLBACK");
                                    return callback(err);
                                }
                                db.run("COMMIT", callback);
                            });
                        });
                    } else {
                        db.run("COMMIT", callback);
                    }
                } else {
                    db.run("COMMIT", callback);
                }
            });
        });
    });
};


module.exports = { db, initDb, addPoints };




