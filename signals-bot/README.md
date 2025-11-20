## Jack Of All Signals

A Discord bot that posts one high-quality signal per market day using TradingView TA and yfinance price context.

### Features
- Scrapes candidate tickers (penny stock gainers) and scores them using TradingView TA across 5m/15m/1h/1d timeframes
- Fetches price context (current price, HOD, pivot levels) via yfinance
- Posts one formatted signal message per day at 6:40 AM US/Pacific
- Commands:
  - `!show_stocks` – show current scraped candidates
  - `!show_time` – show current US/Pacific time

### Setup
1. Python 3.10+
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create a `.env` file and set:
   - `DISCORD_TOKEN` - Your Discord bot token
   - `SIGNAL_CHANNEL_ID` - Channel for daily signals (6:40 AM Pacific)
   - `COMMAND_CHANNEL_ID` - Channel for bot commands and portfolio management
4. Run the bot:
   ```bash
   python main.py
   ```

### Notes
- Ensure the bot has permission to view and send messages in the target channel.
- TradingView TA may rate-limit; the bot spaces requests lightly.
- yfinance sometimes returns empty data for illiquid symbols; the bot falls back gracefully.

