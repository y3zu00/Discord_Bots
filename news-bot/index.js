require("dotenv").config();

const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const cron = require("node-cron");
const OpenAI = require("openai");
const axios = require("axios");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const relativeTime = require("dayjs/plugin/relativeTime");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { createCanvas } = require("@napi-rs/canvas");

dayjs.extend(utc);
dayjs.extend(relativeTime);

// ----------- Constants -----------
const HISTORY_FILE = path.join(__dirname, "sent-history.json");
const HISTORY_LIMIT = 150;
const HOT_TICKERS = new Set(["BTC", "ETH", "SOL", "NVDA", "TSLA", "AAPL", "SPX", "QQQ", "ES1!", "NQ1!", "ETHUSD"]);
const CRYPTO_TICKERS = new Set(["BTC", "ETH", "SOL", "ADA", "MATIC", "DOGE", "XRP", "LTC", "ARB", "AVAX", "DOT", "OP"]);
const INDEX_TICKERS = new Set(["SPX", "SPY", "QQQ", "NDX", "NQ1!", "ES1!", "DXY", "DJI", "RUT"]);
const MACRO_KEYWORDS = new Set(["FED", "OIL", "USD", "YIELD", "TREASURY", "INFLATION"]);
const DIRECTION_EMOJIS = {
  bullish: "🟢",
  bearish: "🔻",
  volatile: "⚠️",
  watch: "🛰️",
};
const rawNewsCronHours = parseInt(process.env.NEWS_CRON_HOURS || "12", 10);
const NEWS_CRON_HOURS = Number.isFinite(rawNewsCronHours) && rawNewsCronHours >= 1 && rawNewsCronHours <= 24
  ? rawNewsCronHours
  : 12;
const NEWS_CRON = `0 */${NEWS_CRON_HOURS} * * *`;
const MIN_NEWS_SCORE = 45;
const MIN_SUMMARY_LENGTH = 70;

const REQUIRED_ENV = ["DISCORD_TOKEN", "NEWS_CHANNEL_ID", "OPENAI_API_KEY"];
const optionalEnv = ["ALPHA_VANTAGE_KEY", "CRYPTO_PANIC_KEY", "CRYPTO_PANIC_KEYS", "FINNHUB_API_KEY"];
const ONE_SHOT = process.env.NEWS_BOT_EXIT_AFTER_POST === "1";

REQUIRED_ENV.forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const sentHistory = new Set();
let cycleInProgress = false;

// ----------- CryptoPanic key rotation -----------
// Allow multiple keys via CRYPTO_PANIC_KEYS (comma-separated) or a single CRYPTO_PANIC_KEY.
// If none are provided in env, fall back to the built-in keys supplied for this deployment.
const CRYPTO_PANIC_KEYS = (process.env.CRYPTO_PANIC_KEYS || process.env.CRYPTO_PANIC_KEY || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!CRYPTO_PANIC_KEYS.length) {
  CRYPTO_PANIC_KEYS.push(
    "3330343f1514e6a6b8604e77eb60ac4dc3ef3e29",
    "b246a97bcbad9d123ad6ceec3f3727cb3a7ab9cd",
    "696bdb7ad7620fa094c7745bc3009fd495d0635c",
    "b5ca1becede911bfae17e3158f4298f5c763566f",
    "78ed2dc9b32bf680f6d5546df5debe7e8faf55d5"
  );
}

let cryptoPanicKeyIndex = 0;
function nextCryptoPanicKey() {
  if (!CRYPTO_PANIC_KEYS.length) return null;
  const key = CRYPTO_PANIC_KEYS[cryptoPanicKeyIndex];
  cryptoPanicKeyIndex = (cryptoPanicKeyIndex + 1) % CRYPTO_PANIC_KEYS.length;
  return key;
}

async function ensureHistoryFile() {
  try {
    await fs.access(HISTORY_FILE);
  } catch {
    await fs.writeFile(HISTORY_FILE, JSON.stringify([]), "utf8");
  }
}

async function loadHistory() {
  await ensureHistoryFile();
  try {
    const raw = await fs.readFile(HISTORY_FILE, "utf8");
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      arr.forEach((id) => sentHistory.add(id));
    }
    console.log(`📚 Loaded ${sentHistory.size} previously sent articles.`);
  } catch (err) {
    console.warn("⚠️ Failed to load history file:", err.message);
  }
}

async function persistHistory() {
  const entries = Array.from(sentHistory).slice(-HISTORY_LIMIT);
  await fs.writeFile(HISTORY_FILE, JSON.stringify(entries, null, 2));
}

function canonicalizeUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    url.search = "";
    let pathname = url.pathname || "/";
    pathname = pathname.replace(/\/+$/, "");
    if (!pathname) pathname = "/";
    return `${url.hostname.toLowerCase()}${pathname.toLowerCase()}`;
  } catch {
    return rawUrl.replace(/\?.*$/, "").replace(/\/+$/, "").toLowerCase();
  }
}

function articleHash(article) {
  const canonical = canonicalizeUrl(article.url);
  if (canonical) {
    return crypto.createHash("sha1").update(canonical).digest("hex");
  }
  const published = dayjs(article.publishedAt).isValid()
    ? dayjs(article.publishedAt).format("YYYY-MM-DD")
    : dayjs().format("YYYY-MM-DD");
  const fallback = `${(article.title || "").toLowerCase().trim()}|${(article.source || "")
    .toLowerCase()
    .trim()}|${published}`;
  return crypto.createHash("sha1").update(fallback).digest("hex");
}

function legacyArticleHashes(article) {
  const hashes = [];
  if (article.url) {
    hashes.push(crypto.createHash("sha1").update(article.url).digest("hex"));
  }
  const fallback = `${article.title || ""}-${article.publishedAt || ""}`;
  hashes.push(crypto.createHash("sha1").update(fallback).digest("hex"));
  return hashes;
}

function hasBeenSent(article) {
  if (!article) return false;
  if (article.id && sentHistory.has(article.id)) return true;
  return legacyArticleHashes(article).some((hash) => sentHistory.has(hash));
}

function rememberArticle(article) {
  if (!article) return;
  if (article.id) {
    sentHistory.add(article.id);
  }
  legacyArticleHashes(article).forEach((hash) => sentHistory.add(hash));
  if (sentHistory.size > HISTORY_LIMIT * 1.5) {
    const trimmed = Array.from(sentHistory).slice(-HISTORY_LIMIT);
    sentHistory.clear();
    trimmed.forEach((id) => sentHistory.add(id));
  }
}

function parseDate(input) {
  if (!input) return dayjs.utc();
  if (typeof input === "string" && /^\d{8}T\d{6}$/.test(input)) {
    const parsed = dayjs.utc(input, "YYYYMMDDTHHmmss");
    if (parsed.isValid()) return parsed;
  }
  const fallback = dayjs.utc(input);
  return fallback.isValid() ? fallback : dayjs.utc();
}

function normalizeArticle(base) {
  const publishedAt = parseDate(base.publishedAt);
  const id = articleHash(base);
  return {
    ...base,
    id,
    publishedAt: publishedAt.toISOString(),
  };
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  if (!text) return y;
  const words = text.split(/\s+/);
  let line = "";
  let lines = 0;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
      lines += 1;
      if (lines >= maxLines - 1) {
        ctx.fillText(`${line}…`, x, y);
        return y + lineHeight;
      }
    } else {
      line = candidate;
    }
  }

  if (line) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }

  return y;
}

function drawRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function pickPalette(article) {
  const palettes = [
    { start: "#0f172a", end: "#1d4ed8", glow: "#38bdf8" },
    { start: "#1f1c2c", end: "#928dab", glow: "#f472b6" },
    { start: "#111827", end: "#9333ea", glow: "#c084fc" },
    { start: "#0f2027", end: "#203a43", glow: "#64ffda" },
  ];
  const seed = article.id
    ? parseInt(article.id.slice(0, 6), 16)
    : Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  return palettes[seed % palettes.length];
}

