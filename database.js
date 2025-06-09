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
            last_check_in DATE,
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
            type TEXT CHECK(type IN ('qa', 'mcq', 'social_follow', 'daily_checkin_placeholder')) DEFAULT 'qa',
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

        // Add some sample quests (run this only once or check if exists)
        const sampleQuests = [
            { title: 'Daily Check-in Bonus', description: 'Get points for checking in daily!', points_reward: 10, type: 'daily_checkin_placeholder', quest_data: '{}' },
            { title: 'Join Bybit Telegram', description: 'Join our official Telegram channel.', points_reward: 50, type: 'social_follow', quest_data: '{"url": "https://t.me/test3bybitG", "chatId": "-1002001387968"}' }, // Replace with your actual chat ID
            { title: 'Follow Bybit on X', description: 'Follow our official X (Twitter) account.', points_reward: 50, type: 'social_follow', quest_data: '{"url": "https://twitter.com/bybit_official"}' },
            { title: 'What is Bybit?', description: 'Answer this simple question.', points_reward: 20, type: 'qa', quest_data: '{"question": "What is Bybit?", "answer": "A crypto exchange"}' }
        ];

        const stmt = db.prepare("INSERT OR IGNORE INTO Quests (title, description, points_reward, type, quest_data) VALUES (?, ?, ?, ?, ?)");
        sampleQuests
            .filter(quest => quest.type !== 'daily_checkin_placeholder') // Don't add placeholder to DB as a real quest
            .forEach(quest => {
                stmt.run(quest.title, quest.description, quest.points_reward, quest.type, quest.quest_data);
            });
        stmt.finalize(() => console.log('Sample quests added/verified.'));
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




