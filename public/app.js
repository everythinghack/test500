// public/app.js

// ------------ Helpers to initialize Telegram WebApp ------------
async function initializeTelegramWebApp(tg) {
    return new Promise((resolve, reject) => {
      const checkInit = () => {
        if (tg.initData) {
          const telegramUser = tg.initDataUnsafe?.user;
          if (telegramUser && telegramUser.id) {
            // Try to verify on backend
            fetch(`${window.API_BASE_URL}/api/verify-telegram`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                initData: tg.initData,
                user: telegramUser
              })
            })
              .then((response) => {
                // Even if it fails, proceed (we still need initDataUnsafe for UI)
                resolve({
                  initData: tg.initDataUnsafe,
                  telegramUser
                });
              })
              .catch((error) => {
                console.warn(
                  "APP_JS: Backend verification failed, continuing anyway:",
                  error
                );
                resolve({
                  initData: tg.initDataUnsafe,
                  telegramUser
                });
              });
          } else {
            reject(new Error("Invalid Telegram user data"));
          }
        } else {
          // Wait 100ms and try again
          setTimeout(checkInit, 100);
        }
      };
      checkInit();
    });
  }
  
  // ------------ Main entrypoint ------------
  document.addEventListener("DOMContentLoaded", async () => {
    // Check if we're in Telegram WebApp or need to use mock data
    let tg = window.Telegram?.WebApp;
    let isLocalTesting = false;
    
    if (!tg || !tg.initData) {
      console.log("APP_JS: Telegram WebApp not available, using mock data for local testing");
      isLocalTesting = true;
      // Create mock Telegram WebApp object
      tg = {
        initData: 'mock_local_test',
        initDataUnsafe: {
          user: {
            id: 123456789,
            first_name: 'LocalTestUser',
            username: 'localtestuser'
          },
          bot_username: 'testbla500bot'
        },
        ready: () => console.log('Mock Telegram WebApp ready'),
        expand: () => console.log('Mock Telegram WebApp expanded'),
        showAlert: (message) => alert(message),
        showPopup: (config) => alert(config.message),
        openLink: (url) => window.open(url, '_blank')
      };
    }
  
    // Use localhost for development, production URL for deployed version
    window.API_BASE_URL = window.location.hostname === 'localhost' 
      ? "http://localhost:8080"
      : "https://bybit-event-mini-app-production-ae87.up.railway.app";
  
    console.log("APP_JS: Attempting to initialize Telegram Web App...");
    let initResult;
    
    if (isLocalTesting) {
      // Use mock data directly for local testing
      initResult = {
        initData: tg.initDataUnsafe,
        telegramUser: tg.initDataUnsafe.user
      };
      console.log("APP_JS: Using mock data for local testing");
    } else {
      // Use real Telegram WebApp initialization
      try {
        initResult = await initializeTelegramWebApp(tg);
      } catch (err) {
        console.error("APP_JS: Failed to initialize Telegram WebApp:", err);
        return;
      }
    }
  
    const { initData, telegramUser } = initResult;
    console.log("APP_JS: Telegram Web App initialized:", telegramUser);
  
    tg.ready();
    tg.expand();
  
    // Store user data globally
    window.telegramUser = telegramUser;
  
    // --------- UI element references ----------
    const mainContent = document.getElementById("main-content");
    const pageContainer = {
      "loading-page": document.getElementById("loading-page"),
      "quest-page": document.getElementById("quest-page"),
      "follow-page": document.getElementById("follow-page"),
      "invite-page": document.getElementById("invite-page"),
      "leaderboard-page": document.getElementById("leaderboard-page"),
      "profile-page": document.getElementById("profile-page")
    };
    const navButtons = document.querySelectorAll(".nav-btn");
    const pointsValueDisplay = document.getElementById("points-value");
  
    // --------- Minimal API helper ---------
    async function apiRequest(endpoint, method = "GET", data = null) {
      const url = `${window.API_BASE_URL}/api${endpoint}`;
      const headers = { "Content-Type": "application/json" };
      let opts = { method, headers };
  
      if (method === "GET") {
        // Add telegramUser as query param
        const params = new URLSearchParams();
        params.append("telegramUser", JSON.stringify(window.telegramUser));
        return fetch(url + "?" + params.toString(), opts).then((r) => r.json());
      } else {
        // POST/PUT: attach body
        opts.body = JSON.stringify({ telegramUser: window.telegramUser, ...data });
        return fetch(url, opts).then((r) => r.json());
      }
    }
  
    function updatePointsDisplay(points) {
      pointsValueDisplay.textContent = points;
      const profilePointsEl = document.getElementById("profile-points");
      if (profilePointsEl) profilePointsEl.textContent = points;
    }
  
    // ------------------ Page loaders ------------------
  
    async function loadProfilePage() {
      try {
        const profile = await apiRequest("/profile");
        if (!profile || typeof profile.telegram_id === "undefined") {
          throw new Error("Invalid profile data");
        }
  
        document.getElementById("profile-tg-id").textContent = profile.telegram_id;
        document.getElementById("profile-username").textContent =
          profile.username || "N/A";
        document.getElementById("profile-points").textContent = profile.points;
        document.getElementById("profile-invites").textContent =
          profile.referral_count || 0;
  
        updatePointsDisplay(profile.points);
  
        // Handle Bybit UID submission
        const submitUidBtn = document.getElementById("submit-uid-btn");
        const bybitUidInput = document.getElementById("bybit-uid-input");
        
        if (profile.bybit_uid) {
          // User already has a UID - show it and disable editing
          bybitUidInput.value = profile.bybit_uid;
          bybitUidInput.disabled = true;
          submitUidBtn.disabled = true;
          submitUidBtn.textContent = "Already Submitted";
          submitUidBtn.style.opacity = "0.5";
        } else {
          // User can still submit UID
          bybitUidInput.placeholder = "Enter your Bybit UID (one-time only)";
          submitUidBtn.onclick = async () => {
            const newUid = bybitUidInput.value.trim();
            if (!newUid) {
              tg.showAlert("Enter a valid Bybit UID");
              return;
            }
            const res = await apiRequest("/profile/uid", "POST", { bybitUid: newUid });
            if (res.success) {
              tg.showAlert(res.message || "UID submitted successfully");
              // Reload the profile to show the updated state
              await loadProfilePage();
            } else {
              tg.showAlert(res.message || res.error || "Failed to submit UID");
            }
          };
        }
      } catch (error) {
        console.error("APP_JS: loadProfilePage error:", error);
        pageContainer["loading-page"].innerHTML =
          "Error loading profile. See console.";
        throw error;
      }
    }
  
    async function loadQuestPage() {
      const questList = document.getElementById("quest-list");
      questList.innerHTML = "<p>Loading daily quests...</p>";
  
      try {
        const response = await apiRequest("/quests");
        const currentDay = response.current_day;
        const quests = response.quests || [];
        
        // Filter for daily and qa quests
        const dailyQuests = quests.filter((q) => q.type === "daily" || q.type === "qa");
  
        if (dailyQuests.length === 0) {
          questList.innerHTML =
            "<p>No quests available at the moment.</p>";
          return;
        }
  
        questList.innerHTML = `
          <div class="event-status">
            <h3>🏙️ Bybit City 30-Day Challenge</h3>
            <p><strong>Day ${currentDay}/30</strong> • Complete daily quests to build the city!</p>
          </div>
        `;
  
        dailyQuests.forEach((quest) => {
          const questData = JSON.parse(quest.quest_data || "{}");
          const item = document.createElement("div");
          
          // Different styling based on quest status
          if (quest.is_completed) {
            item.className = "task-item completed";
          } else if (quest.is_available) {
            item.className = "task-item available";
          } else {
            item.className = "task-item locked";
          }
          
          let statusHtml = "";
          if (quest.is_completed) {
            statusHtml = `<button disabled><i class="fas fa-check"></i> Completed</button>`;
          } else if (quest.is_available) {
            statusHtml = `
              <input type="text" placeholder="Your answer" class="quest-answer-input">
              <button data-quest-id="${quest.id}" class="submit-answer-btn">Submit Answer</button>
            `;
          } else {
            statusHtml = `<button disabled><i class="fas fa-lock"></i> Available on Day ${quest.day_number}</button>`;
          }
          
          item.innerHTML = `
            <h3>
              ${quest.title} 
              <span class="points">${quest.points_reward} BP</span>
              ${quest.type === 'daily' ? `<span class="day-badge">Day ${quest.day_number}</span>` : ''}
            </h3>
            <p>${quest.description}</p>
            ${questData.question ? `<p class="question"><strong>Question:</strong> ${questData.question}</p>` : ''}
            ${statusHtml}
          `;
          questList.appendChild(item);
  
          if (!quest.is_completed && quest.is_available) {
            const button = item.querySelector(".submit-answer-btn");
            const input = item.querySelector(".quest-answer-input");
  
            button.addEventListener("click", async () => {
              const answer = input.value.trim();
              if (!answer) {
                tg.showAlert("Please enter an answer.");
                return;
              }
  
              button.disabled = true;
              button.textContent = "Submitting...";
              
              try {
                const result = await apiRequest("/quests/complete", "POST", {
                  questId: quest.id,
                  answer
                });
                if (result.success) {
                  tg.showAlert("✅ " + result.message);
                  await loadQuestPage();
                  await loadProfilePage();
                } else {
                  tg.showAlert("❌ " + (result.error || "Answer incorrect"));
                  button.disabled = false;
                  button.textContent = "Submit Answer";
                }
              } catch (err) {
                console.error("APP_JS: Error submitting quest:", err);
                tg.showAlert("Submission failed. Check console.");
                button.disabled = false;
                button.textContent = "Submit Answer";
              }
            });
          }
        });
      } catch (error) {
        console.error("APP_JS: Could not load quests:", error);
        questList.innerHTML =
          "<p>Could not load quests. Please try refreshing.</p>";
      }
    }
  
    async function loadFollowPage() {
      const followList = document.getElementById("follow-list");
      followList.innerHTML = "<p>Loading social tasks...</p>";
  
      try {
        const response = await apiRequest("/quests");
        
        // Handle both old format (direct array) and new format (object with quests array)
        const quests = response.quests || response;
        
        const socialQuests = quests.filter((q) => q.type === "social_follow");
  
        if (socialQuests.length === 0) {
          followList.innerHTML =
            "<p>No social tasks available at the moment.</p>";
          return;
        }
  
        followList.innerHTML = "";
  
        socialQuests.forEach((quest) => {
          const questData = JSON.parse(quest.quest_data || "{}");
          const item = document.createElement("div");
          item.className = "task-item";
          item.innerHTML = `
            <h3>${quest.title} <span class="points">${quest.points_reward} BP</span></h3>
            <p>${quest.description}</p>
            ${
              quest.is_completed
                ? `<button disabled><i class="fas fa-check"></i> Completed</button>`
                : `<button data-quest-id="${quest.id}" data-url="${questData.url ||
                    "#"}" data-chat-id="${questData.chatId || ""}" class="join-btn">Join</button>
                   <button data-quest-id="${quest.id}" data-chat-id="${questData.chatId ||
                    ""}" class="verify-btn" style="display:none;">Verify</button>`
            }
          `;
          followList.appendChild(item);
  
          if (!quest.is_completed) {
            const joinBtn = item.querySelector(".join-btn");
            const verifyBtn = item.querySelector(".verify-btn");
  
            joinBtn.addEventListener("click", () => {
              const url = joinBtn.dataset.url;
              if (url && url !== "#") {
                tg.openLink(url);
                joinBtn.style.display = "none";
                verifyBtn.style.display = "inline-block";
              }
            });
  
            verifyBtn.addEventListener("click", async () => {
              const questId = verifyBtn.dataset.questId;
              const chatId = verifyBtn.dataset.chatId;
              verifyBtn.disabled = true;
              verifyBtn.textContent = "Verifying...";
  
              try {
                if (!chatId) {
                  // If no chatId (e.g. Twitter), just mark complete
                  const result = await apiRequest("/quests/complete", "POST", {
                    questId
                  });
                  tg.showPopup({
                    title: "Success!",
                    message: result.message,
                    buttons: [{ type: "ok" }]
                  });
                  await loadFollowPage();
                  await loadProfilePage();
                  return;
                }
  
                // Otherwise verify membership on Telegram
                const result = await apiRequest("/verify/telegram", "POST", {
                  questId,
                  chatId
                });
                if (result.verified || result.alreadyVerified) {
                  tg.showPopup({
                    title: "Success!",
                    message: result.message,
                    buttons: [{ type: "ok" }]
                  });
                  await loadFollowPage();
                  await loadProfilePage();
                } else {
                  tg.showPopup({
                    title: "Not Verified",
                    message: result.message,
                    buttons: [{ type: "ok" }]
                  });
                  verifyBtn.disabled = false;
                  verifyBtn.textContent = "Verify";
                }
              } catch (err) {
                console.error("APP_JS: Failed to verify quest:", err);
                tg.showAlert("Verification failed. Please try again.");
                verifyBtn.disabled = false;
                verifyBtn.textContent = "Verify";
              }
            });
          }
        });
      } catch (error) {
        console.error("APP_JS: Could not load social tasks:", error);
        followList.innerHTML =
          "<p>Could not load social tasks. Please try refreshing.</p>";
      }
    }
  
    async function loadInvitePage() {
      const inviteLinkEl = document.getElementById("invite-link");
      const referralHistoryEl = document.getElementById("referral-history");
      inviteLinkEl.textContent = "Loading…";
  
      try {
        const profile = await apiRequest("/profile");
        if (!profile || typeof profile.telegram_id === "undefined") {
          throw new Error("Invalid profile data");
        }
  
        // Generate a proper invite link
        const botUsername = tg.initDataUnsafe.bot_username || "testbla500bot";
        const refLink = `https://t.me/${botUsername}?start=ref_${profile.telegram_id}`;
        inviteLinkEl.textContent = refLink;
  
        // Copy button logic
        const copyBtn = document.getElementById("copy-invite-link-btn");
        copyBtn.onclick = () => {
          const tempInput = document.createElement("input");
          tempInput.value = refLink;
          document.body.appendChild(tempInput);
          tempInput.select();
          document.execCommand("copy");
          document.body.removeChild(tempInput);
          tg.showAlert("Invite link copied to clipboard!");
        };
  
        // Load referral history
        const referrals = await apiRequest("/referrals");
        if (!Array.isArray(referrals) || referrals.length === 0) {
          referralHistoryEl.innerHTML =
            "<p>No referrals yet. Share your link to earn rewards!</p>";
          updatePointsDisplay(profile.points);
          return;
        }
  
        // Calculate totals
        const totalInvited = referrals.length;
        const totalInvitedPoints = referrals.reduce((sum, ref) => sum + (ref.points_earned || 0), 0);
        const totalReferralBonus = Math.floor(totalInvitedPoints * 0.1); // 10% of invited users' points

        referralHistoryEl.innerHTML = `
          <div class="referral-summary">
            <div class="summary-item">
              <i class="fas fa-users"></i>
              <div>
                <strong>Total Invited:</strong> ${totalInvited} citizens
              </div>
            </div>
            <div class="summary-item">
              <i class="fas fa-coins"></i>
              <div>
                <strong>Total Invited Points:</strong> ${totalInvitedPoints} BP
              </div>
            </div>
            <div class="summary-item">
              <i class="fas fa-percentage"></i>
              <div>
                <strong>Your Referral Bonus (10%):</strong> ${totalReferralBonus} BP
              </div>
            </div>
            <div class="bonus-explanation">
              <i class="fas fa-info-circle"></i>
              <small>You earn 10% of all points earned by users you invite!</small>
            </div>
          </div>
        `;
        updatePointsDisplay(profile.points);
      } catch (error) {
        console.error("APP_JS: Failed to load invite page:", error);
        inviteLinkEl.textContent = "Error loading invite link.";
        referralHistoryEl.innerHTML =
          "<p>Error loading referral history. See console.</p>";
      }
    }
  
    async function loadLeaderboardPage() {
      const leaderboardList = document.getElementById("leaderboard-list");
      leaderboardList.innerHTML = "<p>Loading city leaders...</p>";
  
      try {
        const leaderboard = await apiRequest("/leaderboard");
        if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
          leaderboardList.innerHTML =
            "<p>No citizens have earned points yet.</p>";
          return;
        }
  
        leaderboardList.innerHTML = "";
        leaderboard.forEach((user, index) => {
          const item = document.createElement("div");
          item.className = "leaderboard-item";
  
          // Ranks for top 3
          let rankDisplay = `<div class="rank">${index + 1}</div>`;
          if (index === 0) {
            rankDisplay = `<div class="rank"><i class="fas fa-crown" style="color: gold;"></i></div>`;
          } else if (index === 1) {
            rankDisplay = `<div class="rank"><i class="fas fa-medal" style="color: silver;"></i></div>`;
          } else if (index === 2) {
            rankDisplay = `<div class="rank"><i class="fas fa-medal" style="color: #cd7f32;"></i></div>`;
          }
  
          item.innerHTML = `
            ${rankDisplay}
            <div class="user-info">
              <p>${user.username || "User #" + user.telegram_id}</p>
            </div>
            <div class="points">${user.points} BP</div>
          `;
          leaderboardList.appendChild(item);
        });
      } catch (error) {
        console.error("APP_JS: Could not load leaderboard:", error);
        leaderboardList.innerHTML =
          "<p>Could not load city leaders. Please try refreshing.</p>";
      }
    }
  
    // ------------ Navigation and Page Switching ----------
    function showPage(pageId) {
      Object.values(pageContainer).forEach((pageEl) => {
        if (pageEl) pageEl.style.display = "none";
      });
      pageContainer[pageId].style.display = "block";
      navButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.page === pageId);
      });
      switch (pageId) {
        case "quest-page":
          loadQuestPage();
          break;
        case "follow-page":
          loadFollowPage();
          break;
        case "invite-page":
          loadInvitePage();
          break;
        case "leaderboard-page":
          loadLeaderboardPage();
          break;
        case "profile-page":
          loadProfilePage();
          break;
      }
    }
  
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        showPage(btn.dataset.page);
      });
    });
  
  
    // ------------ App Initialization ------------
    async function initializeApp() {
      // Show loading screen
      showPage("loading-page");
  
      try {
        await loadProfilePage();
        showPage("quest-page");
      } catch (err) {
        console.error("APP_JS: initializeApp failed:", err);
        pageContainer["loading-page"].innerHTML =
          "App failed to load. Check console for details.";
      }
    }
  
    initializeApp();
  });
