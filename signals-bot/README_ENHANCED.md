# 🚀 Enhanced Trading Signals Bot

A professional-grade Discord bot for trading signals with advanced features, interactive charts, portfolio tracking, and real-time market analysis.

## ✨ **Major Features**

### 📊 **Daily Auto-Signals**
- **Automatic daily signals** at 6:40 AM Pacific Time
- **Professional embed format** with your custom brand color (#d29544)
- **Interactive charts** with support/resistance levels
- **Risk management** with entry zones, targets, and stop losses
- **Multi-timeframe analysis** (5m, 15m, 1h, 1d)

### 🎯 **Enhanced Commands**

#### **Analysis Commands**
- `!analyze <symbol>` - Detailed technical analysis with charts
- `!price <symbol>` - Quick price lookup
- `!test_signal` - Test daily signal format with AAPL
- `!show_stocks` - List available penny stocks

#### **Portfolio Management**
- `!portfolio show` - View your portfolio with live P&L
- `!portfolio add <symbol> <shares> <price>` - Add position
- `!portfolio remove <symbol>` - Close position with P&L calculation
- `!portfolio setup` - Create your trading profile
- `!portfolio profile` - View your trading profile
- `!portfolio stats` - View detailed trading statistics

#### **Watchlist & Alerts**
- `!watchlist` - Show your personal watchlist
- `!watchlist add <symbol>` - Add to watchlist
- `!watchlist remove <symbol>` - Remove from watchlist
- `!alert <symbol> <price>` - Set price alerts
- `!alerts` - Show your active alerts

#### **Market Information**
- `!market` - Market open/closed status
- `!show_time` - Current Pacific time
- `!stats` - Bot performance statistics
- `!commands` - Show all available commands

### 📈 **Interactive Charts**
- **Custom chart generation** using matplotlib
- **Support/resistance levels** displayed on charts
- **Volume analysis** included
- **Professional styling** with your brand colors
- **High-resolution images** (300 DPI)

### 💾 **Database Features**
- **SQLite database** for persistent storage
- **Signal history** tracking
- **User portfolios** with P&L calculation
- **Watchlists** per user
- **Price alerts** system
- **Performance analytics**

## 🎨 **Visual Enhancements**

### **Custom Branding**
- **Primary Color**: #d29544 (rgba(210,149,68,255))
- **Professional embeds** for all responses
- **Color-coded signals** (Green for positive, Red for negative)
- **Emoji-rich interface** for better UX

### **Signal Format Example**
```
🚨 DAILY SIGNAL: AAPL

📊 Signal Strength: 🟢 STRONG BUY
💰 Current Price: $150.25
📈 Today's High: $151.50

🎯 Technical Analysis:
5M: BUY
15M: STRONG_BUY
1H: BUY
1D: NEUTRAL

📊 Key Levels:
Support: $148.50 | $147.25
Resistance: $152.00 | $153.75

⚠️ Risk Management:
Entry Zone: $147.25 - $148.50
Target 1: $152.00 (+1.2%)
Target 2: $153.75 (+2.3%)
Stop Loss: $147.25 (-2.0%)

📈 Live Chart: [View on TradingView]
```

## 🔧 **Setup Instructions**

### **1. Install Dependencies**
```bash
pip install -r requirements.txt
```

### **2. Environment Setup**
Create a `.env` file:
```
DISCORD_TOKEN=your_bot_token_here
SIGNAL_CHANNEL_ID=your_signal_channel_id_here
COMMAND_CHANNEL_ID=your_command_channel_id_here
```

### **3. Discord Bot Setup**
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section
4. Enable **Message Content Intent**
5. Copy the token to your `.env` file
6. Use OAuth2 URL Generator to invite bot to your server

### **4. Run database migrations**
```bash
python ../migrations/run_migrations.py
```

This ensures the shared Postgres schema is up to date. It’s safe to run
multiple times.

### **5. Run the Bot**
```bash
python main.py
```

## 📊 **2-Channel System**

### **📈 Signals Channel**
- **Purpose**: Daily signals only (6:40 AM Pacific)
- **Content**: Automated signals with @everyone mentions
- **Users**: Read-only for most users
- **Clean**: No command spam, just pure signals

### **🤖 Commands Channel**
- **Purpose**: All bot interactions and portfolio management
- **Commands**: `/portfolio`, `/analyze`, `/watchlist`, `/alerts`, etc.
- **Users**: Interactive commands, profile setup, analysis
- **Onboarding**: New users set up profiles here

## 📊 **Daily Signal Schedule**

- **Time**: 6:40 AM Pacific Time (daily)
- **Channel**: Signals Channel only
- **Content**: 
  - Top penny stock with best technical analysis
  - Professional embed with all analysis
  - Interactive chart image
  - Risk management levels
  - TradingView chart link

## 🎯 **Usage Examples**

### **Portfolio Management**
```
!portfolio add AAPL 10 150.00
!portfolio show
!portfolio remove AAPL
```

### **Technical Analysis**
```
!analyze TSLA
!price NVDA
!test_signal
```

### **Watchlist & Alerts**
```
!watchlist add AMD
!alert NVDA 500
!alerts
```

## 🔒 **Security & Privacy**

- **User data isolation** - Each user's portfolio/watchlist is private
- **Database encryption** - SQLite with proper data handling
- **Error handling** - Graceful failure with user-friendly messages
- **Rate limiting** - Built-in protection against API abuse

## 🚀 **Performance Features**

- **Async operations** for fast responses
- **Caching** for frequently accessed data
- **Error recovery** with fallback mechanisms
- **Memory management** with automatic cleanup

## 📈 **Future Enhancements**

- [ ] Real-time price streaming
- [ ] Options flow analysis
- [ ] Earnings calendar integration
- [ ] Advanced pattern recognition
- [ ] Social sentiment analysis
- [ ] Mobile app companion

## 🛠 **Technical Stack**

- **Python 3.11+**
- **Discord.py** - Bot framework
- **yfinance** - Market data
- **TradingView TA** - Technical analysis
- **matplotlib** - Chart generation
- **SQLite** - Database
- **pandas** - Data manipulation

## 📞 **Support**

For issues or feature requests, please check the error logs and ensure all dependencies are properly installed.

---

**⚠️ Disclaimer**: This bot is for educational purposes only. Not financial advice. Always do your own research before making investment decisions.
