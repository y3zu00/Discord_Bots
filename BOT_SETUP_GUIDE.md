# 🤖 Complete Discord Bots Setup & Running Guide

This guide will help you set up and run all four Discord bots in your trading ecosystem.

## 📋 **Prerequisites**

### **1. Node.js & Python Setup**
- **Node.js**: Version 18+ (for trading mentor bot and question bot)
- **Python**: Version 3.10+ (for signals bot)
- **Git**: For cloning repositories

### **2. API Keys Required**
- **Discord Bot Token**: From Discord Developer Portal
- **OpenAI API Key**: For AI features
- **Alpha Vantage API Key**: For market data (trading mentor bot)
- **TradingView API**: For technical analysis (signals bot)

## 🚀 **Bot Overview**

| Bot | Language | Purpose | Port/Channel |
|-----|----------|---------|--------------|
| **Signals Bot** | Python | Daily trading signals, portfolio tracking | Channel: `1401735690458370048` |
| **Trading Mentor Bot** | Node.js | AI trading mentor, personalized advice | Channel: `1401735712130207824` |
| **Question Daily Bot** | Node.js | Daily trading questions with answers | Channel: `process.env.CHANNEL_ID` |
| **News Bot** | Node.js | Curated news drops + AI artwork every 4h | Channel: `process.env.NEWS_CHANNEL_ID` |

## 🔧 **Setup Instructions**

### **Step 1: Discord Bot Setup**

1. **Go to Discord Developer Portal**: https://discord.com/developers/applications
2. **Create 4 Applications** (one for each bot):
   - `Jack Of All Signals Bot`
   - `Trading Mentor Bot` 
   - `Question Daily Bot`
   - `Jack Of All News Bot`
3. **For each bot**:
   - Go to "Bot" section
   - Click "Add Bot"
   - Enable **Message Content Intent**
   - Copy the token
   - Generate OAuth2 URL with "bot" and "applications.commands" scopes
   - Invite to your Discord server

### **Step 2: Environment Variables**

Create `.env` files for each bot:

#### **Signals Bot** (`signals-bot/.env`)
```env
DISCORD_TOKEN=your_signals_bot_token_here
SIGNAL_CHANNEL_ID=1401735690458370048
```

#### **Trading Mentor Bot** (`trading-mentor-bot/.env`)
```env
DISCORD_TOKEN=your_mentor_bot_token_here
OPENAI_API_KEY=your_openai_api_key_here
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here
```

#### **Question Daily Bot** (`question-daily-bot/.env`)
```env
DISCORD_TOKEN=your_question_bot_token_here
CHANNEL_ID=your_question_channel_id_here
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_URL=postgres_connection_string
```

#### **News Bot** (`news-bot/.env`)
```env
DISCORD_TOKEN=your_news_bot_token_here
NEWS_CHANNEL_ID=target_news_channel_id
OPENAI_API_KEY=your_openai_api_key_here
ALPHA_VANTAGE_KEY=your_alpha_vantage_key_here
CRYPTO_PANIC_KEY=your_cryptopanic_key_here
FINNHUB_API_KEY=your_finnhub_key_here
```

### **Step 3: Install Dependencies**

#### **For Signals Bot (Python)**
```bash
cd signals-bot
pip install -r requirements.txt
```

#### **For Trading Mentor Bot (Node.js)**
```bash
cd trading-mentor-bot
npm install
```

#### **For Question Daily Bot (Node.js)**
```bash
cd question-daily-bot
npm install
```

#### **For News Bot (Node.js)**
```bash
cd news-bot
npm install
```

### **Step 4: Run database migrations**

Before starting any service, ensure the database schema is up to date:

```bash
python migrations/run_migrations.py
```

This script is safe to run repeatedly. It tracks which migrations have already
run and skips them automatically.

## 🏃‍♂️ **Running the Bots**

### **Method 1: Individual Terminal Windows (Recommended)**

#### **Terminal 1 - Signals Bot**
```bash
cd signals-bot
python main.py
```

#### **Terminal 2 - Trading Mentor Bot**
```bash
cd trading-mentor-bot
node index.js
```

#### **Terminal 3 - Question Daily Bot**
```bash
cd question-daily-bot
node index.js
```

#### **Terminal 4 - News Bot**
```bash
cd news-bot
npm start
```

### **Method 2: Background Processes (Linux/Mac)**

#### **Start all bots in background**
```bash
# Signals Bot
cd signals-bot && nohup python main.py > signals.log 2>&1 &

# Trading Mentor Bot
cd trading-mentor-bot && nohup node index.js > mentor.log 2>&1 &

# Question Daily Bot
cd question-daily-bot && nohup node index.js > question.log 2>&1 &

# News Bot
cd news-bot && nohup npm start > news.log 2>&1 &
```

#### **Check if bots are running**
```bash
ps aux | grep -E "(python main.py|node index.js)"
```

#### **Stop all bots**
```bash
pkill -f "python main.py"
pkill -f "node index.js"
```

