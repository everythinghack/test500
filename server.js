// bybit-event-mini-app/server.js

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const { db, initDb, addPoints, getCurrentEventDay } = require('./database');

const app = express();
const PORT = process.env.PORT || 8080;

// Ensure database tables exist (safe initialization)
const ensureTablesExist = async () => {
  try {
    // Test if Users table exists by running a simple query
    await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM Users LIMIT 1', [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    console.log('✅ Database tables confirmed to exist');
  } catch (error) {
    console.log('⚠️  Database tables missing, initializing...');
    await initDb();
    console.log('✅ Database initialized successfully');
  }
};
ensureTablesExist();

//
// --- TELEGRAM BOT CONFIGURATION ---
//
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MINI_APP_URL =
  process.env.MINI_APP_URL ||
  "https://bybit-telegram-bot-464578924371.asia-south1.run.app";

// For local testing, allow running without bot token
const IS_LOCAL = process.env.NODE_ENV !== 'production' && MINI_APP_URL.includes('localhost');

if (!BOT_TOKEN && !IS_LOCAL) {
  console.error(
    "\n!!! CRITICAL ERROR: TELEGRAM_BOT_TOKEN environment variable is required. Bot and Mini App launch will fail. !!!\n"
  );
  process.exit(1);
}

// Initialize bot only if we have a token
let bot = null;
if (BOT_TOKEN) {
  const WEBHOOK_URL = `${MINI_APP_URL}/api/telegram/webhook`;
  bot = new TelegramBot(BOT_TOKEN, { webhook: { port: PORT } });

  bot
    .setWebHook(WEBHOOK_URL)
    .then(() => {
      console.log(`Telegram Bot webhook set to: ${WEBHOOK_URL}`);
    })
    .catch((err) => {
      console.error("Failed to set webhook:", err);
    });
} else {
  console.log("Running in local mode without Telegram Bot integration");
}

