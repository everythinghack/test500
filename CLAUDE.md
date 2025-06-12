# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

- **Start development server**: `npm run dev` (uses nodemon for auto-restart)
- **Start production server**: `npm start`
- **Initialize database**: `npm run init-db`
- **Deploy to Railway**: Push to GitHub main branch (auto-deploys via railway.json config)
- **Deploy to Google Cloud Run**: See `DEPLOYMENT.md` for complete instructions

## Architecture Overview

This is a Telegram Mini Web App for Bybit events with a Node.js/Express backend and vanilla JavaScript frontend. The app uses a hybrid database approach with PostgreSQL for production (Railway) and SQLite for local development.

### Core Components

**Backend (`server.js`)**:
- Express server handling both API endpoints and static file serving
- Telegram Bot webhook integration for handling `/start` commands with referral tracking
- `ensureUser` middleware that validates Telegram user data and handles user creation/referral processing
- Hybrid database support (PostgreSQL/SQLite) with transaction support for points and referrals
- **Hardcoded quest system**: DAILY_QUESTS and SOCIAL_TASKS arrays in server.js for easy modification

**Database (`database.js`)**:
- **Dual database support**: PostgreSQL for production (Railway), SQLite for local development
- Tables: Users, Quests, UserQuests, PointTransactions, PendingReferrals, EventConfig
- `addPoints()` function handles both point addition and automatic referral bonuses (10% to referrer)
- **Quest completion tracking**: Uses `completed_quests` TEXT field in Users table to avoid foreign key constraints
- Referral system supports both bot-based referrals (via `/start ref_<userid>`) and web app fallback

**Frontend (`public/app.js`)**:
- **Unified Tasks interface**: Single page with 4 tabs (Daily Tasks, Weekly Tasks, One-time Tasks, Recurring Tasks)
- Replaces separate Quest and Follow pages with tabbed navigation
- Telegram WebApp API integration for user authentication and UI interactions
- API communication using custom `apiRequest()` helper that includes Telegram user data

### Key Architecture Decisions

**Hardcoded Quests**: Quest and task definitions are stored as arrays in `server.js` rather than database tables. This allows easy modification without database migrations and avoids foreign key constraint issues.

**Quest Completion Strategy**: Uses `completed_quests` TEXT field in Users table storing comma-separated quest IDs instead of UserQuests table to prevent foreign key constraint failures.

**Database Abstraction**: `database.js` provides SQLite-compatible wrapper methods for PostgreSQL to maintain consistent API across environments.

### Key Features

- **Task System**: Unified interface with Daily Tasks (Q&A), Weekly Tasks (placeholder), One-time Tasks (social follows), Recurring Tasks (placeholder)
- **Referral Tracking**: Two-tier system (bot webhook + web app fallback) with invite bonuses
- **Event Management**: 30-day event system with day-based quest unlocking
- **Telegram Integration**: Channel/group membership verification via bot API
- **Leaderboard**: User ranking by points earned

### Environment Variables

Required:
- `TELEGRAM_BOT_TOKEN`: Bot token from @BotFather (7414638833:AAGLMQHQHScDJohRrIvcmYvUAcLwdV0vA5I)
- `MINI_APP_URL`: Your deployed app URL (for webhook and Mini App configuration)
- `DATABASE_URL`: PostgreSQL connection string (automatically provided by Railway)

### Quest/Task Configuration

Modify quests and tasks directly in `server.js`:
- **DAILY_QUESTS**: Array of Q&A quests with day numbers (1-30)
- **SOCIAL_TASKS**: Array of social media follow tasks with URLs and chat IDs

### Database Schema

Key relationships:
- Users can have referrers (self-referencing foreign key)
- Users.completed_quests stores comma-separated quest IDs (avoids foreign key issues)
- PointTransactions logs all point changes with reasons
- PendingReferrals handles bot-initiated referrals before user registration
- EventConfig manages 30-day event timing

### Deployment

Primary deployment via Railway with PostgreSQL. Uses `railway.json` for configuration. Bot configuration: @testbla500bot. See `DEPLOYMENT.md` for multiple deployment options including Railway, Render, and Google Cloud Run.