function buildFallbackImage(article) {
  try {
    const width = 1024;
    const height = 512;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    const palette = pickPalette(article);

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, palette.start);
    gradient.addColorStop(1, palette.end);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 4; i++) {
      const radius = 220 + i * 60;
      ctx.beginPath();
      ctx.fillStyle = i % 2 === 0 ? palette.glow : "rgba(255,255,255,0.08)";
      ctx.arc(width - 120 - i * 30, 120 + i * 30, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(60 + i * 120, height - 180 - i * 12, 45, 180 + i * 12);
    }

    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 2000; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#F9FAFB";
    ctx.font = "600 54px 'Segoe UI', 'Inter', sans-serif";
    let y = 150;
    y = wrapText(ctx, article.title || "Market Intelligence Update", 80, y, width - 160, 60, 2);

    ctx.fillStyle = "rgba(248, 250, 252, 0.92)";
    ctx.font = "28px 'Segoe UI', 'Inter', sans-serif";
    const blurb =
      (article.summary && article.summary.slice(0, 260)) ||
      "High-signal institutional moves, macro catalysts, and trading opportunities delivered by Jack Of All News.";
    y = wrapText(ctx, blurb, 80, y + 30, width - 160, 42, 4);

    const tickers = (article.tickers || []).slice(0, 3);
    if (tickers.length) {
      tickers.forEach((ticker, idx) => {
        const badgeX = 80 + idx * 140;
        const badgeY = height - 120;
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        drawRoundRect(ctx, badgeX, badgeY, 110, 34, 17);
        ctx.fill();
        ctx.fillStyle = "#F9FAFB";
        ctx.font = "600 20px 'Segoe UI', 'Inter', sans-serif";
        ctx.fillText(ticker, badgeX + 20, badgeY + 24);
      });
    }

    ctx.fillStyle = "rgba(248,248,255,0.85)";
    ctx.font = "24px 'Segoe UI', 'Inter', sans-serif";
    const meta = `${article.source || "Live desk"} • ${dayjs(article.publishedAt).format("MMM D, h:mm A")} • ${
      tickers.join(" · ") || "Global Markets"
    }`;
    ctx.fillText(meta, 80, height - 60);

    return canvas.toBuffer("image/png");
  } catch (err) {
    console.warn("⚠️ Fallback image generation failed:", err.message);
    return null;
  }
}

async function fetchAlphaNews() {
  const key = process.env.ALPHA_VANTAGE_KEY;
  if (!key) return [];
  try {
    const { data } = await axios.get("https://www.alphavantage.co/query", {
      params: {
        function: "NEWS_SENTIMENT",
        topics: "finance,crypto",
        sort: "LATEST",
        limit: 40,
        time_from: dayjs.utc().subtract(2, "day").format("YYYYMMDDTHHmmss"),
        apikey: key,
      },
      timeout: 10000,
    });
    const feed = Array.isArray(data?.feed) ? data.feed : [];
    return feed.map((item) =>
      normalizeArticle({
        title: item.title,
        summary: item.summary || item.overall_sentiment_label || "",
        url: item.url,
        source: item.source || "Alpha Vantage",
        publishedAt: item.time_published,
        tickers: item.ticker_sentiment?.map((t) => t.ticker?.toUpperCase()).filter(Boolean) || [],
        provider: "alphavantage",
        metrics: {
          overallScore: Number(item.overall_sentiment_score) || 0,
          overallLabel: item.overall_sentiment_label || "",
          relevance: Number(item.relevance_score) || 0,
          tickerScores:
            item.ticker_sentiment?.map((t) => ({
              ticker: t.ticker?.toUpperCase(),
              relevance: Number(t.relevance_score) || 0,
              sentiment: Number(t.ticker_sentiment_score) || 0,
            })) || [],
        },
      })
    );
  } catch (err) {
    console.warn("⚠️ Alpha Vantage news failed:", err.message);
    return [];
  }
}

async function fetchCryptoPanicNews() {
  // Rotate through all available CryptoPanic keys and try each once.
  if (!CRYPTO_PANIC_KEYS.length) return [];

  for (let attempt = 0; attempt < CRYPTO_PANIC_KEYS.length; attempt++) {
    const key = nextCryptoPanicKey();
    if (!key) break;

    try {
      const { data } = await axios.get("https://cryptopanic.com/api/v1/posts/", {
        params: {
          auth_token: key,
          public: "true",
          kind: "news",
          currencies: "BTC,ETH,SOL,ADA,MATIC",
          filter: "important",
          regions: "en",
        },
        timeout: 10000,
      });
      const results = Array.isArray(data?.results) ? data.results : [];
      return results.map((post) =>
        normalizeArticle({
          title: post.title || "CryptoPanic headline",
          summary: post.description || post.metadata?.description || "",
          url: post.url || (post.id ? `https://cryptopanic.com/news/${post.id}` : undefined),
          source: post.source?.title || post.domain || "CryptoPanic",
          publishedAt: post.published_at,
          tickers: post.currencies?.map((c) => c.code?.toUpperCase()).filter(Boolean) || [],
          provider: "cryptopanic",
          metrics: {
            overallScore: (post.votes?.important || 0) / 10,
            relevance: post.kind === "news" ? 0.5 : 0.2,
            tickerScores: [],
          },
        })
      );
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.message || String(err);
      const tail = typeof key === "string" && key.length >= 4 ? key.slice(-4) : "****";
      console.warn(`⚠️ CryptoPanic news failed with key ****${tail} (status ${status ?? "n/a"}):`, msg);
      // Try the next key on any failure.
      continue;
    }
  }

  console.warn("⚠️ All CryptoPanic keys failed; skipping CryptoPanic feed this cycle.");
  return [];
}

