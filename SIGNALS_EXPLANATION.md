# Signals Discrepancy Explanation

## Fixed: Prices Page Issue ✅
- **Problem**: Rate limiting (120 req/min) was too low
- **Solution**: Increased to 2000 req/min for production, 5000 for development
- **Result**: Prices page dialog now loads properly without getting stuck

---

## Why So Many Signals on Website vs Discord?

### The Root Cause

**Discord Bot Behavior:**
- Runs on a **10-minute loop** (`@tasks.loop(minutes=10)`)
- Every 10 minutes, it analyzes stocks and generates signals
- **Duplicate prevention**: Checks if a signal for the same symbol was sent in the last **120 minutes** (2 hours)
- Only sends signals to Discord channel if:
  1. No recent signal for that symbol (within 2 hours)
  2. The score meets threshold
  3. Bot has permissions in the channel

**Database Behavior:**
- Every signal is **saved to the database** via `self.db.add_signal()`
- The database call happens in `signals-bot/db.py` line 264-297
- After saving to database, it also **mirrors to the website** via HTTP POST to `/api/signals`
- **No duplicate checking** for database inserts - every analysis that meets threshold gets saved

### The Flow

```
Every 10 minutes:
1. Bot analyzes ~10-20 stocks
2. Scores them based on TradingView TA
3. Filters by score threshold
4. For each qualifying signal:
   a. Check if sent to Discord recently (2hr window) ← Discord only
   b. If not recent, send to Discord channel
   c. Save to database (always) ← No duplicate check
   d. Mirror to website API (always) ← No duplicate check
```

### Why This Happens

**Scenario:**
- Hour 1: BTC scores 15 → Sent to Discord ✅ + Saved to DB ✅
- Hour 1.5: BTC still scores 15 → NOT sent to Discord ❌ (duplicate prevention) + Saved to DB ✅
- Hour 2: BTC scores 16 → NOT sent to Discord ❌ (still within 2hr window) + Saved to DB ✅
- Hour 3: BTC scores 14 → Sent to Discord ✅ (2hr window expired) + Saved to DB ✅

**Result**: 4 signals in database/website, only 2 in Discord

### Why So Many Signals Are Generated

1. **Market volatility**: Prices change constantly
2. **TradingView TA updates**: Technical indicators recalculate every minute
3. **Threshold crossing**: A stock might cross the score threshold multiple times
4. **No cooldown for database**: While Discord has 2hr cooldown, database accepts every signal

### Current Settings

- **Loop interval**: 10 minutes (line 1861)
- **Duplicate check window**: 120 minutes (line 2306)
- **Analysis per loop**: ~10-20 symbols
- **Result**: Up to 6 signals per symbol per hour could be saved to DB, but only 1 sent to Discord every 2 hours

---

## Recommendations

### Option 1: Align Website with Discord (Fewer Signals)
Add duplicate checking before saving to database:
```python
# In db.py add_signal()
if self.has_recent_signal(symbol, minutes=120):
    logging.info(f"Skipping duplicate DB signal for {symbol}")
    return None
```

### Option 2: Show All in Discord (More Signals)
Remove or reduce the duplicate check window:
```python
# Change from 120 minutes to 30 minutes
if self.db.has_recent_signal(candidate['symbol'], minutes=30):
```

### Option 3: Better Signal Management
- Add a "Last sent to Discord" column
- Website shows all signals
- Discord only shows "important" ones (score > threshold)
- Users can see full history on website

### Option 4: Reduce Loop Frequency
Change from 10 minutes to 30-60 minutes:
```python
@tasks.loop(minutes=30)  # Instead of minutes=10
async def daily_signal_task(self) -> None:
```

---

## My Recommendation

**Keep current behavior but add clarity:**
1. Website = Full signal history (all analyses)
2. Discord = Curated highlights (filtered by cooldown)
3. Add a "Source" badge on website:
   - 🤖 "Auto-generated" - from bot analysis loop
   - 📢 "Posted to Discord" - actually sent to channel
4. Let users filter by source

This way:
- Power users see everything on the website
- Discord stays clean and focused
- No information loss
- Clear expectations

**To implement this**, we'd add a `posted_to_discord` boolean column and update the bot to set it when actually posting.

