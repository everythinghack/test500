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
            type TEXT CHECK(type IN ('qa', 'mcq', 'social_follow', 'daily')) DEFAULT 'qa',
            is_active BOOLEAN DEFAULT TRUE,
            quest_data TEXT,
            day_number INTEGER DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Add new columns to existing Quests table if they don't exist
        db.all("PRAGMA table_info(Quests)", (err, columns) => {
            if (err) {
                console.error("Error checking Quests table schema:", err);
                return;
            }
            
            const columnNames = columns.map(col => col.name);
            
            if (!columnNames.includes('day_number')) {
                db.run("ALTER TABLE Quests ADD COLUMN day_number INTEGER DEFAULT NULL", (err) => {
                    if (err) {
                        console.error("Error adding day_number column:", err);
                    } else {
                        console.log("Added day_number column to Quests table");
                    }
                });
            }
            
            if (!columnNames.includes('created_at')) {
                db.run("ALTER TABLE Quests ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP", (err) => {
                    if (err) {
                        console.error("Error adding created_at column to Quests:", err);
                    } else {
                        console.log("Added created_at column to Quests table");
                    }
                });
            }
        });

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

        // Table for event configuration
        db.run(`CREATE TABLE IF NOT EXISTS EventConfig (
            id INTEGER PRIMARY KEY,
            event_name TEXT,
            start_date TIMESTAMP,
            end_date TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        console.log('Database schema initialized (or already exists).');

        // =====================================
        // BYBIT CITY DAILY QUEST SYSTEM
        // Unlocks one quest per day at 00:00 UTC
        // =====================================
        
        // Initialize event configuration
        initializeEventConfig();
        
        // Social follow quests (always available)
        const socialQuests = [
            { 
                title: 'Join Bybit Telegram', 
                description: 'Join our official Telegram channel.', 
                points_reward: 50, 
                type: 'social_follow', 
                quest_data: '{"url": "https://t.me/test3bybitG", "chatId": "-1002001387968"}' 
            },
            { 
                title: 'Follow Bybit on X', 
                description: 'Follow our official X (Twitter) account.', 
                points_reward: 50, 
                type: 'social_follow', 
                quest_data: '{"url": "https://twitter.com/bybit_official"}' 
            }
        ];
        
        // Daily quests for Bybit City (30 days)
        const dailyQuests = [
            { day: 1, title: 'Day 1: P2P', description: 'Learn about P2P trading', question: 'What does Bybit\'s P2P platform allow users to do?', answer: 'Trade crypto directly' },
            { day: 2, title: 'Day 2: Launchpad', description: 'Discover new token launches', question: 'What is the main use of Bybit Launchpad?', answer: 'Token launches' },
            { day: 3, title: 'Day 3: Puzzle Hunt', description: 'Join the puzzle hunt', question: 'What do users collect in Bybit Puzzle Hunt?', answer: 'Puzzle pieces' },
            { day: 4, title: 'Day 4: Launchpool', description: 'Stake and earn rewards', question: 'What do users do in Launchpool to earn rewards?', answer: 'Stake tokens' },
            { day: 5, title: 'Day 5: Copy Trading', description: 'Copy expert traders', question: 'What does Copy Trading on Bybit allow you to do?', answer: 'Copy experts' },
            { day: 6, title: 'Day 6: Dual Asset', description: 'Understand dual asset investments', question: 'What determines the yield in Dual Asset?', answer: 'Price direction' },
            { day: 7, title: 'Day 7: Bybit Card', description: 'Spend crypto anywhere', question: 'What can you do with the Bybit Card?', answer: 'Spend crypto' },
            { day: 8, title: 'Day 8: Spot Trading', description: 'Trade tokens instantly', question: 'Where do you buy and sell tokens instantly?', answer: 'Spot market' },
            { day: 9, title: 'Day 9: Derivatives', description: 'Advanced trading contracts', question: 'What kind of contracts can you trade on Derivatives?', answer: 'Perpetuals' },
            { day: 10, title: 'Day 10: Futures Trading', description: 'Trade cryptocurrency futures', question: 'What type of trading involves contracts for future delivery?', answer: 'Futures trading' },
            { day: 11, title: 'Day 11: Options Trading', description: 'Trade with options contracts', question: 'What gives you the right but not obligation to buy or sell?', answer: 'Options' },
            { day: 12, title: 'Day 12: Margin Trading', description: 'Trade with borrowed funds', question: 'What allows you to trade with borrowed funds?', answer: 'Margin trading' },
            { day: 13, title: 'Day 13: Grid Trading', description: 'Automated trading strategy', question: 'What trading bot places buy and sell orders automatically?', answer: 'Grid bot' },
            { day: 14, title: 'Day 14: DCA Bot', description: 'Dollar cost averaging strategy', question: 'What strategy involves buying at regular intervals?', answer: 'Dollar cost averaging' },
            { day: 15, title: 'Day 15: Yield Farming', description: 'Earn passive income', question: 'What do you do to earn rewards from liquidity provision?', answer: 'Yield farming' },
            { day: 16, title: 'Day 16: Liquidity Mining', description: 'Provide liquidity for rewards', question: 'What do you provide to pools to earn mining rewards?', answer: 'Liquidity' },
            { day: 17, title: 'Day 17: Staking Rewards', description: 'Stake tokens for rewards', question: 'What do you lock up to earn staking rewards?', answer: 'Tokens' },
            { day: 18, title: 'Day 18: NFT Marketplace', description: 'Trade digital collectibles', question: 'What type of digital assets are traded on NFT marketplace?', answer: 'Non-fungible tokens' },
            { day: 19, title: 'Day 19: Web3 Wallet', description: 'Manage your crypto assets', question: 'What wallet type gives you full control of private keys?', answer: 'Web3 wallet' },
            { day: 20, title: 'Day 20: Cross Margin', description: 'Advanced margin trading', question: 'What margin type shares balance across all positions?', answer: 'Cross margin' },
            { day: 21, title: 'Day 21: Isolated Margin', description: 'Individual position margin', question: 'What margin type limits risk to individual positions?', answer: 'Isolated margin' },
            { day: 22, title: 'Day 22: Leverage Trading', description: 'Amplify your trading power', question: 'What multiplies your trading position size?', answer: 'Leverage' },
            { day: 23, title: 'Day 23: Stop Loss', description: 'Risk management tool', question: 'What order type helps limit your losses?', answer: 'Stop loss' },
            { day: 24, title: 'Day 24: Take Profit', description: 'Secure your gains', question: 'What order type automatically secures profits?', answer: 'Take profit' },
            { day: 25, title: 'Day 25: Market Orders', description: 'Instant trade execution', question: 'What order type executes immediately at market price?', answer: 'Market order' },
            { day: 26, title: 'Day 26: Limit Orders', description: 'Set your desired price', question: 'What order type executes only at specified price?', answer: 'Limit order' },
            { day: 27, title: 'Day 27: API Trading', description: 'Algorithmic trading', question: 'What allows automated trading through programming?', answer: 'API trading' },
            { day: 28, title: 'Day 28: Mobile Trading', description: 'Trade on the go', question: 'What allows you to trade from your phone?', answer: 'Mobile app' },
            { day: 29, title: 'Day 29: Security Features', description: 'Keep your funds safe', question: 'What authentication method provides extra security?', answer: 'Two-factor authentication' },
            { day: 30, title: 'Day 30: Bybit Ecosystem', description: 'Complete the journey', question: 'What makes Bybit a complete crypto platform?', answer: 'Full ecosystem' }
        ];
        
        // Add social quests and daily quests
        addSocialQuestsSafely(socialQuests);
        addDailyQuestsSafely(dailyQuests);
    });
};

// Initialize event configuration
const initializeEventConfig = () => {
    db.get("SELECT * FROM EventConfig WHERE id = 1", (err, config) => {
        if (err) {
            console.error("EVENT_CONFIG: Error checking config:", err);
            return;
        }
        
        if (!config) {
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
                        console.error("EVENT_CONFIG: Error creating config:", err);
                    } else {
                        console.log("EVENT_CONFIG: ✅ Event configuration created");
                        console.log(`EVENT_CONFIG: Start: ${startDate.toISOString()}`);
                        console.log(`EVENT_CONFIG: End: ${endDate.toISOString()}`);
                    }
                }
            );
        } else {
            console.log("EVENT_CONFIG: Configuration already exists");
            console.log(`EVENT_CONFIG: Event: ${config.event_name}`);
            console.log(`EVENT_CONFIG: Start: ${config.start_date}`);
            console.log(`EVENT_CONFIG: End: ${config.end_date}`);
        }
    });
};

// Function to add social quests
const addSocialQuestsSafely = (socialQuests) => {
    console.log('SOCIAL_QUESTS: Checking social quests...');
    
    socialQuests.forEach(quest => {
        db.get("SELECT id FROM Quests WHERE title = ?", [quest.title], (err, existingQuest) => {
            if (err) {
                console.error(`SOCIAL_QUESTS: Error checking "${quest.title}":`, err);
                return;
            }
            
            if (existingQuest) {
                console.log(`SOCIAL_QUESTS: "${quest.title}" already exists, skipping...`);
                return;
            }
            
            db.run(
                "INSERT INTO Quests (title, description, points_reward, type, quest_data, is_active) VALUES (?, ?, ?, ?, ?, TRUE)",
                [quest.title, quest.description, quest.points_reward, quest.type, quest.quest_data],
                function(err) {
                    if (err) {
                        console.error(`SOCIAL_QUESTS: Error adding "${quest.title}":`, err);
                    } else {
                        console.log(`SOCIAL_QUESTS: ✅ Added "${quest.title}" (ID: ${this.lastID})`);
                    }
                }
            );
        });
    });
};

// Function to add daily quests
const addDailyQuestsSafely = (dailyQuests) => {
    console.log('DAILY_QUESTS: Checking daily quests...');
    
    dailyQuests.forEach(quest => {
        db.get("SELECT id FROM Quests WHERE title = ?", [quest.title], (err, existingQuest) => {
            if (err) {
                console.error(`DAILY_QUESTS: Error checking "${quest.title}":`, err);
                return;
            }
            
            if (existingQuest) {
                console.log(`DAILY_QUESTS: "${quest.title}" already exists, skipping...`);
                return;
            }
            
            const questData = JSON.stringify({
                question: quest.question,
                answer: quest.answer
            });
            
            db.run(
                "INSERT INTO Quests (title, description, points_reward, type, quest_data, day_number, is_active) VALUES (?, ?, ?, ?, ?, ?, TRUE)",
                [quest.title, quest.description, 20, 'daily', questData, quest.day],
                function(err) {
                    if (err) {
                        console.error(`DAILY_QUESTS: Error adding "${quest.title}":`, err);
                    } else {
                        console.log(`DAILY_QUESTS: ✅ Added "${quest.title}" (Day ${quest.day}, ID: ${this.lastID})`);
                    }
                }
            );
        });
    });
};

// Function to get current day of event (1-30)
const getCurrentEventDay = (callback) => {
    db.get("SELECT start_date FROM EventConfig WHERE id = 1", (err, config) => {
        if (err || !config) {
            return callback(err || new Error("Event config not found"), null);
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




