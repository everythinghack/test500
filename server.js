// bybit-event-mini-app/server.js

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const { db, initDb, addPoints } = require('./database');

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize database
initDb();

//
// --- TELEGRAM BOT CONFIGURATION ---
//
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MINI_APP_URL =
  process.env.MINI_APP_URL ||
  "http://localhost:8080";

// For local testing, allow running without bot token
const IS_LOCAL = process.env.NODE_ENV !== 'production' && MINI_APP_URL.includes('localhost');

if (
  !BOT_TOKEN &&
  !IS_LOCAL
) {
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
  if (!bot) {
    return res.status(503).json({ error: "Bot not configured" });
  }
  try {
    const update = req.body;
    const msg = update.message;
    if (!msg) {
      return res.sendStatus(200);
    }

    const chatId = msg.chat.id;
    const newUserId = msg.from.id;
    const commandParam = msg.text?.match(/\/start(?: (.+))?/)?.[1] || null;

    console.log(
      `BOT: /start command. User: ${newUserId}, Chat: ${chatId}, Param: '${commandParam}'`
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
        // Check if referrer exists in Users table
        const referrerUser = await new Promise((resolve, reject) => {
          db.get(
            "SELECT telegram_id FROM Users WHERE telegram_id = ?",
            [referrerId],
            (err, row) => (err ? reject(err) : resolve(row))
          );
        });

        if (referrerUser) {
          // Store or update pending referral
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT OR REPLACE INTO PendingReferrals 
                 (new_user_telegram_id, referrer_telegram_id, processed) 
               VALUES (?, ?, FALSE)`,
              [newUserId, referrerId],
              function (err) {
                err ? reject(err) : resolve(this);
              }
            );
          });
          console.log(
            `BOT: Stored/Updated pending referral for new_user ${newUserId} by referrer ${referrerId}.`
          );
        } else {
          console.log(
            `BOT: Referrer ID ${referrerId} does not exist in Users table. Not storing pending referral.`
          );
        }
      } catch (dbError) {
        console.error(
          `BOT: DB error during /start referral processing for ${newUserId} by ${referrerId}:`,
          dbError.message
        );
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

    if (!userExists) {
      // Only send welcome message if user is new
      const message = "Click below to open the Bybit Event App:";
      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🚀 Open Event App", web_app: { url: MINI_APP_URL } }],
          ],
        },
      };
      if (bot) {
        await bot.sendMessage(chatId, message, options);
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("Error processing webhook:", error);
    return res.status(500).send("Error processing webhook");
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
// Verify Telegram user data
//
app.post("/api/verify-telegram", (req, res) => {
  const { initData, user } = req.body;

  if (!initData || !user || !user.id) {
    return res.status(400).json({ error: "Invalid Telegram data" });
  }

  // In production, verify initData signature via Telegram API
  res.json({
    success: true,
    telegram_id: user.id,
    username: user.username,
    first_name: user.first_name,
  });
});

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
        u.last_check_in,
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

      if (profile.last_check_in) {
        const lastCheckInDate = new Date(profile.last_check_in);
        const nextCheckInDate = new Date(lastCheckInDate);
        nextCheckInDate.setDate(nextCheckInDate.getDate() + 1);
        profile.next_check_in = nextCheckInDate.toISOString();
      }

      return res.json(profile);
    }
  );
});

app.post("/api/profile/uid", ensureUser, (req, res) => {
  const { bybitUid } = req.body;
  if (!bybitUid) {
    return res.status(400).json({ error: "Bybit UID is required" });
  }

  db.run(
    `UPDATE Users SET bybit_uid = ? WHERE telegram_id = ?`,
    [bybitUid, req.user.telegram_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      return res.json({ success: true, message: "Bybit UID updated successfully." });
    }
  );
});

app.get("/api/quests", ensureUser, (req, res) => {
  db.all(
    `
      SELECT 
        q.id, 
        q.title, 
        q.description, 
        q.points_reward, 
        q.type, 
        q.quest_data,
        CASE WHEN uq.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_completed
      FROM Quests q
      LEFT JOIN UserQuests uq 
        ON q.id = uq.quest_id 
        AND uq.user_id = ?
      WHERE q.is_active = TRUE 
        AND q.type != 'daily_checkin_placeholder'
    `,
    [req.user.telegram_id],
    (err, quests) => {
      if (err) return res.status(500).json({ error: err.message });
      return res.json(quests || []);
    }
  );
});

app.post("/api/quests/complete", ensureUser, (req, res) => {
  const { questId, answer } = req.body;

  db.get(
    `SELECT * FROM Quests WHERE id = ? AND is_active = TRUE`,
    [questId],
    (err, quest) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!quest) return res.status(404).json({ error: "Quest not found or not active." });

      db.get(
        `SELECT * FROM UserQuests WHERE user_id = ? AND quest_id = ?`,
        [req.user.telegram_id, questId],
        (completedErr, completed) => {
          if (completedErr) return res.status(500).json({ error: completedErr.message });
          if (completed) return res.status(400).json({ error: "Quest already completed." });

          if (quest.type === "qa") {
            const questData = JSON.parse(quest.quest_data || "{}");
            if (!answer || answer.toLowerCase() !== questData.answer?.toLowerCase()) {
              return res.status(400).json({ error: "Incorrect answer." });
            }
          }

          addPoints(
            req.user.telegram_id,
            quest.points_reward,
            `quest_completion_${quest.type}`,
            quest.id,
            null,
            (addPointsErr) => {
              if (addPointsErr) {
                return res
                  .status(500)
                  .json({ error: `Failed to add points: ${addPointsErr.message}` });
              }

              db.run(
                `INSERT INTO UserQuests (user_id, quest_id) VALUES (?, ?)`,
                [req.user.telegram_id, questId],
                function (markErr) {
                  if (markErr) {
                    return res
                      .status(500)
                      .json({ error: `Failed to mark quest as completed: ${markErr.message}` });
                  }
                  return res.json({
                    success: true,
                    message: "Quest completed!",
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
});

app.post("/api/checkin", ensureUser, (req, res) => {
  console.log(`SERVER: /api/checkin called for user ${req.user.telegram_id}`);

  const today = new Date().toISOString().split("T")[0];

  db.get(
    "SELECT last_check_in FROM Users WHERE telegram_id = ?",
    [req.user.telegram_id],
    (err, user) => {
      if (err) {
        console.error(
          `SERVER: Error checking last_check_in for user ${req.user.telegram_id}:`,
          err.message
        );
        return res
          .status(500)
          .json({ error: `Database error: ${err.message}` });
      }

      if (user && user.last_check_in === today) {
        console.log(`SERVER: User ${req.user.telegram_id} already checked in today`);
        return res.status(400).json({
          error: "Already checked in today.",
          message: "You have already checked in today. Come back tomorrow!",
        });
      }

      const DAILY_CHECKIN_POINTS = 10;

      // Use the addPoints function which handles transactions correctly
      addPoints(
        req.user.telegram_id,
        DAILY_CHECKIN_POINTS,
        "daily_checkin",
        null,
        null,
        (addPointsErr) => {
          if (addPointsErr) {
            console.error(
              `SERVER: Error adding points for user ${req.user.telegram_id}:`,
              addPointsErr.message
            );
            return res
              .status(500)
              .json({ error: `Failed to add points: ${addPointsErr.message}` });
          }

          // Update user’s points and last_check_in
          db.run(
            "UPDATE Users SET points = points + ?, last_check_in = ? WHERE telegram_id = ?",
            [DAILY_CHECKIN_POINTS, today, req.user.telegram_id],
            function (updateErr) {
              if (updateErr) {
                console.error(
                  `SERVER: Error updating user points and last_check_in for user ${req.user.telegram_id}:`,
                  updateErr.message
                );
                return res
                  .status(500)
                  .json({ error: `Failed to update user: ${updateErr.message}` });
              }

              const nextCheckIn = new Date();
              nextCheckIn.setDate(nextCheckIn.getDate() + 1);
              nextCheckIn.setHours(0, 0, 0, 0);

              console.log(
                `SERVER: User ${req.user.telegram_id} checked in successfully, earned ${DAILY_CHECKIN_POINTS} points`
              );
              return res.json({
                success: true,
                message: `Checked in! You earned ${DAILY_CHECKIN_POINTS} points.`,
                points_earned: DAILY_CHECKIN_POINTS,
                next_check_in: nextCheckIn.toISOString(),
              });
            }
          );
        }
      );
    }
  );
});

app.get("/api/referrals/history", ensureUser, (req, res) => {
  db.all(
    `
      SELECT 
        u.telegram_id, 
        u.username, 
        u.first_name, 
        u.points AS points_earned_by_referral,
        COALESCE(
          (
            SELECT SUM(pt.points_change)
            FROM PointTransactions pt
            WHERE 
              pt.user_id = ? 
              AND pt.reason = 'referral_bonus' 
              AND pt.related_referred_user_id = u.telegram_id
          ), 
          0
        ) AS points_earned_from_this_referral
      FROM Users u
      WHERE u.referrer_id = ?
    `,
    [req.user.telegram_id, req.user.telegram_id],
    (err, referrals) => {
      if (err) return res.status(500).json({ error: err.message });
      return res.json(referrals || []);
    }
  );
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

//
// Verify if user is a member of a Telegram channel/group
//
app.post("/api/verify/telegram", ensureUser, async (req, res) => {
  const chatId = req.body.chatId; // Telegram group/channel ID
  const userId = req.user.telegram_id;

  try {
    // Check if quest was already completed
    const alreadyCompleted = await new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM UserQuests WHERE user_id = ? AND quest_id = ?",
        [userId, req.body.questId],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });

    if (alreadyCompleted) {
      return res.json({ success: true, message: "Already completed", alreadyVerified: true });
    }

    // Check membership status via Bot API
    if (!bot) {
      return res.status(503).json({ error: "Bot not configured for verification" });
    }
    const chatMember = await bot.getChatMember(chatId, userId);

    if (chatMember && ["member", "administrator", "creator"].includes(chatMember.status)) {
      // User is a member, award points for that quest
      const questId = req.body.questId;
      const quest = await new Promise((resolve, reject) => {
        db.get("SELECT * FROM Quests WHERE id = ?", [questId], (err, row) =>
          err ? reject(err) : resolve(row)
        );
      });

      if (!quest) {
        return res.status(404).json({ error: "Quest not found" });
      }

      // Add points and mark quest completed
      addPoints(
        userId,
        quest.points_reward,
        `quest_completion_${quest.type}`,
        quest.id,
        null,
        (addPointsErr) => {
          if (addPointsErr) {
            return res
              .status(500)
              .json({ error: `Failed to add points: ${addPointsErr.message}` });
          }

          db.run(
            "INSERT INTO UserQuests (user_id, quest_id) VALUES (?, ?)",
            [userId, questId],
            function (markErr) {
              if (markErr) {
                return res
                  .status(500)
                  .json({ error: `Failed to mark quest as completed: ${markErr.message}` });
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
// Handle when users leave a channel/group
//
if (bot) {
  bot.on("left_chat_member", async (msg) => {
  if (msg.left_chat_member) {
    const userId = msg.left_chat_member.id;
    const chatId = msg.chat.id;

    try {
      // Find all “social_follow” quests for this chatId
      const quests = await new Promise((resolve, reject) => {
        db.all(
          `SELECT * FROM Quests 
           WHERE type = 'social_follow' 
             AND json_extract(quest_data, '$.chatId') = ?`,
          [chatId.toString()],
          (err, rows) => (err ? reject(err) : resolve(rows))
        );
      });

      if (quests && quests.length > 0) {
        for (const quest of quests) {
          // Check if that quest was completed by this user
          const completed = await new Promise((resolve, reject) => {
            db.get(
              "SELECT * FROM UserQuests WHERE user_id = ? AND quest_id = ?",
              [userId, quest.id],
              (err, row) => (err ? reject(err) : resolve(row))
            );
          });

          if (completed) {
            // Remove the points
            addPoints(userId, -quest.points_reward, "left_channel", quest.id, null, () => {});

            // Delete the record of completion
            db.run(
              "DELETE FROM UserQuests WHERE user_id = ? AND quest_id = ?",
              [userId, quest.id],
              (err) => {
                if (err) console.error("Error removing completed quest:", err);
              }
            );

            console.log(
              `User ${userId} left chat ${chatId}, removed ${quest.points_reward} points`
            );
          }
        }
      }
    } catch (error) {
      console.error("Error handling left_chat_member:", error);
    }
  }
});
}

//
// --- Get referral list (new endpoint) ---
//
app.get("/api/referrals", ensureUser, (req, res) => {
  console.log(`SERVER: /api/referrals called for user ${req.user.telegram_id}`);

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
      console.log(
        `SERVER: Found ${safeReferrals.length} referrals for user ${req.user.telegram_id}`
      );
      return res.json(safeReferrals);
    }
  );
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
