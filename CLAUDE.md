# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

- **Start development server**: `npm run dev` (uses nodemon for auto-restart)
- **Start production server**: `npm start`
- **Initialize database**: `npm run init-db`
- **Build Docker image**: `docker build -t bybit-event-app .`
- **Deploy to Google Cloud Run**: See `cloud-run-deployment.md` for complete instructions

## Architecture Overview

This is a Telegram Mini Web App for Bybit events with a Node.js/Express backend and vanilla JavaScript frontend.

### Core Components

**Backend (`server.js`)**:
- Express server handling both API endpoints and static file serving
- Telegram Bot webhook integration for handling `/start` commands with referral tracking
- `ensureUser` middleware that validates Telegram user data and handles user creation/referral processing
- SQLite database integration with transaction support for points and referrals

**Database (`database.js`)**:
- SQLite with tables: Users, Quests, UserQuests, PointTransactions, PendingReferrals
- `addPoints()` function handles both point addition and automatic referral bonuses (10% to referrer)
- Referral system supports both bot-based referrals (via `/start ref_<userid>`) and web app fallback

**Frontend (`public/app.js`)**:
- Single Page App with navigation between quest, follow, invite, leaderboard, and profile pages
- Telegram WebApp API integration for user authentication and UI interactions
- API communication using custom `apiRequest()` helper that includes Telegram user data

### Key Features

- **Quest System**: Q&A quests and social follow quests with point rewards
- **Referral Tracking**: Two-tier system (bot webhook + web app fallback) with invite bonuses
- **Daily Check-ins**: Point rewards for daily engagement
- **Telegram Integration**: Channel/group membership verification via bot API
- **Leaderboard**: User ranking by points earned

### Environment Variables

Required:
- `TELEGRAM_BOT_TOKEN`: Bot token from @BotFather
- `MINI_APP_URL`: Your deployed app URL (for webhook and Mini App configuration)

### Database Schema

The database auto-initializes with sample quests. Key relationships:
- Users can have referrers (self-referencing foreign key)
- UserQuests tracks quest completion
- PointTransactions logs all point changes with reasons
- PendingReferrals handles bot-initiated referrals before user registration

### Deployment

Uses Docker with Google Cloud Run. The `Dockerfile` initializes the database during build. See `cloud-run-deployment.md` for complete deployment workflow.