//
// --- BOT WEBHOOK HANDLER ---
//
app.post("/api/telegram/webhook", express.json(), async (req, res) => {
  console.log("WEBHOOK: Received request body:", JSON.stringify(req.body, null, 2));
  
  if (!bot) {
    console.error("WEBHOOK: Bot not configured");
    return res.sendStatus(200); // Always return 200 to Telegram
  }
  
  try {
    const update = req.body;
    const msg = update.message;
    if (!msg) {
      console.log("WEBHOOK: No message in update, sending 200");
      return res.sendStatus(200);
    }

    const chatId = msg.chat.id;
    const newUserId = msg.from.id;
    const commandParam = msg.text?.match(/\/start(?: (.+))?/)?.[1] || null;

    console.log(
      `WEBHOOK: Processing /start command. User: ${newUserId}, Chat: ${chatId}, Param: '${commandParam}', MINI_APP_URL: '${MINI_APP_URL}'`
    );

    let referrerId = null;
    if (commandParam && commandParam.startsWith("ref_")) {
      const parts = commandParam.split("_");
      if (parts.length > 1 && parts[1]) {
        const parsedId = parseInt(parts[1], 10);
        if (!isNaN(parsedId) && parsedId !== newUserId) {
          referrerId = parsedId;
          console.log(
            `BOT: Parsed referrer ID ${referrerId} for new user ${newUserId}.`
          );
        } else if (parsedId === newUserId) {
          console.log(
            `BOT: User ${newUserId} attempted to refer themselves. Ignoring.`
          );
        } else {
          console.log(
            `BOT: Invalid referrer ID part '${parts[1]}' for user ${newUserId}.`
          );
        }
      }
    }

    if (referrerId) {
      try {
        console.log(`WEBHOOK: Checking if referrer ${referrerId} exists in database...`);
        
        // Check if referrer exists in Users table
        const referrerUser = await new Promise((resolve, reject) => {
          db.get(
            "SELECT telegram_id FROM Users WHERE telegram_id = ?",
            [referrerId],
            (err, row) => {
              if (err) {
                console.error(`WEBHOOK: Database error checking referrer ${referrerId}:`, err);
                reject(err);
              } else {
                resolve(row);
              }
            }
          );
        });

        if (referrerUser) {
          console.log(`WEBHOOK: Referrer ${referrerId} found, storing pending referral...`);
          
          // Store or update pending referral
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT OR REPLACE INTO PendingReferrals 
                 (new_user_telegram_id, referrer_telegram_id, processed) 
               VALUES (?, ?, FALSE)`,
              [newUserId, referrerId],
              function (err) {
                if (err) {
                  console.error(`WEBHOOK: Error storing pending referral:`, err);
                  reject(err);
                } else {
                  console.log(`WEBHOOK: Successfully stored pending referral`);
                  resolve(this);
                }
              }
            );
          });
          console.log(
            `WEBHOOK: ✅ Stored pending referral for new_user ${newUserId} by referrer ${referrerId}`
          );
        } else {
          console.log(
            `WEBHOOK: ❌ Referrer ID ${referrerId} does not exist in Users table. Not storing pending referral.`
          );
        }
      } catch (dbError) {
        console.error(
          `WEBHOOK: Database error during referral processing for ${newUserId} by ${referrerId}:`,
          dbError.message,
          dbError.stack
        );
        // Continue processing even if referral fails
      }
    }

    // Check if user already exists
    const userExists = await new Promise((resolve, reject) => {
      db.get(
        "SELECT telegram_id FROM Users WHERE telegram_id = ?",
        [newUserId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row !== undefined);
        }
      );
    });

    // Send app link to both new and existing users
    const message = userExists 
      ? "Welcome back! Click below to open the Bybit Event App:"
      : "Welcome! Click below to open the Bybit Event App:";
    
    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Open Event App", web_app: { url: MINI_APP_URL } }],
        ],
      },
    };
    
    try {
      if (bot) {
        console.log(`WEBHOOK: Sending message to chat ${chatId} with MINI_APP_URL: ${MINI_APP_URL}`);
        await bot.sendMessage(chatId, message, options);
        console.log(`WEBHOOK: ✅ Successfully sent message to ${userExists ? 'existing' : 'new'} user ${newUserId}`);
      } else {
        console.error(`WEBHOOK: Bot instance not available`);
      }
    } catch (sendError) {
      console.error(`WEBHOOK: Error sending message to ${chatId}:`, sendError.message, sendError.stack);
      // Don't throw error, just log it
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("WEBHOOK: Error processing webhook:", error.message, error.stack);
    // Always return 200 to Telegram to prevent retries
    return res.sendStatus(200);
  }
});

//
// --- EXPRESS MIDDLEWARE & ROUTES ---
//
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

//
// Modified ensureUser middleware
//
const ensureUser = async (req, res, next) => {
  let telegramUserDataString = req.query.telegramUser;
  if (!telegramUserDataString) {
    telegramUserDataString = req.body?.telegramUser;
  }

  let telegramUserData;
  try {
    if (!telegramUserDataString) {
      console.error(
        "ensureUser: No Telegram user data found in request"
      );
      return res
        .status(401)
        .json({ error: "No Telegram user data provided" });
    }

    telegramUserData =
      typeof telegramUserDataString === "object"
        ? telegramUserDataString
        : JSON.parse(telegramUserDataString);

    if (!telegramUserData || !telegramUserData.id) {
      console.error(
        "ensureUser: Invalid Telegram user data structure:",
        telegramUserData
      );
      return res
        .status(400)
        .json({ error: "Invalid Telegram user data structure or missing ID." });
    }
  } catch (e) {
    console.error(
      "ensureUser: Error parsing Telegram user data:",
      e.message,
      "Received:",
      telegramUserDataString
    );
    return res
      .status(400)
      .json({ error: `Invalid Telegram user data: ${e.message}` });
  }

  const { id: currentUserId, username, first_name } = telegramUserData;
  const referrerIdFromWebApp = req.query.referrerId || req.body?.referrerId;

  console.log(
    `ensureUser: Processing user ID: ${currentUserId}. Referrer from MiniApp (fallback): ${
      referrerIdFromWebApp || "None"
    }`
  );

  try {
    let user = await new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM Users WHERE telegram_id = ?",
        [currentUserId],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });

    if (user) {
      console.log(
        `ensureUser: User ${currentUserId} (${
          user.username || user.first_name
        }) found.`
      );
      req.user = user;
      return next();
    }

    console.log(
      `ensureUser: User ${currentUserId} (${
        username || first_name
      }) not found. Attempting to create.`
    );
    let actualReferrerId = null;

    // 1. Check PendingReferrals (primary method)
    const pendingReferral = await new Promise((resolve, reject) => {
      db.get(
        `SELECT referrer_telegram_id FROM PendingReferrals 
         WHERE new_user_telegram_id = ? AND processed = FALSE 
         ORDER BY timestamp DESC LIMIT 1`,
        [currentUserId],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });

    if (pendingReferral && pendingReferral.referrer_telegram_id) {
      const botReferrerId = pendingReferral.referrer_telegram_id;
      const referrerExists = await new Promise((resolve, reject) => {
        db.get(
          "SELECT telegram_id FROM Users WHERE telegram_id = ?",
          [botReferrerId],
          (err, row) => (err ? reject(err) : resolve(row))
        );
      });
      if (referrerExists) {
        actualReferrerId = botReferrerId;
        console.log(
          `ensureUser: Using referrer ID ${actualReferrerId} from Bot's PendingReferrals for user ${currentUserId}.`
        );
      } else {
        console.warn(
          `ensureUser: Referrer ${botReferrerId} (from PendingReferrals) not found in Users. Discarding.`
        );
      }
    } else {
      console.log(
        `ensureUser: No active pending referral found for user ${currentUserId} via Bot.`
      );
    }

    // 2. Fallback to referrerId from WebApp (if any & no bot referral used)
    if (!actualReferrerId && referrerIdFromWebApp) {
      const webAppReferrerId = parseInt(referrerIdFromWebApp, 10);
      if (!isNaN(webAppReferrerId) && webAppReferrerId !== currentUserId) {
        const referrerExistsWA = await new Promise((resolve, reject) => {
          db.get(
            "SELECT telegram_id FROM Users WHERE telegram_id = ?",
            [webAppReferrerId],
            (err, row) => (err ? reject(err) : resolve(row))
          );
        });
        if (referrerExistsWA) {
          actualReferrerId = webAppReferrerId;
          console.log(
            `ensureUser: Using fallback referrer ID ${actualReferrerId} from WebApp for user ${currentUserId}.`
          );
        } else {
          console.warn(
            `ensureUser: Fallback referrer ${webAppReferrerId} (from WebApp) not found in Users.`
          );
        }
      }
    }

    // Create user in DB
    const insertSql = `
      INSERT INTO Users (telegram_id, username, first_name${
        actualReferrerId ? ", referrer_id" : ""
      })
      VALUES (?, ?, ?${actualReferrerId ? ", ?" : ""})
    `;
    const insertParams = actualReferrerId
      ? [currentUserId, username || null, first_name || null, actualReferrerId]
      : [currentUserId, username || null, first_name || null];

    await new Promise((resolve, reject) => {
      db.run(insertSql, insertParams, function (err) {
        err ? reject(err) : resolve(this);
      });
    });

    console.log(
      `ensureUser: New user ${currentUserId} created. Referrer ID: ${
        actualReferrerId || "None"
      }.`
    );

    const newUserRecord = await new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM Users WHERE telegram_id = ?",
        [currentUserId],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });
    if (!newUserRecord) {
      throw new Error(`Failed to fetch newly created user ${currentUserId}.`);
    }
    req.user = newUserRecord;

    if (actualReferrerId) {
      const INVITE_BONUS_POINTS = 100;
      console.log(
        `ensureUser: Giving ${INVITE_BONUS_POINTS} invite bonus to referrer ${actualReferrerId} for new user ${currentUserId}.`
      );
      addPoints(
        actualReferrerId,
        INVITE_BONUS_POINTS,
        "successful_invite",
        null,
        currentUserId,
        (bonusErr) => {
          if (bonusErr) {
            console.error(
              `ensureUser: Error giving invite bonus to ${actualReferrerId}:`,
              bonusErr.message
            );
          } else {
            console.log(`ensureUser: Invite bonus processed for ${actualReferrerId}.`);
          }
        }
      );

      if (
        pendingReferral &&
        pendingReferral.referrer_telegram_id === actualReferrerId
      ) {
        db.run(
          `UPDATE PendingReferrals SET processed = TRUE 
           WHERE new_user_telegram_id = ? AND referrer_telegram_id = ?`,
          [currentUserId, actualReferrerId],
          (updateErr) => {
            if (updateErr) {
              console.error(
                `ensureUser: Failed to mark pending referral as processed:`,
                updateErr.message
              );
            } else {
              console.log(
                `ensureUser: Marked pending referral as processed for ${currentUserId} by ${actualReferrerId}.`
              );
            }
          }
        );
      }
    }

    next();
  } catch (error) {
    console.error(
      `ensureUser: General error for user ${req.user?.telegram_id || "unknown"}:`,
      error.message,
      error.stack
    );
    return res
      .status(500)
      .json({ error: `Server error during user processing: ${error.message}` });
  }
};

