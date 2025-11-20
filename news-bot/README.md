# Jack Of All News Bot

Automated Discord bot that pulls the most important article from our first‑party data sources, builds a JOAT‑style summary, generates a cinematic image, and posts to the `#news` channel every four hours.

## Capabilities

- Aggregates Alpha Vantage (primary), CryptoPanic, and Finnhub feeds with fallback logic
- Scores stories using sentiment, recency, ticker relevance, and source fidelity
- Uses GPT‑4.1‑mini to rewrite the article into the familiar **Summary / Breakdown / Impact** format
- Generates an image for each drop via `gpt-image-1` (DALL·E 3 successor)
- De‑duplicates headlines via `sent-history.json` so the same article is never reposted
- Graceful shutdown persists history and destroys the Discord client

## Setup

1. Copy `env.example.txt` to `.env` inside this directory and populate the values:
   ```bash
   cp env.example.txt .env
   ```
   Required keys:
   - `DISCORD_TOKEN` – bot token with access to the target server
   - `NEWS_CHANNEL_ID` – channel ID for posts
   - `OPENAI_API_KEY` – same project key we already use for other bots

   Optional but recommended (already provisioned in `website/.env`):
   - `ALPHA_VANTAGE_KEY`
   - `CRYPTO_PANIC_KEY`
   - `FINNHUB_API_KEY`

2. Install dependencies (already run once):
   ```bash
   npm install
   ```

3. Start the bot:
   ```bash
   npm start
   ```

On boot it immediately posts one article, then schedules every four hours (`0 */4 * * *`). Logs indicate which provider supplied the article.

## File structure

```
news-bot/
├─ index.js             # main bot logic
├─ package.json
├─ sent-history.json    # rotating cache of previously posted articles
├─ env.example.txt
└─ README.md
```

## Notes

- Image generation failures are tolerated; the article still ships without art.
- If no API keys are provided for optional feeds, we log a warning and continue with the remaining sources.
- History retains the last 150 hashes, so even restarts remain duplicate-free.

