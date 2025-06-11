// PostgreSQL Database Configuration for Railway
const { Pool } = require('pg');

// Use Railway's provided DATABASE_URL or fallback to SQLite for local development
const isProduction = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;

let db;

if (isProduction && process.env.DATABASE_URL) {
    // PostgreSQL for production (Railway)
    console.log('DATABASE: Using PostgreSQL for production');
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    db = {
        query: (text, params) => pool.query(text, params),
        
        // SQLite-compatible wrapper methods
        all: async (sql, params, callback) => {
            try {
                const result = await pool.query(sql, params);
                callback(null, result.rows);
            } catch (err) {
                callback(err);
            }
        },
        
        get: async (sql, params, callback) => {
            try {
                const result = await pool.query(sql, params);
                callback(null, result.rows[0] || null);
            } catch (err) {
                callback(err);
            }
        },
        
        run: async (sql, params, callback) => {
            try {
                const result = await pool.query(sql, params);
                if (callback) {
                    const mockThis = {
                        lastID: result.insertId || result.rows[0]?.id,
                        changes: result.rowCount || 0
                    };
                    callback.call(mockThis, null);
                }
            } catch (err) {
                if (callback) callback(err);
            }
        },
        
        close: () => pool.end()
    };
} else {
    // SQLite for local development
    console.log('DATABASE: Using SQLite for local development');
    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');
    const fs = require('fs');

    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    const DB_PATH = path.join(dataDir, 'event_app.db');

    db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error('Error opening database', err.message);
        } else {
            console.log('Connected to the SQLite database.');
            db.run("PRAGMA foreign_keys = ON;", (fkErr) => {
                if (fkErr) console.error("Failed to enable foreign key support:", fkErr.message);
            });
        }
    });
}

const initDb = async () => {
    console.log('Initializing database schema...');
    
    if (isProduction && process.env.DATABASE_URL) {
        // PostgreSQL schema
        await initPostgreSQLSchema();
    } else {
        // SQLite schema (existing code)
        await initSQLiteSchema();
    }
};

const initPostgreSQLSchema = async () => {
    console.log('Setting up PostgreSQL schema...');
    
    try {
        // Create tables with PostgreSQL syntax
        await db.query(`
            CREATE TABLE IF NOT EXISTS Users (
                telegram_id VARCHAR(50) PRIMARY KEY,
                username VARCHAR(255),
                first_name VARCHAR(255),
                points INTEGER DEFAULT 0,
                bybit_uid VARCHAR(255),
                referrer_id VARCHAR(50),
                last_check_in TIMESTAMP,
                completed_quests TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (referrer_id) REFERENCES Users(telegram_id) ON DELETE SET NULL
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS Quests (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                points_reward INTEGER NOT NULL,
                type VARCHAR(50) CHECK(type IN ('qa', 'mcq', 'social_follow', 'daily')) DEFAULT 'qa',
                is_active BOOLEAN DEFAULT TRUE,
                quest_data TEXT,
                day_number INTEGER DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS UserQuests (
                user_id VARCHAR(50),
                quest_id INTEGER,
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, quest_id),
                FOREIGN KEY (user_id) REFERENCES Users(telegram_id) ON DELETE CASCADE
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS PointTransactions (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50),
                points_change INTEGER NOT NULL,
                reason VARCHAR(255),
                related_quest_id INTEGER,
                related_referred_user_id VARCHAR(50),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES Users(telegram_id) ON DELETE SET NULL,
                FOREIGN KEY (related_referred_user_id) REFERENCES Users(telegram_id) ON DELETE SET NULL
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS PendingReferrals (
                new_user_telegram_id VARCHAR(50) PRIMARY KEY,
                referrer_telegram_id VARCHAR(50) NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (referrer_telegram_id) REFERENCES Users(telegram_id) ON DELETE CASCADE
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS EventConfig (
                id INTEGER PRIMARY KEY,
                event_name VARCHAR(255),
                start_date TIMESTAMP,
                end_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('PostgreSQL schema initialized successfully');
        
        // Initialize event configuration only
        await initializeEventConfig();
        
        console.log('PostgreSQL initialization complete');
        
    } catch (error) {
        console.error('Error setting up PostgreSQL schema:', error);
        throw error;
    }
};

const initSQLiteSchema = () => {
    // Your existing SQLite initialization code
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Use existing SQLite schema from database.js
            const sqlite3Schema = `
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
            
            db.exec(sqlite3Schema, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('SQLite schema initialized');
                    resolve();
                }
            });
        });
    });
};