//
// --- API ENDPOINTS (protected by ensureUser when needed) ---
//

app.get("/api/profile", ensureUser, (req, res) => {
  db.get(
    `
      SELECT 
        u.telegram_id, 
        u.username, 
        u.first_name, 
        u.points, 
        u.bybit_uid, 
        (SELECT COUNT(*) 
         FROM Users 
         WHERE referrer_id = u.telegram_id
        ) AS referral_count
      FROM Users u
      WHERE u.telegram_id = ?
    `,
    [req.user.telegram_id],
    (err, profile) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      return res.json(profile);
    }
  );
});

app.post("/api/profile/uid", ensureUser, (req, res) => {
  const { bybitUid } = req.body;
  if (!bybitUid) {
    return res.status(400).json({ error: "Bybit UID is required" });
  }

  // Check if user already has a UID
  db.get(
    "SELECT bybit_uid FROM Users WHERE telegram_id = ?",
    [req.user.telegram_id],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (user && user.bybit_uid) {
        return res.status(400).json({ 
          error: "UID already submitted", 
          message: "You have already submitted your Bybit UID. It cannot be changed once submitted." 
        });
      }

      // Update the UID (only if not already set)
      db.run(
        `UPDATE Users SET bybit_uid = ? WHERE telegram_id = ? AND bybit_uid IS NULL`,
        [bybitUid, req.user.telegram_id],
        function (updateErr) {
          if (updateErr) {
            return res.status(500).json({ error: updateErr.message });
          }
          
          if (this.changes === 0) {
            return res.status(400).json({ 
              error: "UID already submitted", 
              message: "Your Bybit UID has already been submitted and cannot be changed." 
            });
          }

          return res.json({ 
            success: true, 
            message: "Bybit UID submitted successfully. This cannot be changed later." 
          });
        }
      );
    }
  );
});