async function fetchFinnhubNews() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return [];
  try {
    const url = "https://finnhub.io/api/v1/news";
    const params = { category: "general", token: key };
    const [{ data: general }, { data: crypto }] = await Promise.all([
      axios.get(url, { params, timeout: 10000 }),
      axios.get(url, { params: { category: "crypto", token: key }, timeout: 10000 }),
    ]);
    const combined = []
      .concat(Array.isArray(general) ? general : [])
      .concat(Array.isArray(crypto) ? crypto : []);
    return combined.map((item) =>
      normalizeArticle({
        title: item.headline,
        summary: item.summary || "",
        url: item.url,
        source: item.source || "Finnhub",
        publishedAt: item.datetime ? dayjs.unix(item.datetime).toISOString() : undefined,
        tickers:
          typeof item.related === "string" && item.related.length
            ? item.related.split(",").map((t) => t.trim().toUpperCase())
            : [],
        provider: "finnhub",
        metrics: {
          overallScore: Number(item.sentiment) || 0,
          relevance: item.category === "crypto" ? 0.6 : 0.4,
          tickerScores: [],
        },
      })
    );
  } catch (err) {
    console.warn("⚠️ Finnhub news failed:", err.message);
    return [];
  }
}

function scoreArticle(article) {
  const published = dayjs(article.publishedAt);
  const hoursAgo = Math.max(0, dayjs().diff(published, "hour", true));
  const recencyScore = Math.max(0, 36 - hoursAgo * 2);
  const sentimentScore = Math.min(50, Math.abs(article?.metrics?.overallScore || 0) * 40);
  const relevanceScore = Math.min(40, (article?.metrics?.relevance || 0) * 40);
  const tickerBoost = article.tickers.some((t) => HOT_TICKERS.has(t)) ? 12 : 0;
  const providerBoost = article.provider === "alphavantage" ? 5 : 0;
  const summaryQuality = article.summary?.length > 140 ? 6 : 0;
  return recencyScore + sentimentScore + relevanceScore + tickerBoost + providerBoost + summaryQuality;
}

function isMeaningful(article) {
  const summary = (article.summary || "").trim();
  const lengthOk = summary.length >= MIN_SUMMARY_LENGTH;
  const tickerHit = (article.tickers || []).some((t) => HOT_TICKERS.has(t));
  const keywordHit = /institution|whale|federal|sec|bridge|upgrade|liquidity|options|inflation|defi|etf/i.test(
    `${article.title} ${summary}`
  );
  const providerHit = ["alphavantage", "finnhub"].includes(article.provider) || /cointelegraph|reuters|coindesk/i.test(article.source || "");
  return lengthOk && (tickerHit || keywordHit || providerHit);
}

