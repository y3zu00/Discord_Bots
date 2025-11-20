# 🚀 Trading Mentor Bot - Personalized Features

The Trading Mentor Bot now integrates with the shared database to provide personalized trading experiences!

## 🔗 **Database Integration**

The bot connects to the shared Neon/PostgreSQL database, allowing it to:
- Access user profiles and preferences
- View portfolio and watchlist data
- Track learning progress
- Display question performance statistics
- Show leaderboards

## 📋 **New Personalized Commands**

### **Profile Management**
- `/setup` - Create your trading profile with experience level, timeframe, risk tolerance, and goals
- `/profile` - View your current trading profile and settings

### **Learning & Progress**
- `/progress` - Track your progress through learning modules
- `/stats` - View comprehensive trading statistics

### **Portfolio Integration**
- `/portfolio` - View your portfolio positions from the signals bot
- `/watchlist` - See your watchlist from the signals bot

### **Community Features**
- `/leaderboard` - View the question leaderboard based on daily question performance

## 🎯 **How It Works**

1. **First Time Setup**: Use `/setup` to create your profile
2. **Personalized Advice**: The bot will tailor responses based on your experience level
3. **Progress Tracking**: Monitor your learning journey and trading performance
4. **Seamless Integration**: All data syncs between the signals bot and mentor bot

## 🔧 **Setup Requirements**

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Database Access**: Ensure the bot can access the shared Postgres database (`DATABASE_URL`)

3. **Environment Variables**: Set up your `.env` file with Discord and OpenAI tokens

4. **Run migrations** so the shared database schema is current:
   ```bash
   python ../migrations/run_migrations.py
   ```

## 💡 **Usage Examples**

### **Setting Up Your Profile**
```
/setup experience:intermediate timeframe:4h risk:moderate goals:Master swing trading
```

### **Viewing Your Progress**
```
/progress
```

### **Checking Your Portfolio**
```
/portfolio
```

### **Viewing Leaderboard**
```
/leaderboard
```

## 🎨 **Features**

- **Personalized Greetings**: Bot remembers your name and provides custom greetings
- **Experience-Based Advice**: Tailored recommendations based on your skill level
- **Progress Visualization**: Visual progress bars for learning modules
- **Real-Time Data**: Live portfolio and watchlist information
- **Performance Tracking**: Monitor your question-answering performance

## 🔄 **Data Flow**

1. **Signals Bot** → Creates user profiles, tracks portfolio, manages watchlists
2. **Trading Mentor Bot** → Reads user data, provides personalized advice
3. **Question Daily Bot** → Records question responses, updates leaderboards
4. **Shared Database** → All bots access the same user data

## 🚀 **Next Steps**

After setting up your profile, the bot will:
- Remember your preferences across sessions
- Provide tailored trading advice
- Track your learning progress
- Show personalized statistics

---

**Note**: Make sure both the signals bot and trading mentor bot are running for full functionality!