// Hardcoded quests and tasks - easy to modify!
const DAILY_QUESTS = [
  {
    id: 1001,
    title: 'Day 1: P2P Trading',
    description: 'Learn about P2P trading on Bybit',
    points_reward: 20,
    type: 'daily',
    day_number: 1,
    question: 'What does Bybit\'s P2P platform allow users to do?',
    answer: 'Trade crypto directly'
  },
  {
    id: 1002, 
    title: 'Day 2: Launchpad',
    description: 'Discover new token launches',
    points_reward: 20,
    type: 'daily',
    day_number: 2,
    question: 'What is the main use of Bybit Launchpad?',
    answer: 'Token launches'
  },
  {
    id: 1003,
    title: 'Day 3: Puzzle Hunt', 
    description: 'Join the puzzle hunt',
    points_reward: 20,
    type: 'daily',
    day_number: 3,
    question: 'What do users collect in Bybit Puzzle Hunt?',
    answer: 'Puzzle pieces'
  },
  {
    id: 1004,
    title: 'Day 4: Launchpool',
    description: 'Stake and earn rewards',
    points_reward: 20,
    type: 'daily', 
    day_number: 4,
    question: 'What do users do in Launchpool to earn rewards?',
    answer: 'Stake tokens'
  },
  {
    id: 1005,
    title: 'Day 5: Copy Trading',
    description: 'Copy expert traders',
    points_reward: 20,
    type: 'daily',
    day_number: 5,
    question: 'What does Copy Trading on Bybit allow you to do?',
    answer: 'Copy experts'
  }
];