async function pickTopArticle() {
  const [alpha, cryptoNews, finnhub] = await Promise.all([fetchAlphaNews(), fetchCryptoPanicNews(), fetchFinnhubNews()]);
  const combined = [...alpha, ...cryptoNews, ...finnhub];
  if (!combined.length) {
    console.warn("⚠️ No news candidates available.");
    return null;
  }
  const unique = [];
  const seen = new Set();
  for (const article of combined) {
    if (!article.title) continue;
    const key = `${article.title}-${article.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(article);
  }
  unique.sort((a, b) => scoreArticle(b) - scoreArticle(a));
  const plausible = unique.filter((article) => scoreArticle(article) >= MIN_NEWS_SCORE && isMeaningful(article));
  const pool = plausible.length ? plausible : unique;
  const choice = pool.find((article) => !hasBeenSent(article));
  if (!choice && pool.length) {
    console.log("⚠️ All candidate articles already sent. Reusing top-scoring article:", pool[0].title);
  }
  return choice || pool[0];
}

function classifyTicker(ticker = "") {
  const clean = ticker.replace(/[^A-Z0-9!]/gi, "").toUpperCase();
  if (!clean) return "asset";
  if (CRYPTO_TICKERS.has(clean) || clean.endsWith("USD") || clean.endsWith("USDT")) return "crypto";
  if (INDEX_TICKERS.has(clean)) return "index";
  if (MACRO_KEYWORDS.has(clean)) return "macro";
  if (/^[A-Z]{1,5}$/.test(clean)) return "stock";
  if (clean.includes("!")) return "futures";
  return "asset";
}

function sanitizeGuidancePayload(raw, allowedAssets) {
  const guidance = raw && typeof raw === "object" ? raw : {};
  const impactItems = Array.isArray(guidance.impactItems) ? guidance.impactItems : [];
  const tradeAngles = Array.isArray(guidance.tradeAngles) ? guidance.tradeAngles : [];
  const riskWatch = Array.isArray(guidance.riskWatch) ? guidance.riskWatch : [];

  const allowedSet = new Set(allowedAssets.map((asset) => asset.asset));

  const safeImpact = impactItems
    .filter((item) => item && (allowedSet.has(item.asset) || item.type === "macro"))
    .map((item) => ({
      asset: item.asset,
      type: item.type || "asset",
      direction: ["bullish", "bearish", "volatile", "watch"].includes((item.direction || "").toLowerCase())
        ? item.direction.toLowerCase()
        : "watch",
      reason: (item.reason || "").slice(0, 220),
      confidence: ["low", "medium", "high"].includes((item.confidence || "").toLowerCase())
        ? item.confidence.toLowerCase()
        : "medium",
    }))
    .slice(0, 4);

  const safeAngles = tradeAngles
    .map((angle) => ({
      title: (angle?.title || "").slice(0, 60),
      detail: (angle?.detail || "").slice(0, 220),
    }))
    .filter((angle) => angle.title && angle.detail)
    .slice(0, 3);

  const safeRisks = riskWatch
    .map((entry) => entry && String(entry).slice(0, 200))
    .filter(Boolean)
    .slice(0, 3);

  return {
    impactItems: safeImpact,
    tradeAngles: safeAngles,
    riskWatch: safeRisks,
  };
}

async function generateSummary(article) {
  const prompt = `
You are the Jack Of All Trades newsroom AI.
Craft a punchy Discord-ready update using the sections: Summary, Breakdown, Impact.
Keep each section to 1-2 sentences. Highlight why traders should care.

Metadata:
- Title: ${article.title}
- Source: ${article.source}
- Link: ${article.url}
- Published: ${article.publishedAt}
- Primary tickers: ${(article.tickers || []).join(", ") || "n/a"}
- Raw summary: ${article.summary || "None"}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300,
    temperature: 0.7,
  });

  const text = response.choices[0]?.message?.content?.trim();
  if (!text) return "Summary unavailable.";
  return text;
}