### **Method 3: Using PM2 (Process Manager)**

PM2 keeps the bots and the website server running, restarts them if they crash,
and centralises logging.

#### **Install PM2**
```bash
npm install -g pm2
```

#### **Start everything with the shared config**
```bash
# Run from the repository root after migrations
pm2 start pm2.config.cjs
```

The configuration already knows the working directory and `.env` file for each
service (signals bot, mentor bot, question bot, website server).

#### **PM2 Commands**
```bash
pm2 list                         # List all processes
pm2 logs signals-bot             # View logs for the signals bot
pm2 restart website-server       # Restart just the website backend
pm2 stop all                     # Stop all processes
pm2 delete all                   # Remove all processes from PM2
pm2 save                         # Persist the current process list (optional)
```

## 📊 **Bot Features & Commands**

### **Signals Bot Commands**
- `!analyze <symbol>` - Technical analysis
- `!portfolio add <symbol> <shares> <price>` - Add position
- `!watchlist add <symbol>` - Add to watchlist
- `!alert <symbol> <price>` - Set price alert
- `!market` - Market status
- `!test_signal` - Test signal format

### **Trading Mentor Bot Commands**
- `/ask <question>` - Ask AI mentor
- `/setup` - Set up profile
- `/profile` - View profile
- `/portfolio` - View portfolio
- `/stats` - View statistics
- `/leaderboard` - Question leaderboard

### **Question Daily Bot Features**
- **Daily questions** at 12 PM (configurable)
- **Answer tracking** - Shows yesterday's answer with today's question
- **AI-generated explanations** for learning
- **Poll-based responses** with 24-hour duration

### **News Bot Highlights**
- Sources Alpha Vantage, CryptoPanic, and Finnhub feeds with fallback logic
- Ranks articles via sentiment, recency, and ticker relevance to keep the drop high-signal
- Summarizes each story into **Summary / Breakdown / Impact**
- Generates a fresh AI artwork per post (OpenAI `gpt-image-1`)
- Posts every four hours and tracks history to avoid duplicate headlines

## 🔧 **Configuration**

### **Change Question Bot Schedule**
Edit `question-daily-bot/index.js` line 215:
```javascript
// Change from every minute to daily at 12 PM
cron.schedule("0 12 * * *", async () => {
```

### **Change Signal Bot Schedule**
Edit `signals-bot/main.py` line 1498:
```python
# Change from 6:40 AM to your preferred time
@tasks.loop(time=dt.time(hour=6, minute=40, tzinfo=PACIFIC_TZ))
```

### **Channel Restrictions**
- **Signals Bot**: Channel ID `1401735690458370048`
- **Trading Mentor Bot**: Channel ID `1401735712130207824`
- **Question Bot**: Set in `.env` file
- **News Bot**: Set in `news-bot/.env` (`NEWS_CHANNEL_ID`)

## 🐛 **Troubleshooting**

### **Common Issues**

#### **Bot Not Responding**
1. Check if bot is online in Discord
2. Verify channel permissions
3. Check console logs for errors
4. Ensure API keys are valid

#### **Database Issues**
1. Verify the Neon/Postgres instance is reachable (`psql $DATABASE_URL`)
2. Confirm `DATABASE_URL` is set in each service's `.env`
3. Check connection limits and SSL requirements

#### **API Rate Limits**
1. Check API key usage limits
2. Add delays between requests
3. Monitor console logs for rate limit errors

### **Log Files**
- **Signals Bot**: Console output
- **Trading Mentor Bot**: Console output
- **Question Bot**: Console output
- **PM2 Logs**: `~/.pm2/logs/`

## 📈 **Monitoring & Maintenance**

### **Daily Checks**
1. Verify all bots are running
2. Check for error messages in logs
3. Test key commands
4. Monitor API usage

### **Weekly Tasks**
1. Review bot performance
2. Update dependencies if needed
3. Check database size
4. Backup configuration files

### **Monthly Tasks**
1. Update API keys if needed
2. Review and optimize code
3. Check for Discord API changes
4. Update documentation

## 🚀 **Advanced Features**

### **Database Integration**
All bots share the same Neon/PostgreSQL database for:
- User profiles and preferences
- Portfolio tracking
- Question responses
- Learning progress

### **Answer Tracking (NEW)**
The question bot now:
- Generates AI explanations for each question
- Shows yesterday's answer with today's question
- Provides educational content for learning
- Tracks question history

### **Personalization**
- User profiles across all bots
- Personalized greetings and advice
- Progress tracking and statistics
- Learning recommendations

## 📞 **Support**

If you encounter issues:
1. Check the console logs first
2. Verify all environment variables
3. Test API keys individually
4. Check Discord permissions
5. Review this guide for common solutions

---

**🎯 Pro Tip**: Start with the signals bot first, then add the mentor bot, and finally the question bot. This ensures the database is properly set up before the other bots try to access it.