const SOCIAL_TASKS = [
  {
    id: 2001,
    title: 'Join Bybit Telegram Group',
    description: 'Join our official Telegram Group',
    points_reward: 50,
    type: 'social_follow',
    url: 'https://t.me/test3bybitG',
    chatId: '-1002001387968'
  },
  {
    id: 2002, 
    title: 'Join Bybit Telegram Channel',
    description: 'Join our official Telegram Channel',
    points_reward: 50,
    type: 'social_follow',
    url: 'https://t.me/test3bybitC',
    chatId: '-1002033197403'
  },
  {
    id: 2003,
    title: 'Follow Bybit on X',
    description: 'Follow our official X (Twitter) account',
    points_reward: 50,
    type: 'social_follow',
    url: 'https://twitter.com/bybit_official'
  }
];

app.get("/api/quests", ensureUser, (req, res) => {
  getCurrentEventDay((err, currentDay) => {
    if (err) {
      console.error("Error getting current event day:", err);
      return res.status(500).json({ error: "Failed to get event status" });
    }

    // Get user's completed quests from user's completed_quests field
    db.get(
      "SELECT completed_quests FROM Users WHERE telegram_id = ?",
      [req.user.telegram_id],
      (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const completedQuestIds = user && user.completed_quests ? 
          user.completed_quests.split(',').map(id => parseInt(id)) : [];
        
        // Process daily quests
        const dailyQuests = DAILY_QUESTS.map(quest => ({
          ...quest,
          quest_data: JSON.stringify({ question: quest.question, answer: quest.answer }),
          is_completed: completedQuestIds.includes(quest.id) ? 1 : 0,
          is_available: quest.day_number <= currentDay ? 1 : 0
        }));
        
        // Process social tasks  
        const socialTasks = SOCIAL_TASKS.map(task => ({
          ...task,
          quest_data: JSON.stringify({ url: task.url, chatId: task.chatId }),
          is_completed: completedQuestIds.includes(task.id) ? 1 : 0,
          is_available: 1 // Social tasks are always available
        }));
        
        // Combine all quests
        const allQuests = [...dailyQuests, ...socialTasks];
        
        const response = {
          current_day: currentDay,
          quests: allQuests
        };
        
        return res.json(response);
      }
    );
  });
});