// Initialize event configuration
const initializeEventConfig = async () => {
    try {
        const config = await new Promise((resolve, reject) => {
            db.get("SELECT * FROM EventConfig WHERE id = 1", [], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!config) {
            // Set event start date to today at 00:00 UTC
            const startDate = new Date();
            startDate.setUTCHours(0, 0, 0, 0);
            
            // Event lasts 30 days
            const endDate = new Date(startDate);
            endDate.setUTCDate(startDate.getUTCDate() + 30);
            
            await new Promise((resolve, reject) => {
                db.run(
                    "INSERT INTO EventConfig (id, event_name, start_date, end_date) VALUES (1, 'Bybit City 30-Day Challenge', ?, ?)",
                    [startDate.toISOString(), endDate.toISOString()],
                    function(err) {
                        if (err) reject(err);
                        else {
                            console.log("EVENT_CONFIG: ✅ Event configuration created");
                            resolve(this);
                        }
                    }
                );
            });
        } else {
            console.log("EVENT_CONFIG: Configuration already exists");
        }
    } catch (error) {
        console.error("EVENT_CONFIG: Error:", error);
    }
};

// Function to add social quests
const addSocialQuestsSafely = async () => {
    const socialQuests = [
        { 
            title: 'Join Bybit Telegram', 
            description: 'Join our official Telegram Group.', 
            points_reward: 50, 
            type: 'social_follow', 
            quest_data: '{"url": "https://t.me/test3bybitG", "chatId": "-1002001387968"}' 
        },
        { 
            title: 'Join Bybit Telegram', 
            description: 'Join our official Telegram channel.', 
            points_reward: 50, 
            type: 'social_follow', 
            quest_data: '{"url": "https://t.me/test3bybitC", "chatId": "-1002033197403"}' 
        },            
        { 
            title: 'Follow Bybit on X', 
            description: 'Follow our official X (Twitter) account.', 
            points_reward: 50, 
            type: 'social_follow', 
            quest_data: '{"url": "https://twitter.com/bybit_official"}' 
        }
    ];
    
    for (const quest of socialQuests) {
        try {
            const existing = await new Promise((resolve, reject) => {
                db.get("SELECT id FROM Quests WHERE title = ?", [quest.title], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (!existing) {
                await new Promise((resolve, reject) => {
                    db.run(
                        "INSERT INTO Quests (title, description, points_reward, type, quest_data, is_active) VALUES (?, ?, ?, ?, ?, TRUE)",
                        [quest.title, quest.description, quest.points_reward, quest.type, quest.quest_data],
                        function(err) {
                            if (err) reject(err);
                            else {
                                console.log(`SOCIAL_QUESTS: ✅ Added "${quest.title}"`);
                                resolve(this);
                            }
                        }
                    );
                });
            }
        } catch (error) {
            console.error(`SOCIAL_QUESTS: Error adding "${quest.title}":`, error);
        }
    }
};

// Function to add daily quests
const addDailyQuestsSafely = async () => {
    const dailyQuests = [
        { day: 1, title: 'Day 1: P2P', description: 'Learn about P2P trading', question: 'What does Bybit\'s P2P platform allow users to do?', answer: 'Trade crypto directly' },
        { day: 2, title: 'Day 2: Launchpad', description: 'Discover new token launches', question: 'What is the main use of Bybit Launchpad?', answer: 'Token launches' },
        { day: 3, title: 'Day 3: Puzzle Hunt', description: 'Join the puzzle hunt', question: 'What do users collect in Bybit Puzzle Hunt?', answer: 'Puzzle pieces' },
        { day: 4, title: 'Day 4: Launchpool', description: 'Stake and earn rewards', question: 'What do users do in Launchpool to earn rewards?', answer: 'Stake tokens' },
        { day: 5, title: 'Day 5: Copy Trading', description: 'Copy expert traders', question: 'What does Copy Trading on Bybit allow you to do?', answer: 'Copy experts' },
        // Add more daily quests as needed...
    ];
    
    for (const quest of dailyQuests) {
        try {
            const existing = await new Promise((resolve, reject) => {
                db.get("SELECT id FROM Quests WHERE title = ?", [quest.title], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (!existing) {
                const questData = JSON.stringify({
                    question: quest.question,
                    answer: quest.answer
                });
                
                await new Promise((resolve, reject) => {
                    db.run(
                        "INSERT INTO Quests (title, description, points_reward, type, quest_data, day_number, is_active) VALUES (?, ?, ?, ?, ?, ?, TRUE)",
                        [quest.title, quest.description, 20, 'daily', questData, quest.day],
                        function(err) {
                            if (err) reject(err);
                            else {
                                console.log(`DAILY_QUESTS: ✅ Added "${quest.title}"`);
                                resolve(this);
                            }
                        }
                    );
                });
            }
        } catch (error) {
            console.error(`DAILY_QUESTS: Error adding "${quest.title}":`, error);
        }
    }
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
                    // Return day 1 for newly created event
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
    if (isProduction && process.env.DATABASE_URL) {
        // PostgreSQL version with transactions
        addPointsPostgreSQL(userId, points, reason, relatedQuestId, relatedReferredUserId, callback);
    } else {
        // SQLite version (existing code)
        addPointsSQLite(userId, points, reason, relatedQuestId, relatedReferredUserId, callback);
    }
};

const addPointsPostgreSQL = async (userId, points, reason, relatedQuestId = null, relatedReferredUserId = null, callback) => {
    try {
        // Start transaction
        await db.query('BEGIN');
        
        // Add points to user
        const updateResult = await db.query(
            'UPDATE Users SET points = points + $1 WHERE telegram_id = $2',
            [points, userId]
        );
        
        if (updateResult.rowCount === 0) {
            await db.query('ROLLBACK');
            return callback(new Error("User not found or points not updated."));
        }
        
        // Log transaction
        await db.query(
            'INSERT INTO PointTransactions (user_id, points_change, reason, related_quest_id, related_referred_user_id) VALUES ($1, $2, $3, $4, $5)',
            [userId, points, reason, relatedQuestId, relatedReferredUserId]
        );
        
        // Check for referrer and give bonus
        const referrerResult = await db.query(
            'SELECT referrer_id FROM Users WHERE telegram_id = $1 AND referrer_id IS NOT NULL',
            [userId]
        );
        
        if (referrerResult.rows.length > 0) {
            const referrerId = referrerResult.rows[0].referrer_id;
            const referralBonus = Math.floor(points * 0.10); // 10% bonus
            
            if (referralBonus > 0) {
                await db.query(
                    'UPDATE Users SET points = points + $1 WHERE telegram_id = $2',
                    [referralBonus, referrerId]
                );
                
                await db.query(
                    'INSERT INTO PointTransactions (user_id, points_change, reason, related_referred_user_id) VALUES ($1, $2, $3, $4)',
                    [referrerId, referralBonus, 'referral_bonus', userId]
                );
            }
        }
        
        await db.query('COMMIT');
        callback(null);
        
    } catch (error) {
        await db.query('ROLLBACK');
        callback(error);
    }
};

const addPointsSQLite = (userId, points, reason, relatedQuestId = null, relatedReferredUserId = null, callback) => {
    // Your existing SQLite addPoints code
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