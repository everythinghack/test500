// SQLite Database Configuration for Cloud Run
// Uses SQLite for both development and production

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(dataDir, 'event_app.db');

// Initialize SQLite database
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
    return new Promise((resolve, reject) => {
        console.log('Initializing SQLite database schema...');
        
        db.serialize(() => {
            const schema = `
                CREATE TABLE IF NOT EXISTS Users (
                    telegram_id TEXT PRIMARY KEY,
                    username TEXT,
                    first_name TEXT,
                    points INTEGER DEFAULT 0,
                    bybit_uid TEXT,
                    referrer_id TEXT,
                    last_check_in TIMESTAMP,
                    completed_quests TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (referrer_id) REFERENCES Users(telegram_id) ON DELETE SET NULL ON UPDATE CASCADE
                );
                
                CREATE TABLE IF NOT EXISTS Quests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT,
                    points_reward INTEGER NOT NULL,
                    type TEXT CHECK(type IN ('qa', 'mcq', 'social_follow', 'daily')) DEFAULT 'qa',
                    is_active BOOLEAN DEFAULT TRUE,
                    quest_data TEXT,
                    day_number INTEGER DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS UserQuests (
                    user_id INTEGER,
                    quest_id INTEGER,
                    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, quest_id),
                    FOREIGN KEY (user_id) REFERENCES Users(telegram_id) ON DELETE CASCADE ON UPDATE CASCADE
                );
                
                CREATE TABLE IF NOT EXISTS PointTransactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    points_change INTEGER NOT NULL,
                    reason TEXT,
                    related_quest_id INTEGER,
                    related_referred_user_id INTEGER,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES Users(telegram_id) ON DELETE SET NULL ON UPDATE CASCADE,
                    FOREIGN KEY (related_referred_user_id) REFERENCES Users(telegram_id) ON DELETE SET NULL ON UPDATE CASCADE
                );
                
                CREATE TABLE IF NOT EXISTS PendingReferrals (
                    new_user_telegram_id INTEGER PRIMARY KEY,
                    referrer_telegram_id INTEGER NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    processed BOOLEAN DEFAULT FALSE,
                    FOREIGN KEY (referrer_telegram_id) REFERENCES Users(telegram_id) ON DELETE CASCADE ON UPDATE CASCADE
                );
                
                CREATE TABLE IF NOT EXISTS EventConfig (
                    id INTEGER PRIMARY KEY,
                    event_name TEXT,
                    start_date TIMESTAMP,
                    end_date TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `;
            
            db.exec(schema, (err) => {
                if (err) {
                    console.error('Error creating database schema:', err);
                    reject(err);
                } else {
                    console.log('✅ SQLite database schema created successfully');
                    
                    // Initialize event configuration only if it doesn't exist
                    initializeEventConfig().then(() => {
                        console.log('✅ Database initialization complete');
                        resolve();
                    }).catch(reject);
                }
            });
        });
    });
};

// Initialize event configuration (only once)
const initializeEventConfig = () => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM EventConfig WHERE id = 1", [], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (!row) {
                // Set event start date to today at 00:00 UTC
                const startDate = new Date();
                startDate.setUTCHours(0, 0, 0, 0);
                
                // Event lasts 30 days
                const endDate = new Date(startDate);
                endDate.setUTCDate(startDate.getUTCDate() + 30);
                
                db.run(
                    "INSERT INTO EventConfig (id, event_name, start_date, end_date) VALUES (1, 'Bybit City 30-Day Challenge', ?, ?)",
                    [startDate.toISOString(), endDate.toISOString()],
                    function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            console.log("EVENT_CONFIG: ✅ Event configuration created");
                            resolve();
                        }
                    }
                );
            } else {
                console.log("EVENT_CONFIG: Configuration already exists");
                resolve();
            }
        });
    });
};

// Function to get current day of event (1-30)
const getCurrentEventDay = (callback) => {
    db.get("SELECT start_date FROM EventConfig WHERE id = 1", [], (err, config) => {
        if (err || !config) {
            // Auto-create EventConfig if it doesn't exist
            console.log("EventConfig not found, creating it...");
            
            const startDate = new Date();
            startDate.setUTCHours(0, 0, 0, 0);
            const endDate = new Date(startDate);
            endDate.setUTCDate(startDate.getUTCDate() + 30);
            
            db.run(
                "INSERT OR REPLACE INTO EventConfig (id, event_name, start_date, end_date) VALUES (1, 'Bybit City 30-Day Challenge', ?, ?)",
                [startDate.toISOString(), endDate.toISOString()],
                function(insertErr) {
                    if (insertErr) {
                        console.error("Failed to create EventConfig:", insertErr);
                        return callback(insertErr, null);
                    }
                    
                    console.log("EventConfig created successfully");
                    callback(null, 1);
                }
            );
            return;
        }
        
        const startDate = new Date(config.start_date);
        const currentDate = new Date();
        
        // Calculate days since start (starting from day 1)
        const timeDiff = currentDate.getTime() - startDate.getTime();
        const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24)) + 1;
        
        // Event is 30 days, cap at day 30
        const eventDay = Math.min(Math.max(daysDiff, 1), 30);
        
        callback(null, eventDay);
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

module.exports = { db, initDb, addPoints, getCurrentEventDay };