app.post("/api/quests/complete", ensureUser, (req, res) => {
  const { questId, answer } = req.body;

  // Find quest in hardcoded data
  const allQuests = [...DAILY_QUESTS, ...SOCIAL_TASKS];
  const quest = allQuests.find(q => q.id === questId);
  
  if (!quest) {
    return res.status(404).json({ error: "Quest not found." });
  }

  // Check if quest is available (for daily quests)
  if (quest.type === 'daily') {
    getCurrentEventDay((dayErr, currentDay) => {
      if (dayErr) {
        return res.status(500).json({ error: "Failed to check quest availability." });
      }
      
      if (quest.day_number > currentDay) {
        return res.status(400).json({ 
          error: `This quest will be available on Day ${quest.day_number}. Currently it's Day ${currentDay}.` 
        });
      }
      
      processQuestCompletion();
    });
  } else {
    processQuestCompletion();
  }

  function processQuestCompletion() {
    // Check if already completed using user's completed_quests field
    db.get(
      "SELECT completed_quests FROM Users WHERE telegram_id = ?",
      [req.user.telegram_id],
      (completedErr, user) => {
        if (completedErr) return res.status(500).json({ error: completedErr.message });
        
        const completedQuests = user && user.completed_quests ? user.completed_quests.split(',') : [];
        if (completedQuests.includes(questId.toString())) {
          return res.status(400).json({ error: "Quest already completed." });
        }

        // Check answer for daily quests, but not for social tasks
        if (quest.type === "daily") {
          if (!answer || answer.toLowerCase().trim() !== quest.answer?.toLowerCase().trim()) {
            return res.status(400).json({ error: "Incorrect answer. Try again!" });
          }
        }
        // Social tasks (like Twitter follow) don't need answer validation

        // Add points to user (don't use questId as foreign key since quest isn't in DB)
        addPoints(
          req.user.telegram_id,
          quest.points_reward,
          `quest_completion_${quest.type}`,
          null, // No quest_id foreign key since quest is hardcoded
          null,
          (addPointsErr) => {
            if (addPointsErr) {
              return res
                .status(500)
                .json({ error: `Failed to add points: ${addPointsErr.message}` });
            }

            // Store quest completion in user's data (simple approach to avoid foreign key issues)
            db.get(
              "SELECT completed_quests FROM Users WHERE telegram_id = ?",
              [req.user.telegram_id],
              (err, user) => {
                if (err) {
                  return res.status(500).json({ error: "Failed to check user data" });
                }
                
                const completedQuests = user.completed_quests ? user.completed_quests.split(',') : [];
                if (!completedQuests.includes(questId.toString())) {
                  completedQuests.push(questId.toString());
                }
                
                db.run(
                  "UPDATE Users SET completed_quests = ? WHERE telegram_id = ?",
                  [completedQuests.join(','), req.user.telegram_id],
                  function (updateErr) {
                    if (updateErr) {
                      console.warn("Could not update completed quests, but continuing:", updateErr.message);
                    }
                    
                    let message = "Quest completed!";
                    if (quest.type === 'daily') {
                      message = `Day ${quest.day_number} quest completed! 🎉`;
                    } else if (quest.type === 'social_follow') {
                      message = "Social task completed! Thank you for joining!";
                    }
                    
                    return res.json({
                      success: true,
                      message: message,
                      points_earned: quest.points_reward,
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  }
});

app.get("/api/leaderboard", (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  db.all(
    "SELECT username, first_name, points FROM Users ORDER BY points DESC, telegram_id ASC LIMIT ?",
    [limit],
    (err, leaders) => {
      if (err) return res.status(500).json({ error: err.message });
      return res.json(leaders || []);
    }
  );
});

app.get("/api/referrals", ensureUser, (req, res) => {
  console.log(`SERVER: /api/referrals called for user ${req.user.telegram_id}`);

  // First get the referral users
  db.all(
    `
      SELECT
        u.telegram_id AS referred_id,
        u.username    AS referred_username,
        u.first_name  AS referred_first_name,
        u.points      AS points_earned,
        u.created_at  AS created_at
      FROM Users u
      WHERE u.referrer_id = ?
      ORDER BY u.created_at DESC
    `,
    [req.user.telegram_id],
    (err, referrals) => {
      if (err) {
        console.error(
          `SERVER: Error fetching referrals for user ${req.user.telegram_id}:`,
          err.message
        );
        return res.status(500).json({ error: err.message });
      }

      const safeReferrals = Array.isArray(referrals) ? referrals : [];
      
      // Now get the total referral bonus points actually received
      db.get(
        `
          SELECT 
            COALESCE(SUM(points_change), 0) AS total_referral_bonus
          FROM PointTransactions 
          WHERE user_id = ? AND reason = 'referral_bonus'
        `,
        [req.user.telegram_id],
        (bonusErr, bonusResult) => {
          if (bonusErr) {
            console.error(
              `SERVER: Error fetching referral bonus for user ${req.user.telegram_id}:`,
              bonusErr.message
            );
            return res.status(500).json({ error: bonusErr.message });
          }

          const response = {
            referrals: safeReferrals,
            total_referral_bonus: bonusResult ? bonusResult.total_referral_bonus : 0
          };

          console.log(
            `SERVER: Found ${safeReferrals.length} referrals and ${response.total_referral_bonus} bonus points for user ${req.user.telegram_id}`
          );
          return res.json(response);
        }
      );
    }
  );
});

//
// Verify if user is a member of a Telegram channel/group
//
app.post("/api/verify/telegram", ensureUser, async (req, res) => {
  const chatId = req.body.chatId; // Telegram group/channel ID
  const userId = req.user.telegram_id;
  const questId = req.body.questId;

  console.log(`TELEGRAM_VERIFY: User ${userId} verifying membership in chat ${chatId}, quest ${questId}`);

  try {
    // Check if quest was already completed using completed_quests field
    const user = await new Promise((resolve, reject) => {
      db.get(
        "SELECT completed_quests FROM Users WHERE telegram_id = ?",
        [userId],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });

    const completedQuests = user && user.completed_quests ? user.completed_quests.split(',') : [];
    if (completedQuests.includes(questId.toString())) {
      console.log(`TELEGRAM_VERIFY: User ${userId} already completed quest ${questId}`);
      return res.json({ success: true, message: "Already completed", alreadyVerified: true });
    }

    // Check membership status via Bot API
    if (!bot) {
      console.error("TELEGRAM_VERIFY: Bot not configured");
      return res.status(503).json({ error: "Bot not configured for verification" });
    }

    console.log(`TELEGRAM_VERIFY: Checking membership for user ${userId} in chat ${chatId}`);
    
    let chatMember;
    try {
      chatMember = await bot.getChatMember(chatId, userId);
      console.log(`TELEGRAM_VERIFY: Got chat member status:`, chatMember);
    } catch (telegramError) {
      console.error(`TELEGRAM_VERIFY: Telegram API error:`, telegramError.message);
      
      // Provide specific error messages for different cases
      if (telegramError.message.includes('chat not found')) {
        return res.status(400).json({ 
          error: "Chat verification failed", 
          message: "Unable to verify membership. Please ensure the bot has access to the channel/group.",
          debug: `Chat ID: ${chatId}, Bot may not be added to the group/channel` 
        });
      } else if (telegramError.message.includes('user not found')) {
        return res.status(400).json({ 
          error: "User verification failed", 
          message: "Unable to verify your membership. Please try again.",
          debug: `User ID: ${userId} not found in chat ${chatId}` 
        });
      } else {
        return res.status(500).json({ 
          error: "Verification error", 
          message: "Unable to verify membership at this time. Please try again later.",
          debug: telegramError.message 
        });
      }
    }

    if (chatMember && ["member", "administrator", "creator"].includes(chatMember.status)) {
      // User is a member, award points for that quest
      const questId = req.body.questId;
      
      // Find quest in hardcoded data
      const allQuests = [...DAILY_QUESTS, ...SOCIAL_TASKS];
      const quest = allQuests.find(q => q.id == questId);

      if (!quest) {
        return res.status(404).json({ error: "Quest not found" });
      }

      // Add points and mark quest completed
      addPoints(
        userId,
        quest.points_reward,
        `quest_completion_${quest.type}`,
        null, // No quest foreign key since quest is hardcoded
        null,
        (addPointsErr) => {
          if (addPointsErr) {
            return res
              .status(500)
              .json({ error: `Failed to add points: ${addPointsErr.message}` });
          }

          // Store quest completion in user's completed_quests field (avoid foreign key issues)
          db.get(
            "SELECT completed_quests FROM Users WHERE telegram_id = ?",
            [userId],
            (err, user) => {
              if (err) {
                return res.status(500).json({ error: "Failed to check user data" });
              }
              
              const completedQuests = user.completed_quests ? user.completed_quests.split(',') : [];
              if (!completedQuests.includes(questId.toString())) {
                completedQuests.push(questId.toString());
              }
              
              db.run(
                "UPDATE Users SET completed_quests = ? WHERE telegram_id = ?",
                [completedQuests.join(','), userId],
                function (updateErr) {
                  if (updateErr) {
                    console.warn("Could not update completed quests, but continuing:", updateErr.message);
                  }
                  
                  return res.json({
                    success: true,
                    message: "Verification successful! Points awarded.",
                    points_earned: quest.points_reward,
                    verified: true,
                  });
                }
              );
            }
          );
        }
      );
    } else {
      // Not a member yet
      return res.json({
        success: false,
        message: "You need to join the channel/group first!",
        verified: false,
      });
    }
  } catch (error) {
    console.error("Error verifying Telegram membership:", error);
    return res
      .status(500)
      .json({ error: "Failed to verify membership", message: error.message });
  }
});


//
// One-time database setup endpoint (for Cloud Run and other deployments)
//
app.get("/setup-database", async (req, res) => {
  try {
    console.log('🚀 Manual database setup requested...');
    await initDb();
    console.log('✅ Database setup completed successfully!');
    res.json({ 
      success: true, 
      message: 'Database initialized successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Database setup failed',
      error: error.message
    });
  }
});

//
// Fallback for Single Page App (serve index.html on any unknown route)
//
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

//
// Start server
//
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Mini App should be launched via bot. Configured Mini App URL: ${MINI_APP_URL}`);
});