async function generateImpactGuidance(article) {
  const tickers = (article.tickers || []).slice(0, 8);
  const allowedAssets = tickers.map((ticker) => ({
    asset: ticker.toUpperCase(),
    type: classifyTicker(ticker),
  }));

  const assetDescriptor =
    allowedAssets.length > 0
      ? allowedAssets.map((item) => `${item.asset} (${item.type})`).join(", ")
      : "No explicit tickers. You may reference Macro themes (e.g., US Equities, Crypto majors).";

  const prompt = `
You are the Jack Of All Trades impact analyst.
Base every statement strictly on the article details below. Do not invent companies, tickers, or catalysts.
Allowed assets: ${assetDescriptor}

Respond ONLY with JSON using this schema:
{
  "impactItems": [
    { "asset": "ticker or macro label", "type": "stock|crypto|index|macro|futures|asset", "direction": "bullish|bearish|volatile|watch", "reason": "why it moves", "confidence": "low|medium|high" }
  ],
  "tradeAngles": [
    { "title": "short label", "detail": "actionable idea tied to catalysts" }
  ],
  "riskWatch": ["short caution notes tied to the news"]
}

If data is thin, prefer macro labels like "US Equities" or "Crypto majors" but never contradict the article.

Article:
- Title: ${article.title}
- Summary: ${article.summary || "n/a"}
- Source: ${article.source}
- Published: ${article.publishedAt}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
      temperature: 0.35,
    });
    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return sanitizeGuidancePayload({}, allowedAssets);
    const parsed = JSON.parse(content);
    return sanitizeGuidancePayload(parsed, allowedAssets.length ? allowedAssets : [{ asset: "Macro", type: "macro" }]);
  } catch (err) {
    console.warn("⚠️ Impact guidance generation failed:", err.message);
    return sanitizeGuidancePayload({}, allowedAssets.length ? allowedAssets : [{ asset: "Macro", type: "macro" }]);
  }
}

async function generateImage(article) {
  const prompt = `Create a cinematic, professional news card inspired by: "${article.title}". 
Focus on modern gradients, subtle trading motifs, and no text. Palette should match night trading desks.`;

  const models = ["gpt-image-1", "dall-e-3", "dall-e-2"];
  for (const model of models) {
    try {
      const image = await openai.images.generate({
        model,
        prompt,
        size: "1024x1024",
      });
      const base64 = image.data?.[0]?.b64_json;
      if (base64) {
        return Buffer.from(base64, "base64");
      }
    } catch (err) {
      console.warn(`⚠️ Image generation failed on ${model}:`, err?.message || err);
    }
  }
  return buildFallbackImage(article);
}

async function sendNewsUpdate(trigger) {
  if (cycleInProgress) {
    console.log("⏳ News cycle already running, skipping.");
    return;
  }
  cycleInProgress = true;
  try {
    const channel = await client.channels.fetch(process.env.NEWS_CHANNEL_ID);
    if (!channel) {
      throw new Error("News channel not found. Check NEWS_CHANNEL_ID.");
    }

    const article = await pickTopArticle();
    if (!article) {
      await channel.send("⚠️ Unable to fetch news right now.");
      return;
    }

    const summary = await generateSummary(article);
    const guidance = await generateImpactGuidance(article);
    const imageBuffer = await generateImage(article).catch((err) => {
      console.warn("⚠️ Image generation failed:", err.message);
      return null;
    });

    const embed = new EmbedBuilder()
      .setColor("#FFC857")
      .setTitle(article.title)
      .setURL(article.url || null)
      .setDescription(summary)
      .addFields(
        ...(article.tickers?.length
          ? [{ name: "Tickers", value: article.tickers.slice(0, 6).join(" • "), inline: true }]
          : []),
        { name: "Source", value: article.source || "Unknown", inline: true },
        { name: "Published", value: dayjs(article.publishedAt).fromNow(), inline: true }
      )
      .setFooter({ text: `Signal via ${article.provider || "feed"}` })
      .setTimestamp(new Date(article.publishedAt));

    const impactLines =
      guidance.impactItems.length > 0
        ? guidance.impactItems
            .map((item) => {
              const emoji = DIRECTION_EMOJIS[item.direction] || "🛰️";
              return `${emoji} ${item.asset} (${item.type}) — ${item.reason} (${item.confidence})`;
            })
            .join("\n")
        : "Assessing impact...";
    embed.addFields({
      name: "Impact Radar",
      value: impactLines.slice(0, 1024),
    });

    if (guidance.tradeAngles.length) {
      const playbook = guidance.tradeAngles
        .map((angle) => `• ${angle.title}: ${angle.detail}`)
        .join("\n")
        .slice(0, 1024);
      embed.addFields({
        name: "Playbook",
        value: playbook,
      });
    }

    if (guidance.riskWatch.length) {
      const risk = guidance.riskWatch.map((entry) => `• ${entry}`).join("\n").slice(0, 1024);
      embed.addFields({
        name: "Risk Watch",
        value: risk,
        inline: false,
      });
    }

    const files = [];
    if (imageBuffer) {
      files.push(new AttachmentBuilder(imageBuffer, { name: "joat-news.png" }));
      embed.setImage("attachment://joat-news.png");
    }

    await channel.send({
      content: "**News**",
      embeds: [embed],
      files,
    });

    rememberArticle(article);
    await persistHistory();
    console.log(`✅ Posted news: ${article.title}`);
  } catch (err) {
    console.error("❌ Failed to send news update:", err);
  } finally {
    cycleInProgress = false;
  }
}

client.once("ready", async () => {
  console.log(`📰 Logged in as ${client.user.tag}`);
  optionalEnv.forEach((key) => {
    if (!process.env[key]) {
      console.warn(`⚠️ Optional key ${key} not provided; related feed will be skipped.`);
    }
  });

  await loadHistory();
  console.log(`🕒 News cycle configured every ${NEWS_CRON_HOURS}h via cron "${NEWS_CRON}".`);
  await sendNewsUpdate("startup");

  if (ONE_SHOT) {
    await gracefulShutdown("oneshot");
    return;
  }

  cron.schedule(NEWS_CRON, () => {
    sendNewsUpdate("schedule");
  });
});

client.login(process.env.DISCORD_TOKEN);

async function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Shutting down news bot...`);
  try {
    await persistHistory();
    client.destroy();
  } finally {
    process.exit(0);
  }
}

["SIGINT", "SIGTERM"].forEach((sig) => {
  process.on(sig, () => gracefulShutdown(sig));
});

