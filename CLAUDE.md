# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Bot Configuration

- **Bot Token**: `8120704547:AAEPEn9EY8bZmiGyIFh7dtFwPVwPs0zGpyA`
- **Bot Username**: `@testbla700bot`
- **Deployment URL**: `https://bybit-telegram-bot-464578924371.asia-south1.run.app`
- **Container Image**: `everythinghack/bybit-telegram-bot`

## Common Development Commands

- **Start development server**: `npm run dev` (uses nodemon for auto-restart)
- **Start production server**: `npm start`
- **Initialize database**: `npm run setup-db` (one-time only)
- **Deploy to Cloud Run**: `docker build -t everythinghack/bybit-telegram-bot . && docker push everythinghack/bybit-telegram-bot`
- **Setup database**: Visit `https://bybit-telegram-bot-464578924371.asia-south1.run.app/setup-database` (one-time only)

## Architecture Overview

This is a Telegram Mini Web App for Bybit events with a Node.js/Express backend and vanilla JavaScript frontend. The app uses SQLite for local development and Cloud Run's managed storage for production.

### Core Components

**Backend (`server.js`)**:
- Express server handling both API endpoints and static file serving
- Telegram Bot webhook integration for handling `/start` commands with referral tracking
- `ensureUser` middleware that validates Telegram user data and handles user creation/referral processing
- Hybrid database support (PostgreSQL/SQLite) with transaction support for points and referrals
- **Hardcoded quest system**: DAILY_QUESTS and SOCIAL_TASKS arrays in server.js for easy modification

**Database (`database.js`)**:
- **SQLite database**: Persistent storage on Cloud Run with automatic backups
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

**Data Persistence**: SQLite database persists across Cloud Run deployments using container storage.

### Key Features

- **Task System**: Unified interface with Daily Tasks (Q&A), Weekly Tasks (placeholder), One-time Tasks (social follows), Recurring Tasks (placeholder)
- **Referral Tracking**: Two-tier system (bot webhook + web app fallback) with invite bonuses
- **Event Management**: 30-day event system with day-based quest unlocking
- **Telegram Integration**: Channel/group membership verification via bot API
- **Leaderboard**: User ranking by points earned

### Environment Variables

Required:
- `TELEGRAM_BOT_TOKEN`: `8120704547:AAEPEn9EY8bZmiGyIFh7dtFwPVwPs0zGpyA`
- `MINI_APP_URL`: `https://bybit-telegram-bot-464578924371.asia-south1.run.app`
- `NODE_ENV`: `production`

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

Deployment via Google Cloud Run using Docker Hub container. Bot configuration: @testbla700bot. Database initialization via `/setup-database` endpoint (one-time only).

**Container Image**: `everythinghack/bybit-telegram-bot`
**Deployment URL**: `https://bybit-telegram-bot-464578924371.asia-south1.run.app`