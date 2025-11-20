// ESM version
import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket as WSClient } from 'ws';
import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';
import { getCompanyKnowledge } from './company-knowledge.js';

const app = express();
// Capture raw body for webhook verification
app.use(express.json({ verify: (req, res, buf) => { try { req.rawBody = buf; } catch {} } }));
app.use(cookieParser());

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI = 'http://localhost:8787/api/auth/discord/callback',
  SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret',
  WHOP_API_KEY,
  FRONTEND_URL = 'http://localhost:8080',
  ALPHA_VANTAGE_KEY,
  CRYPTO_PANIC_KEY,
  FINNHUB_API_KEY,
} = process.env;

const DISCORD_FEEDBACK_WEBHOOK = process.env.DISCORD_FEEDBACK_WEBHOOK_URL || process.env.DISCORD_FEEDBACK_WEBHOOK;

const COOKIE_SECURE = (process.env.NODE_ENV || 'development') !== 'development';

// Neon SQL helper
function getNeonSql() {
  try {
    if (!process.env.DATABASE_URL) return null;
    return neon(process.env.DATABASE_URL);
  } catch {
    return null;
  }
}
// ----------------------------
// Announcements (admin → notifications)
// ----------------------------
async function ensureAnnouncements(sql) {
  await sql`CREATE TABLE IF NOT EXISTS announcements (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    audience TEXT DEFAULT 'all'
  )`;
}

app.get('/api/announcements', async (req, res) => {
  try {
    const sql = getNeonSql(); if (!sql) return res.json({ ok: true, items: [] });
    await ensureAnnouncements(sql);
    const rows = await sql`SELECT id, title, body, created_at, audience FROM announcements ORDER BY created_at DESC LIMIT 100`;
    return res.json({ ok: true, items: rows });
  } catch (e) { return res.json({ ok: true, items: [] }); }
});

app.post('/api/announcements', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u || !u.isAdmin) return res.status(403).json({ ok: false, error: 'forbidden' });
    const { title, body, audience } = req.body || {};
    if (!title) return res.status(400).json({ ok: false, error: 'missing_title' });
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    await ensureAnnouncements(sql);
    const rows = await sql`INSERT INTO announcements (title, body, audience) VALUES (${title}, ${body ?? ''}, ${audience ?? 'all'}) RETURNING id, title, body, created_at, audience`;
    return res.json({ ok: true, item: rows?.[0] });
  } catch (e) { return res.status(500).json({ ok: false, error: e?.message || 'err' }); }
});

app.delete('/api/announcements/:id', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u || !u.isAdmin) return res.status(403).json({ ok: false, error: 'forbidden' });
    const id = Number(req.params.id);
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    await sql`DELETE FROM announcements WHERE id=${id}`;
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ ok: false, error: e?.message || 'err' }); }
});

// ----------------------------
// Admin: users management
// ----------------------------
app.get('/api/admin/users', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u || !u.isAdmin) return res.status(403).json({ ok: false, error: 'forbidden' });
    const sql = getNeonSql(); if (!sql) return res.json({ ok: true, items: [] });
    await ensureUsers(sql);
    const rows = await sql`SELECT discord_id, username, plan, is_admin, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT 200`;
    return res.json({ ok: true, items: rows });
  } catch (e) { return res.json({ ok: true, items: [] }); }
});

app.patch('/api/admin/users/:discordId', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u || !u.isAdmin) return res.status(403).json({ ok: false, error: 'forbidden' });
    const id = String(req.params.discordId);
    const { isAdmin, plan, username } = req.body || {};
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    await ensureUsers(sql);
    await sql`INSERT INTO users (discord_id, username, plan, is_admin)
              VALUES (${id}, ${username ?? null}, ${plan ?? 'Free'}, ${isAdmin ?? false})
              ON CONFLICT (discord_id) DO UPDATE SET
                username = COALESCE(${username}, users.username),
                plan = COALESCE(${plan}, users.plan),
                is_admin = COALESCE(${isAdmin}, users.is_admin),
                updated_at = now()`;
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ ok: false, error: e?.message || 'err' }); }
});

// Ensure core tables exist
async function ensureUsers(sql) {
  await sql`CREATE TABLE IF NOT EXISTS users (
    discord_id TEXT PRIMARY KEY,
    username TEXT,
    plan TEXT,
    is_admin BOOLEAN DEFAULT false,
    preferences JSONB DEFAULT '{}'::jsonb,
    trial_started_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    trial_used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`;
  // Backfill column for existing deployments
  try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb`; } catch {}
  try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ`; } catch {}
  try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ`; } catch {}
  try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT false`; } catch {}
}
async function ensureWatchlist(sql) {
  await sql`CREATE TABLE IF NOT EXISTS watchlist (
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, symbol)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist (user_id, position)`;
  try { await sql`ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS asset_type TEXT`; } catch {}
  try { await sql`ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS display_symbol TEXT`; } catch {}
  try { await sql`ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS display_name TEXT`; } catch {}
}
async function ensureAlerts(sql) {
  await sql`CREATE TABLE IF NOT EXISTS alerts (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL,
    direction TEXT NOT NULL,
    threshold NUMERIC,
    window_tf TEXT,
    cooldown TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_triggered_at TIMESTAMPTZ
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts (user_id, symbol)`;
  try { await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS asset_type TEXT`; } catch {}
  try { await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS display_symbol TEXT`; } catch {}
  try { await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS display_name TEXT`; } catch {}
  try { await sql`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ`; } catch {}
}
async function ensurePortfolio(sql) {
  await sql`CREATE TABLE IF NOT EXISTS portfolio_positions (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    quantity NUMERIC,
    cost_basis NUMERIC,
    target_price NUMERIC,
    risk TEXT,
    timeframe TEXT,
    notes TEXT,
    confidence NUMERIC,
    strategy TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio_positions (user_id, symbol)`;
  try { await sql`ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS target_price NUMERIC`; } catch {}
  try { await sql`ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS risk TEXT`; } catch {}
  try { await sql`ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS timeframe TEXT`; } catch {}
  try { await sql`ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()`; } catch {}
  try { await sql`ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS confidence NUMERIC`; } catch {}
  try { await sql`ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS strategy TEXT`; } catch {}
  try { await sql`ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ`; } catch {}
  try { await sql`ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS exit_price NUMERIC`; } catch {}
  try { await sql`ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS pnl NUMERIC`; } catch {}
  try { await sql`ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS last_notified_pnl NUMERIC`; } catch {}
}
async function ensureUserProfile(sql) {
  await sql`CREATE TABLE IF NOT EXISTS user_profile (
    user_id TEXT PRIMARY KEY,
    skill_level TEXT,
    risk_appetite TEXT,
    focus TEXT,
    trading_style TEXT,
    goals TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
  )`;
  try { await sql`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS username TEXT`; } catch {}
  try { await sql`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS trading_experience TEXT`; } catch {}
  try { await sql`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS preferred_timeframe TEXT`; } catch {}
  try { await sql`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS risk_tolerance TEXT`; } catch {}
  try { await sql`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS learning_goals TEXT`; } catch {}
  try { await sql`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT now()`; } catch {}
}
async function ensureMentorFeedback(sql) {
  await sql`CREATE TABLE IF NOT EXISTS mentor_feedback (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT,
    plan TEXT,
    message_id TEXT NOT NULL,
    reaction TEXT NOT NULL CHECK (reaction IN ('like','dislike')),
    response TEXT NOT NULL,
    prompt TEXT,
    mode TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS mentor_feedback_user_message_idx ON mentor_feedback (user_id, message_id)`;
  try { await sql`ALTER TABLE mentor_feedback ADD COLUMN IF NOT EXISTS prompt TEXT`; } catch {}
  try { await sql`ALTER TABLE mentor_feedback ADD COLUMN IF NOT EXISTS mode TEXT`; } catch {}
  try { await sql`ALTER TABLE mentor_feedback ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()`; } catch {}
}

async function ensureUserFeedback(sql) {
  await sql`CREATE TABLE IF NOT EXISTS user_feedback (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT,
    plan TEXT,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    repro_steps TEXT,
    attachment_url TEXT,
    include_diagnostics BOOLEAN DEFAULT false,
    allow_contact BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'new',
    resolution_notes TEXT,
    admin_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS user_feedback_user_idx ON user_feedback (user_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS user_feedback_status_idx ON user_feedback (status)`;
  try { await sql`ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS allow_contact BOOLEAN DEFAULT true`; } catch {}
  try { await sql`ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS admin_id TEXT`; } catch {}
  try { await sql`ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS resolution_notes TEXT`; } catch {}
}

async function ensureMentorChatHistory(sql) {
  await sql`CREATE TABLE IF NOT EXISTS mentor_chat_history (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
    content TEXT NOT NULL,
    mode TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS mentor_chat_history_user_msg_idx ON mentor_chat_history (user_id, message_id)`;
  await sql`CREATE INDEX IF NOT EXISTS mentor_chat_history_user_created_idx ON mentor_chat_history (user_id, created_at)`;
}

async function ensureSignalSubscriptions(sql) {
  await sql`CREATE TABLE IF NOT EXISTS signal_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, symbol)
  )`;
}

async function ensureQuestionResponses(sql) {
  await sql`CREATE TABLE IF NOT EXISTS question_responses (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    question_id BIGINT NOT NULL,
    selected_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    response_time TIMESTAMPTZ DEFAULT now(),
    response_delay_seconds INTEGER,
    UNIQUE(user_id, question_id)
  )`;
}

async function ensureLearningProgress(sql) {
  await sql`CREATE TABLE IF NOT EXISTS learning_progress (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    module_name TEXT NOT NULL,
    completion_percentage INTEGER DEFAULT 0,
    time_spent_minutes INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ DEFAULT now(),
    quiz_scores TEXT DEFAULT '[]',
    UNIQUE(user_id, module_name)
  )`;
}

async function deleteUserData(sql, discordId) {
  if (!sql || !discordId) return;
  const userId = String(discordId);

  const run = async (label, promiseFactory) => {
    try {
      await promiseFactory();
    } catch (err) {
      console.warn(`[AccountDelete] ${label} cleanup failed:`, err?.message || err);
    }
  };

  await run('alerts', () => ensureAlerts(sql));
  await run('watchlist', () => ensureWatchlist(sql));
  await run('portfolio', () => ensurePortfolio(sql));
  await run('user_profile', () => ensureUserProfile(sql));
  await run('mentor_feedback', () => ensureMentorFeedback(sql));
  await run('user_feedback', () => ensureUserFeedback(sql));
  await run('mentor_chat_history', () => ensureMentorChatHistory(sql));
  await run('signal_subscriptions', () => ensureSignalSubscriptions(sql));
  await run('question_responses', () => ensureQuestionResponses(sql));
  await run('learning_progress', () => ensureLearningProgress(sql));

  const deletions = [
    ['user_feedback', () => sql`DELETE FROM user_feedback WHERE user_id=${userId}`],
    ['mentor_feedback', () => sql`DELETE FROM mentor_feedback WHERE user_id=${userId}`],
    ['alerts', () => sql`DELETE FROM alerts WHERE user_id=${userId}`],
    ['watchlist', () => sql`DELETE FROM watchlist WHERE user_id=${userId}`],
    ['portfolio_positions', () => sql`DELETE FROM portfolio_positions WHERE user_id=${userId}`],
    ['user_profile', () => sql`DELETE FROM user_profile WHERE user_id=${userId}`],
    ['question_responses', () => sql`DELETE FROM question_responses WHERE user_id=${userId}`],
    ['learning_progress', () => sql`DELETE FROM learning_progress WHERE user_id=${userId}`],
    ['mentor_chat_history', () => sql`DELETE FROM mentor_chat_history WHERE user_id=${userId}`],
    ['signal_subscriptions', () => sql`DELETE FROM signal_subscriptions WHERE user_id=${userId}`],
  ];

  for (const [label, factory] of deletions) {
    await run(label, factory);
  }

  await run('users', () => sql`DELETE FROM users WHERE discord_id=${userId}`);
}

async function sendDiscordFeedbackMessage({ title, description, severity, url }) {
  if (!DISCORD_FEEDBACK_WEBHOOK) return;
  try {
    await fetch(DISCORD_FEEDBACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: title?.slice(0, 240) || 'New Feedback',
            description: description?.slice(0, 3900) || 'New submission',
            color: severity === 'critical' ? 0xdb2777 : severity === 'high' ? 0xf97316 : severity === 'medium' ? 0xfacc15 : 0x22c55e,
            fields: url ? [{ name: 'View in Admin', value: url }] : undefined,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (err) {
    console.warn('[Feedback] Discord webhook failed:', err?.message || err);
  }
}

async function sendDiscordDM(discordId, content) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token || !discordId || !content) return false;
  try {
    const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient_id: String(discordId) }),
    });
    if (!dmRes.ok) {
      const text = await dmRes.text().catch(() => '');
      throw new Error(`create channel failed (${dmRes.status}): ${text}`);
    }
    const dm = await dmRes.json();
    if (!dm?.id) throw new Error('Missing DM channel id');
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });
    if (!msgRes.ok) {
      const text = await msgRes.text().catch(() => '');
      throw new Error(`send message failed (${msgRes.status}): ${text}`);
    }
    return true;
  } catch (err) {
    console.warn('[AccountDelete] discord DM failed:', err?.message || err);
    return false;
  }
}

function getSessionUser(req) {
  const sess = parseSession(req);
  if (!sess || !sess.discordId) return null;
  return { userId: sess.discordId, username: sess.username, plan: sess.plan, isAdmin: !!sess.isAdmin };
}

function setSessionCookie(res, payload) {
  // Prevent double-exp/iat when re-signing decoded JWT payloads
  const { exp, iat, nbf, ...clean } = payload || {};
  const token = jwt.sign(clean, SESSION_SECRET, { expiresIn: '7d' });
  res.cookie('joat_session', token, {
    httpOnly: true,
    sameSite: COOKIE_SECURE ? 'strict' : 'lax',
    secure: COOKIE_SECURE,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// ----------------------------
// Persistent cache (JSON on disk) & rate limit
// ----------------------------
const cacheMem = new Map(); // key -> { data, expiresAt }
const cacheFile = path.join(process.cwd(), 'server-cache.json');
function loadCacheFromDisk() {
  try {
    if (fs.existsSync(cacheFile)) {
      const raw = fs.readFileSync(cacheFile, 'utf8');
      const json = JSON.parse(raw);
      const now = Date.now();
      for (const [key, entry] of Object.entries(json || {})) {
        if (entry && typeof entry.expiresAt === 'number' && now < entry.expiresAt) {
          cacheMem.set(key, { data: entry.data, expiresAt: entry.expiresAt });
        }
      }
    }
  } catch {}
}
function persistCacheToDisk() {
  try {
    const out = {};
    for (const [key, entry] of cacheMem.entries()) {
      out[key] = { data: entry.data, expiresAt: entry.expiresAt };
    }
    fs.writeFileSync(cacheFile, JSON.stringify(out));
  } catch {}
}
function getCache(key) {
  const entry = cacheMem.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheMem.delete(key);
    return null;
  }
  return entry.data;
}
function setCache(key, data, ttlMs) {
  cacheMem.set(key, { data, expiresAt: Date.now() + ttlMs });
  // Persist asynchronously
  setImmediate(persistCacheToDisk);
}
loadCacheFromDisk();

const rateWindowMs = 60 * 1000; // 1 minute
const maxRequestsPerWindow = (process.env.NODE_ENV || 'development') === 'production' ? 2000 : 5000; // per IP - increased for logo fetching
const ipCounters = new Map(); // ip -> { count, resetAt }

app.use((req, res, next) => {
  // Bypass rate limit for news to avoid UI errors from burst refreshes
  try {
    if (req.path && req.path.startsWith('/api/news')) return next();
  } catch {}
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let bucket = ipCounters.get(ip);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + rateWindowMs };
  }
  bucket.count += 1;
  ipCounters.set(ip, bucket);
  if (bucket.count > maxRequestsPerWindow) {
    return res.status(429).json({ error: 'rate_limited', retryAfterMs: bucket.resetAt - now });
  }
  next();
});

// ----------------------------
// External API helpers
// ----------------------------
async function fetchJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`HTTP ${res.status} for ${url}: ${text}`);
    // Attach status to error for conditional fallbacks
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ----------------------------
// Circuit breaker + backoff for external providers
// ----------------------------
const providerState = {
  coingecko: { failures: 0, openUntil: 0 },
  alphavantage: { failures: 0, openUntil: 0 },
  cryptopanic: { failures: 0, openUntil: 0 },
  finnhub: { failures: 0, openUntil: 0 },
  feargreed: { failures: 0, openUntil: 0 },
  altseason: { failures: 0, openUntil: 0 },
};
function isOpen(provider) {
  return Date.now() < (providerState[provider]?.openUntil || 0);
}
function recordFailure(provider) {
  const st = providerState[provider];
  if (!st) return;
  st.failures += 1;
  const backoffMs = Math.min(120000, 2000 * Math.pow(2, Math.max(0, st.failures - 1))); // cap 2 min
  st.openUntil = Date.now() + backoffMs;
}
function recordSuccess(provider) {
  const st = providerState[provider];
  if (!st) return;
  st.failures = 0;
  st.openUntil = 0;
}
async function withProvider(provider, fn, fallback = null) {
  if (isOpen(provider)) {
    // use last good cache if available via caller
    throw new Error(`circuit_open:${provider}`);
  }
  try {
    const res = await fn();
    recordSuccess(provider);
    return res;
  } catch (e) {
    recordFailure(provider);
    if (fallback !== null) return fallback;
    throw e;
  }
}

async function getCoinGeckoMarkets(vs = 'usd', perPage = 10, includeSparkline = false) {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${encodeURIComponent(vs)}&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=${includeSparkline?'true':'false'}&price_change_percentage=1h,24h,7d`;
  return withProvider('coingecko', () => fetchJson(url));
}

async function getCoinGeckoGlobal() {
  const url = `https://api.coingecko.com/api/v3/global`;
  return withProvider('coingecko', () => fetchJson(url));
}

async function getFearGreedIndex() {
  const url = `https://api.alternative.me/fng/?limit=1`;
  return withProvider('feargreed', () => fetchJson(url));
}

async function getAltcoinSeasonIndex() {
  const url = `https://www.blockchaincenter.net/api/altcoin-season-index`;
  return withProvider('altseason', () => fetchJson(url));
}

async function getCoinGeckoCoinById(id, includeSparkline = false) {
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=${includeSparkline ? 'true' : 'false'}`;
  return withProvider('coingecko', () => fetchJson(url));
}

async function resolveCoinId(symbolOrId) {
  if (!symbolOrId) return null;
  // Prefer well-known mappings to avoid ambiguous symbols (e.g., BTC)
  const KNOWN = {
    BTC: 'bitcoin',
    XBT: 'bitcoin',
    ETH: 'ethereum',
    USDT: 'tether',
    USDC: 'usd-coin',
    SOL: 'solana',
    BNB: 'binancecoin',
    XRP: 'ripple',
    ADA: 'cardano',
    DOGE: 'dogecoin',
    MATIC: 'polygon-pos',
    LTC: 'litecoin',
  };
  const upper = symbolOrId.toUpperCase();
  // Heuristic: likely equity ticker -> avoid CoinGecko lookup first
  if (/^[A-Z]{1,5}$/.test(upper) && !KNOWN[upper]) {
    return null; // let caller try equity path first
  }
  if (KNOWN[upper]) return KNOWN[upper];
  const key = `coingecko:list`;
  let list = getCache(key);
  if (!list) {
    list = await fetchJson('https://api.coingecko.com/api/v3/coins/list');
    // Cache the full list for 6 hours
    setCache(key, list, 6 * 60 * 60 * 1000);
  }
  const needle = symbolOrId.toLowerCase();
  // Exact match on id
  const byId = list.find((c) => c.id.toLowerCase() === needle);
  if (byId) return byId.id;
  // Exact match on symbol
  const matches = list.filter((c) => c.symbol.toLowerCase() === needle);
  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) {
    // Prefer top coins when multiple share the same symbol
    const preferred = matches.find((c) => ['bitcoin','ethereum','tether','usd-coin','binancecoin','ripple','cardano','dogecoin','polygon-pos','litecoin','solana'].includes(c.id));
    if (preferred) return preferred.id;
    return matches[0].id;
  }
  // Fallback: match on name
  const byName = list.find((c) => c.name.toLowerCase() === needle);
  return byName ? byName.id : null;
}

function generateSymbolCandidates(raw) {
  const trimmed = typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim().toUpperCase() : '';
  if (!trimmed) return [];
  const sanitized = trimmed.replace(/\s+/g, '');
  const candidates = new Set();
  const push = (value) => {
    if (!value) return;
    const candidate = String(value).trim().toUpperCase();
    if (!candidate) return;
    if (!/^[A-Z0-9.\-]{1,15}$/.test(candidate)) return;
    candidates.add(candidate);
  };
  push(sanitized);
  sanitized.split(/[\/:-]/).forEach(push);
  if (sanitized.endsWith('USDT') && sanitized.length > 4) push(sanitized.slice(0, -4));
  if (sanitized.endsWith('USDC') && sanitized.length > 4) push(sanitized.slice(0, -4));
  if (sanitized.endsWith('USD') && sanitized.length > 3) push(sanitized.slice(0, -3));
  if (sanitized.includes('.')) sanitized.split('.').forEach(push);
  return Array.from(candidates);
}

async function resolveAssetMeta(rawSymbol) {
  const displaySymbol = typeof rawSymbol === 'string' || typeof rawSymbol === 'number'
    ? String(rawSymbol).trim().toUpperCase()
    : '';
  if (!displaySymbol) return null;
  const candidates = generateSymbolCandidates(displaySymbol);
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    const cacheKey = `asset_meta:${candidate}`;
    const cached = getCache(cacheKey);
    if (cached) return { ...cached, displaySymbol };

    try {
      const coinId = await resolveCoinId(candidate).catch(() => null);
      if (coinId) {
        let coin = null;
        try { coin = await getCoinGeckoCoinById(coinId); } catch {}
        const meta = {
          symbol: (coin?.symbol || candidate).toUpperCase(),
          assetType: 'crypto',
          name: coin?.name || candidate,
          logo: coin?.image?.large || coin?.image?.small || coin?.image?.thumb || null,
          coinId,
        };
        setCache(cacheKey, meta, 15 * 60 * 1000);
        return { ...meta, displaySymbol };
      }
    } catch {}

    try {
      let quote = await getFinnhubQuote(candidate);
      if (!quote) {
        quote = await getEquityQuoteFromAlphaVantage(candidate);
      }
      if (quote) {
        let profile = null;
        try { profile = await getFinnhubProfile(candidate); } catch {}
        const meta = {
          symbol: (quote.symbol || candidate).toUpperCase(),
          assetType: 'equity',
          name: profile?.name || quote.name || candidate,
          logo: profile?.logo || null,
        };
        setCache(cacheKey, meta, 15 * 60 * 1000);
        return { ...meta, displaySymbol };
      }
    } catch {}
  }

  return null;
}

const POPULAR_ASSETS = [
  { symbol: 'BTC', displaySymbol: 'BTC', name: 'Bitcoin', assetType: 'crypto', logo: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png', source: 'static', score: 1000 },
  { symbol: 'ETH', displaySymbol: 'ETH', name: 'Ethereum', assetType: 'crypto', logo: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png', source: 'static', score: 999 },
  { symbol: 'SOL', displaySymbol: 'SOL', name: 'Solana', assetType: 'crypto', logo: 'https://assets.coingecko.com/coins/images/4128/large/solana.png', source: 'static', score: 998 },
  { symbol: 'AAPL', displaySymbol: 'AAPL', name: 'Apple Inc.', assetType: 'equity', logo: 'https://logo.clearbit.com/apple.com', source: 'static', score: 997 },
  { symbol: 'TSLA', displaySymbol: 'TSLA', name: 'Tesla Inc.', assetType: 'equity', logo: 'https://logo.clearbit.com/tesla.com', source: 'static', score: 996 },
  { symbol: 'NVDA', displaySymbol: 'NVDA', name: 'NVIDIA Corporation', assetType: 'equity', logo: 'https://logo.clearbit.com/nvidia.com', source: 'static', score: 995 },
  { symbol: 'MSFT', displaySymbol: 'MSFT', name: 'Microsoft Corporation', assetType: 'equity', logo: 'https://logo.clearbit.com/microsoft.com', source: 'static', score: 994 },
  { symbol: 'AMZN', displaySymbol: 'AMZN', name: 'Amazon.com Inc.', assetType: 'equity', logo: 'https://logo.clearbit.com/amazon.com', source: 'static', score: 993 },
  { symbol: 'META', displaySymbol: 'META', name: 'Meta Platforms Inc.', assetType: 'equity', logo: 'https://logo.clearbit.com/meta.com', source: 'static', score: 992 },
  { symbol: 'DOGE', displaySymbol: 'DOGE', name: 'Dogecoin', assetType: 'crypto', logo: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png', source: 'static', score: 991 },
  { symbol: 'ADA', displaySymbol: 'ADA', name: 'Cardano', assetType: 'crypto', logo: 'https://assets.coingecko.com/coins/images/975/large/cardano.png', source: 'static', score: 990 },
  { symbol: 'MATIC', displaySymbol: 'MATIC', name: 'Polygon', assetType: 'crypto', logo: 'https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png', source: 'static', score: 989 },
];

function normalizeAssetSuggestion(entry) {
  if (!entry || !entry.symbol) return null;
  return {
    symbol: String(entry.symbol).toUpperCase(),
    displaySymbol: String(entry.displaySymbol || entry.symbol).toUpperCase(),
    name: entry.name || entry.displaySymbol || entry.symbol,
    assetType: entry.assetType === 'equity' ? 'equity' : 'crypto',
    logo: entry.logo || null,
    source: entry.source || 'unknown',
    score: typeof entry.score === 'number' ? entry.score : 0,
  };
}

function dedupeAndRankSuggestions(list) {
  const map = new Map();
  for (const raw of list) {
    const normalized = normalizeAssetSuggestion(raw);
    if (!normalized) continue;
    const key = `${normalized.assetType}:${normalized.symbol}`;
    const prev = map.get(key);
    if (!prev || (normalized.score ?? 0) > (prev.score ?? 0)) {
      map.set(key, normalized);
    }
  }
  return Array.from(map.values()).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

async function searchCoinGeckoAssets(query, limit = 12) {
  if (!query) return [];
  const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`;
  try {
    const json = await withProvider('coingecko', () => fetchJson(url), { coins: [] });
    const coins = Array.isArray(json?.coins) ? json.coins.slice(0, limit) : [];
    return coins.map((coin, idx) => ({
      symbol: String(coin?.symbol || '').toUpperCase(),
      displaySymbol: String(coin?.symbol || '').toUpperCase(),
      name: coin?.name || coin?.symbol || query.toUpperCase(),
      assetType: 'crypto',
      logo: coin?.large || coin?.thumb || null,
      source: 'coingecko',
      score: typeof coin?.market_cap_rank === 'number'
        ? Math.max(0, 2000 - coin.market_cap_rank)
        : 800 - idx,
    })).filter((item) => item.symbol);
  } catch (error) {
    console.warn('coingecko search failed:', error?.message || error);
    return [];
  }
}

async function searchFinnhubAssets(query, limit = 12) {
  if (!query || !FINNHUB_API_KEY) return [];
  const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${encodeURIComponent(FINNHUB_API_KEY)}`;
  try {
    const json = await withProvider('finnhub', () => fetchJson(url), { result: [] });
    const rows = Array.isArray(json?.result) ? json.result : [];
    return rows
      .filter((row) => row?.symbol && /^[A-Z.]{1,6}$/.test(row.symbol))
      .slice(0, limit)
      .map((row, idx) => ({
        symbol: String(row.symbol).toUpperCase(),
        displaySymbol: String(row.symbol).toUpperCase(),
        name: row.description || row.symbol,
        assetType: 'equity',
        logo: null,
        source: 'finnhub',
        score: 600 - idx,
      }));
  } catch (error) {
    console.warn('finnhub search failed:', error?.message || error);
    return [];
  }
}

async function searchAlphaVantageAssets(query, limit = 10) {
  if (!query || !ALPHA_VANTAGE_KEY) return [];
  const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${encodeURIComponent(ALPHA_VANTAGE_KEY)}`;
  try {
    const json = await withProvider('alphavantage', () => fetchJson(url), { bestMatches: [] });
    const matches = Array.isArray(json?.bestMatches) ? json.bestMatches : [];
    return matches.slice(0, limit).map((match, idx) => ({
      symbol: String(match['1. symbol'] || match.symbol || '').toUpperCase(),
      displaySymbol: String(match['1. symbol'] || match.symbol || '').toUpperCase(),
      name: match['2. name'] || match.name || query.toUpperCase(),
      assetType: 'equity',
      logo: null,
      source: 'alphavantage',
      score: 500 - idx,
    })).filter((item) => item.symbol);
  } catch (error) {
    console.warn('alphavantage search failed:', error?.message || error);
    return [];
  }
}

async function searchAssetCatalog(query) {
  const trimmed = String(query || '').trim();
  const cacheKey = trimmed ? `asset_search:${trimmed.toUpperCase()}` : 'asset_search:popular';
  const cached = getCache(cacheKey);
  if (cached) return cached;

  if (!trimmed) {
    const popular = dedupeAndRankSuggestions(POPULAR_ASSETS).slice(0, 20).map(({ score, ...rest }) => rest);
    setCache(cacheKey, popular, 2 * 60 * 60 * 1000);
    return popular;
  }

  const [cryptoResults, equityFinnhub, equityAlpha] = await Promise.all([
    searchCoinGeckoAssets(trimmed, 12),
    searchFinnhubAssets(trimmed, 8),
    searchAlphaVantageAssets(trimmed, 5),
  ]);

  let combined = dedupeAndRankSuggestions([
    ...cryptoResults,
    ...equityFinnhub,
    ...equityAlpha,
  ]);

  if (combined.length === 0) {
    // fallback: fuzzy match popular list
    combined = dedupeAndRankSuggestions(
      POPULAR_ASSETS.filter((item) =>
        item.symbol?.toUpperCase().includes(trimmed.toUpperCase()) ||
        item.name?.toUpperCase().includes(trimmed.toUpperCase())
      )
    );
  }

  const finalResults = combined.slice(0, 20).map(({ score, ...rest }) => rest);
  setCache(cacheKey, finalResults, 5 * 60 * 1000);
  return finalResults;
}

app.get('/api/assets/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toString();
    const items = await searchAssetCatalog(q);
    return res.json({ ok: true, items });
  } catch (error) {
    console.error('asset search failed:', error);
    return res.status(500).json({ ok: false, error: 'asset_search_failed' });
  }
});

async function getNewsFromAlphaVantage(symbol) {
  if (!ALPHA_VANTAGE_KEY) return null;
  const params = new URLSearchParams({
    function: 'NEWS_SENTIMENT',
    topics: 'crypto',
    apikey: ALPHA_VANTAGE_KEY,
  });
  if (symbol) params.set('tickers', symbol.toUpperCase());
  const url = `https://www.alphavantage.co/query?${params.toString()}`;
  const json = await withProvider('alphavantage', () => fetchJson(url), { feed: [] });
  const feed = Array.isArray(json.feed) ? json.feed : [];
  return feed.slice(0, 20).map((n) => ({
    title: n.title,
    summary: n.summary,
    source: n.source,
    url: n.url,
    time_published: n.time_published,
    tickers: n.ticker_sentiment?.map((t) => t.ticker) || [],
  }));
}

async function getEquityQuoteFromAlphaVantage(symbol) {
  if (!ALPHA_VANTAGE_KEY) return null;
  const params = new URLSearchParams({
    function: 'GLOBAL_QUOTE',
    symbol: symbol.toUpperCase(),
    apikey: ALPHA_VANTAGE_KEY,
  });
  const url = `https://www.alphavantage.co/query?${params.toString()}`;
  const json = await withProvider('alphavantage', () => fetchJson(url), {});
  const q = json && (json['Global Quote'] || json['GlobalQuote']);
  if (!q) return null;
  const price = parseFloat(q['05. price'] || q['05. Price'] || q.price || '0');
  const changePct = parseFloat((q['10. change percent'] || '0').replace('%',''));
  return {
    symbol: symbol.toUpperCase(),
    name: symbol.toUpperCase(),
    market_data: {
      current_price: isFinite(price) ? price : undefined,
      price_change_percentage_24h: isFinite(changePct) ? changePct : undefined,
    },
    image: null,
  };
}

// Finnhub helpers (stocks)
async function getFinnhubQuote(symbol) {
  if (!FINNHUB_API_KEY) return null;
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol.toUpperCase())}&token=${encodeURIComponent(FINNHUB_API_KEY)}`;
  const json = await withProvider('finnhub', () => fetchJson(url), {});
  if (!json || typeof json.c !== 'number') return null;
  const price = json.c;
  const changePct = typeof json.dp === 'number' ? json.dp : undefined;
  return {
    symbol: symbol.toUpperCase(),
    name: symbol.toUpperCase(),
    market_data: {
      current_price: isFinite(price) ? price : undefined,
      price_change_percentage_24h: isFinite(changePct) ? changePct : undefined,
      // Finnhub doesn't provide 1h or 7d directly on this endpoint
    },
    image: null,
  };
}

async function getFinnhubProfile(symbol) {
  if (!FINNHUB_API_KEY) return null;
  const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol.toUpperCase())}&token=${encodeURIComponent(FINNHUB_API_KEY)}`;
  const json = await withProvider('finnhub', () => fetchJson(url), {});
  if (!json) return null;
  return { logo: json.logo || null, name: json.name || symbol.toUpperCase() };
}

async function getNewsFromCryptoPanic(symbol) {
  if (!CRYPTO_PANIC_KEY) return null;
  const params = new URLSearchParams({
    auth_token: CRYPTO_PANIC_KEY,
    public: 'true',
    currencies: symbol ? symbol.toUpperCase() : 'BTC,ETH,SOL,ADA,MATIC',
  });
  const url = `https://cryptopanic.com/api/v1/posts/?${params.toString()}`;
  const json = await withProvider('cryptopanic', () => fetchJson(url), { results: [] });
  const results = Array.isArray(json.results) ? json.results : [];
  return results.slice(0, 20).map((post) => ({
    title: post.title || 'Crypto News',
    summary: post.description || post.metadata?.description || post.title || '',
    source: post.source?.title || post.domain || 'CryptoPanic',
    url: post.url || (post.id ? `https://cryptopanic.com/news/${post.id}` : ''),
    time_published: post.published_at || '',
    tickers: post.currencies?.map((c) => c.code?.toUpperCase()) || [],
  }));
}

// ----------------------------
// API: News
// ----------------------------
app.get('/api/news', async (req, res) => {
  const symbol = (req.query.symbol || '').toString().trim();
  const cacheKey = `news:${symbol || 'all'}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json({ ok: true, source: cached.source, items: cached.items });
  try {
    let items = null;
    let source = 'alphavantage';
    
    // Try Alpha Vantage first
    try {
      items = await getNewsFromAlphaVantage(symbol);
    } catch (e) {
      console.warn('Alpha Vantage failed:', e.message);
      items = null;
    }
    
    // Fallback to CryptoPanic if Alpha Vantage fails
    if (!items || items.length === 0) {
      try {
        items = await getNewsFromCryptoPanic(symbol);
        source = 'cryptopanic';
      } catch (e) {
        console.warn('CryptoPanic failed:', e.message);
        // prefer last good cache if available
        const lastGood = getCache(cacheKey);
        if (lastGood && Array.isArray(lastGood.items) && lastGood.items.length > 0) {
          return res.json({ ok: true, source: lastGood.source, items: lastGood.items });
        }
        items = [];
        source = 'none';
      }
    }
    
    // If a symbol was requested but we still have no items, fallback to general trending
    if ((!items || items.length === 0) && symbol) {
      try {
        const general = await getNewsFromCryptoPanic('');
        if (Array.isArray(general) && general.length > 0) {
          items = general;
          source = 'cryptopanic';
        }
      } catch {}
    }
    
    const payload = { source, items };
    // Increase cache to 3 hours to reduce API usage and avoid rate limits
    setCache(cacheKey, payload, 3 * 60 * 60 * 1000);
    return res.json({ ok: true, ...payload });
  } catch (e) {
    // Prefer last good cache
    const lastGood = getCache(cacheKey);
    if (lastGood) return res.json({ ok: true, source: lastGood.source, items: lastGood.items });
    return res.json({ ok: true, source: 'none', items: [] });
  }
});

// ----------------------------
// API: Signals count (total)
// ----------------------------
app.get('/api/stats/signals/count', async (req, res) => {
  try {
    const sql = getNeonSql();
    if (sql) {
      try {
        await ensureSignalsTable(sql);
        const rows = await sql`SELECT COUNT(*)::int AS count FROM signals`;
        const count = rows && rows[0] && typeof rows[0].count === 'number' ? rows[0].count : 0;
        return res.json({ ok: true, count, source: 'postgres' });
      } catch (e) {
        console.warn('signals count pg error:', e.message);
      }
    }
    // Fallback: best-effort using recent list length
    try {
      const perPage = 100;
      const cacheKey = `signals:latest:${perPage}`;
      const cached = getCache(cacheKey);
      if (cached && Array.isArray(cached.items)) {
        return res.json({ ok: true, count: cached.items.length, source: 'cache' });
      }
    } catch {}
    return res.json({ ok: true, count: 0, source: 'none' });
  } catch (e) {
    return res.json({ ok: true, count: 0, source: 'error' });
  }
});

// ----------------------------
// API: Market summary
// ----------------------------
app.get('/api/market', async (req, res) => {
  const perPage = Math.min(parseInt(String(req.query.limit || '10'), 10) || 10, 100);
  const cacheKey = `market:top:${perPage}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json({ ok: true, items: cached.items });
  try {
    const markets = await getCoinGeckoMarkets('usd', perPage);
    const items = markets.map((m) => ({
      id: m.id,
      symbol: m.symbol?.toUpperCase(),
      name: m.name,
      image: m.image,
      price: m.current_price,
      market_cap: m.market_cap,
      change_24h: m.price_change_percentage_24h,
      change_1h: m.price_change_percentage_1h_in_currency ?? (m.price_change_percentage_1h_in_currency?.usd),
      change_7d: m.price_change_percentage_7d_in_currency ?? (m.price_change_percentage_7d_in_currency?.usd),
      volume_24h: m.total_volume,
    }));
    setCache(cacheKey, { items }, 30 * 1000); // 30s cache
    return res.json({ ok: true, items });
  } catch (e) {
    const lastGood = getCache(cacheKey);
    if (lastGood) return res.json({ ok: true, items: lastGood.items });
    return res.status(500).json({ ok: false, error: e.message || 'market_error' });
  }
});

// ----------------------------
// API: Coin details
// ----------------------------
app.get('/api/coin', async (req, res) => {
  const q = (req.query.id || req.query.symbol || '').toString().trim();
  if (!q) return res.status(400).json({ ok: false, error: 'missing_id_or_symbol' });
  try {
    const id = await resolveCoinId(q);
    if (!id) {
      // Fallback to equities via Alpha Vantage
      try {
        const eq = await getEquityQuoteFromAlphaVantage(q);
        if (eq) {
          let prof = null;
          try { prof = await getFinnhubProfile(q); } catch {}
          const withImg = { ...eq, image: prof?.logo || eq.image || null, name: prof?.name || eq.name };
          return res.json({ ok: true, id: withImg.symbol.toLowerCase(), ...withImg });
        }
      } catch {}
      return res.status(404).json({ ok: false, error: 'coin_not_found' });
    }
    const cacheKey = `coin:${id}`;
    const noCache = String(req.query.noCache || '0') === '1';
    const cached = noCache ? null : getCache(cacheKey);
    if (cached) return res.json({ ok: true, id, ...cached });
    const coin = await getCoinGeckoCoinById(id);
    const payload = {
      id: coin.id,
      symbol: coin.symbol?.toUpperCase(),
      name: coin.name,
      description: coin.description?.en || '',
      genesis_date: coin.genesis_date || null,
      hashing_algorithm: coin.hashing_algorithm || null,
      homepage: Array.isArray(coin.links?.homepage) ? coin.links.homepage[0] : null,
      market_data: coin.market_data ? {
        current_price: typeof coin.market_data.current_price?.usd === 'number' ? coin.market_data.current_price.usd : undefined,
        market_cap: coin.market_data.market_cap?.usd,
        high_24h: coin.market_data.high_24h?.usd,
        low_24h: coin.market_data.low_24h?.usd,
        price_change_percentage_24h: coin.market_data.price_change_percentage_24h,
      } : null,
      image: coin.image?.large || coin.image?.small || coin.image?.thumb || null,
    };
    setCache(cacheKey, payload, 60 * 1000); // 60s for dev responsiveness
    return res.json({ ok: true, id, ...payload });
  } catch (e) {
    // Prefer last good cache if available
    const id = await resolveCoinId(q).catch(() => null);
    if (id) {
      const last = getCache(`coin:${id}`);
      if (last) return res.json({ ok: true, id, ...last });
    }
    return res.status(500).json({ ok: false, error: e.message || 'coin_error' });
  }
});

// ----------------------------
// API: Batch coin/equity details
// ----------------------------
app.get('/api/coins', async (req, res) => {
  const symbolsParam = (req.query.symbols || '').toString().trim();
  if (!symbolsParam) return res.status(400).json({ ok: false, error: 'missing_symbols' });
  const raw = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);
  // de-duplicate while preserving order
  const seen = new Set();
  const symbols = raw.filter(s => (seen.has(s.toUpperCase()) ? false : (seen.add(s.toUpperCase()), true)));

  // Concurrency limit to protect providers
  const limit = 3;
  const results = new Array(symbols.length);
  // Preload 7d changes from markets for crypto subset
  const cryptoSymbols = symbols.filter(s => !/^[A-Z]{1,5}$/.test(s));
  const marketsBySym = new Map();
  try {
    if (cryptoSymbols.length > 0) {
      // CoinGecko markets endpoint returns top coins; for precise mapping we will fallback per-coin if missing
      const markets = await getCoinGeckoMarkets('usd', 250).catch(() => []);
      for (const m of Array.isArray(markets) ? markets : []) {
        if (m?.symbol) marketsBySym.set(String(m.symbol).toUpperCase(), m);
      }
    }
  } catch {}
  let idx = 0;
  async function worker() {
    while (idx < symbols.length) {
      const my = idx++;
      const sym = symbols[my];
      try {
        // Try crypto first
        const id = await resolveCoinId(sym).catch(() => null);
        if (id) {
          const cacheKey = `coin:${id}`;
          const cached = getCache(cacheKey);
          if (cached) { results[my] = { ok: true, id, ...cached }; continue; }
          const coin = await getCoinGeckoCoinById(id, true);
          const payload = {
            id: coin.id,
            symbol: coin.symbol?.toUpperCase(),
            name: coin.name,
            description: coin.description?.en || '',
            genesis_date: coin.genesis_date || null,
            hashing_algorithm: coin.hashing_algorithm || null,
            homepage: Array.isArray(coin.links?.homepage) ? coin.links.homepage[0] : null,
            market_data: coin.market_data ? {
              current_price: typeof coin.market_data.current_price?.usd === 'number' ? coin.market_data.current_price.usd : undefined,
              market_cap: coin.market_data.market_cap?.usd,
              high_24h: coin.market_data.high_24h?.usd,
              low_24h: coin.market_data.low_24h?.usd,
              price_change_percentage_24h: coin.market_data.price_change_percentage_24h,
              price_change_percentage_7d: (() => {
                const m = marketsBySym.get((coin.symbol || '').toUpperCase());
                const v = m?.price_change_percentage_7d_in_currency;
                const usd = typeof v === 'number' ? v : (v?.usd ?? undefined);
                return typeof usd === 'number' ? usd : undefined;
              })(),
              spark: Array.isArray(coin.sparkline_in_7d?.price) ? coin.sparkline_in_7d.price : undefined,
            } : null,
            image: coin.image?.large || coin.image?.small || coin.image?.thumb || null,
          };
          setCache(cacheKey, payload, 60 * 1000);
          results[my] = { ok: true, id, ...payload };
          continue;
        }
        // Equity fallback (prefer Finnhub)
        const eq = (await getFinnhubQuote(sym)) || (await getEquityQuoteFromAlphaVantage(sym));
        if (eq) { results[my] = { ok: true, id: eq.symbol.toLowerCase(), ...eq }; continue; }
        results[my] = { ok: false, error: 'not_found' };
      } catch (e) {
        // Prefer last good cache if any
        try {
          const id2 = await resolveCoinId(sym).catch(() => null);
          if (id2) {
            const last = getCache(`coin:${id2}`);
            if (last) { results[my] = { ok: true, id: id2, ...last }; continue; }
          }
        } catch {}
        results[my] = { ok: false, error: e?.message || 'fetch_error' };
      }
    }
  }
  await Promise.all(new Array(Math.min(limit, symbols.length)).fill(0).map(() => worker()));
  res.json({ ok: true, items: symbols.map((s, i) => ({ symbol: s.toUpperCase(), data: results[i] })) });
});

// ----------------------------
// API: Prices - Crypto and Stocks
// ----------------------------
app.get('/api/prices/crypto', async (req, res) => {
  const perPage = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 250);
  const cacheKey = `prices:crypto:${perPage}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json({ ok: true, items: cached.items });
  try {
    const markets = await getCoinGeckoMarkets('usd', perPage, true);
    const items = markets.map((m) => ({
      id: m.id,
      symbol: m.symbol?.toUpperCase(),
      name: m.name,
      image: m.image,
      price: m.current_price,
      market_cap: m.market_cap,
      change_1h: typeof m.price_change_percentage_1h_in_currency === 'number' ? m.price_change_percentage_1h_in_currency : (m.price_change_percentage_1h_in_currency?.usd),
      change_24h: m.price_change_percentage_24h,
      change_7d: typeof m.price_change_percentage_7d_in_currency === 'number' ? m.price_change_percentage_7d_in_currency : (m.price_change_percentage_7d_in_currency?.usd),
      volume_24h: m.total_volume,
      spark: Array.isArray(m.sparkline_in_7d?.price) ? m.sparkline_in_7d.price : [],
    }));
    setCache(cacheKey, { items }, 90 * 1000);
    return res.json({ ok: true, items });
  } catch (e) {
    const last = getCache(cacheKey);
    if (last) return res.json({ ok: true, items: last.items });
    // graceful empty to avoid UI flicker
    return res.json({ ok: true, items: [] });
  }
});

// ----------------------------
// API: Global Metrics (Market Cap, Fear & Greed, Altcoin Season)
// ----------------------------
app.get('/api/metrics', async (req, res) => {
  const cacheKey = `metrics:global`;
  const cached = getCache(cacheKey);
  if (cached) return res.json({ ok: true, ...cached });
  try {
    let mcUsd = null, btcDom = null, mcChange24h = null;
    try {
      const g = await getCoinGeckoGlobal();
      const d = g?.data || {};
      mcUsd = d?.total_market_cap?.usd ?? null;
      btcDom = d?.market_cap_percentage?.btc ?? null;
      mcChange24h = d?.market_cap_change_percentage_24h_usd ?? null;
    } catch {}

    let fearGreed = null;
    try {
      const f = await getFearGreedIndex();
      const x = Array.isArray(f?.data) && f.data[0] ? f.data[0] : null;
      if (x) fearGreed = { value: Number(x.value), classification: x.value_classification, time: Number(x.timestamp) * 1000 };
    } catch {}

    let altSeason = null;
    try {
      const a = await getAltcoinSeasonIndex();
      const raw = a?.altcoin_season_index ?? a?.altseason ?? a?.value;
      const num = Number(raw);
      if (!Number.isNaN(num)) altSeason = num;
    } catch {}

    const payload = { marketCapUsd: mcUsd, btcDominancePct: btcDom, marketCapChange24hPct: mcChange24h, fearGreed, altcoinSeasonIndex: altSeason };
    setCache(cacheKey, payload, 120 * 1000);
    return res.json({ ok: true, ...payload });
  } catch (e) {
    const last = getCache(cacheKey);
    if (last) return res.json({ ok: true, ...last });
    return res.json({ ok: true, marketCapUsd: null, btcDominancePct: null, marketCapChange24hPct: null, fearGreed: null, altcoinSeasonIndex: null });
  }
});

app.get('/api/prices/stocks', async (req, res) => {
  // Expect tickers param or use a small curated list to avoid Alpha Vantage limits
  const tickersParam = (req.query.tickers || 'AAPL,NVDA,MSFT,TSLA,AMZN,GOOGL,META').toString();
  const tickers = Array.from(new Set(tickersParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)));
  const cacheKey = `prices:stocks:${tickers.join(',')}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json({ ok: true, items: cached.items });
  try {
    const items = [];
    for (const t of tickers) {
      try {
        // Prefer Finnhub if configured; fallback to Alpha Vantage
        const eq = (await getFinnhubQuote(t)) || (await getEquityQuoteFromAlphaVantage(t));
        const prof = await getFinnhubProfile(t).catch(() => null);
        // Compute 1h and 7d change via Finnhub candles if available
        let change_1h, change_7d;
        try {
          if (FINNHUB_API_KEY) {
            const now = Math.floor(Date.now() / 1000);
            const oneHourAgo = now - 60 * 60;
            const sevenDaysAgo = now - 7 * 24 * 60 * 60;
            const url1h = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(t)}&resolution=1&from=${oneHourAgo}&to=${now}&token=${encodeURIComponent(FINNHUB_API_KEY)}`;
            const url7d = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(t)}&resolution=60&from=${sevenDaysAgo}&to=${now}&token=${encodeURIComponent(FINNHUB_API_KEY)}`;
            const c1h = await withProvider('finnhub', () => fetchJson(url1h), {});
            const c7d = await withProvider('finnhub', () => fetchJson(url7d), {});
            if (c1h && c1h.s === 'ok' && Array.isArray(c1h.c) && c1h.c.length > 1) {
              const first = c1h.c[0];
              const last = c1h.c[c1h.c.length - 1];
              change_1h = first ? ((last - first) / first) * 100 : undefined;
            }
            if (c7d && c7d.s === 'ok' && Array.isArray(c7d.c) && c7d.c.length > 1) {
              const first = c7d.c[0];
              const last = c7d.c[c7d.c.length - 1];
              change_7d = first ? ((last - first) / first) * 100 : undefined;
            }
          }
        } catch {}
        if (eq) items.push({
          id: t.toLowerCase(),
          symbol: t,
          name: prof?.name || t,
          image: prof?.logo || null,
          price: eq.market_data?.current_price,
          change_1h,
          change_24h: eq.market_data?.price_change_percentage_24h,
          change_7d,
        });
      } catch {}
    }
    setCache(cacheKey, { items }, 60 * 1000);
    return res.json({ ok: true, items });
  } catch (e) {
    const last = getCache(cacheKey);
    if (last) return res.json({ ok: true, items: last.items });
    return res.status(500).json({ ok: false, error: e.message || 'prices_stocks_error' });
  }
});

// ----------------------------
// API: Signals (from PostgreSQL/Neon)
// ----------------------------

async function ensureSignalsTable(sql) {
  await sql`CREATE TABLE IF NOT EXISTS signals (
    id BIGSERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    display_symbol TEXT,
    signal_type TEXT NOT NULL,
    price NUMERIC,
    timestamp TIMESTAMPTZ DEFAULT now(),
    signal_strength TEXT,
    asset_type TEXT DEFAULT 'equity',
    recommendations TEXT,
    performance TEXT,
    details JSONB,
    status TEXT DEFAULT 'active'
  )`;
  await sql`ALTER TABLE signals ADD COLUMN IF NOT EXISTS display_symbol TEXT`;
  await sql`ALTER TABLE signals ADD COLUMN IF NOT EXISTS signal_strength TEXT`;
  await sql`ALTER TABLE signals ADD COLUMN IF NOT EXISTS asset_type TEXT DEFAULT 'equity'`;
  await sql`ALTER TABLE signals ADD COLUMN IF NOT EXISTS details JSONB`;
  await sql`ALTER TABLE signals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`;
}

async function pruneOldSignals(sql, days = 10) {
  const span = Number.isFinite(days) && days > 0 ? Math.floor(days) : 10;
  await sql`DELETE FROM signals WHERE timestamp < now() - ${span} * interval '1 day'`;
}

function parseMaybeJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch (err) {
    try {
      return JSON.parse(value.replace(/'/g, '"'));
    } catch (err2) {
      return null;
    }
  }
}

function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return '';
  const num = Number(value);
  const abs = Math.abs(num);
  const maximumFractionDigits = abs >= 100 ? 2 : abs >= 1 ? 3 : 6;
  return `$${num.toLocaleString(undefined, { maximumFractionDigits })}`;
}

function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return '';
  const num = Number(value);
  const abs = Math.abs(num);
  const digits = abs >= 10 ? 1 : abs >= 1 ? 2 : 3;
  return `${num >= 0 ? '+' : ''}${num.toFixed(digits)}%`;
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const low = entry.low != null ? Number(entry.low) : null;
  const high = entry.high != null ? Number(entry.high) : null;
  const mid = entry.mid != null ? Number(entry.mid) : (low != null && high != null ? (low + high) / 2 : null);
  if (low == null && high == null && mid == null) return null;
  return { low, high, mid };
}

function normalizeTarget(target, index = 0) {
  if (!target || typeof target !== 'object') return null;
  const price = target.price != null ? Number(target.price) : null;
  const pct = target.pct != null ? Number(target.pct) : null;
  if (price == null && pct == null) return null;
  const label = target.label || `Target ${index + 1}`;
  return {
    label,
    price,
    pct,
  };
}

function formatSignalRow(row) {
  if (!row) return null;
  const details = parseMaybeJson(row.details) || {};
  const priceValue = row.price != null ? Number(row.price) : (details.current_price != null ? Number(details.current_price) : null);

  const entry = normalizeEntry(details.entry);
  const entryRange = entry && entry.low != null && entry.high != null
    ? `${formatCurrency(entry.low)} → ${formatCurrency(entry.high)}`
    : '';

  const targetsRaw = Array.isArray(details.targets) ? details.targets : [];
  const targets = targetsRaw
    .map((target, idx) => normalizeTarget(target, idx))
    .filter(Boolean);

  const stopDetail = details.stop && typeof details.stop === 'object'
    ? {
        price: details.stop.price != null ? Number(details.stop.price) : null,
        pct: details.stop.pct != null ? Number(details.stop.pct) : null,
      }
    : null;
  const stopLoss = stopDetail && stopDetail.price != null
    ? `${formatCurrency(stopDetail.price)}${stopDetail.pct != null ? ` (${formatPercent(stopDetail.pct)})` : ''}`
    : '';

  const recommendationsRaw = parseMaybeJson(row.recommendations) || {};
  const timeframesSource = details.timeframes && typeof details.timeframes === 'object'
    ? details.timeframes
    : recommendationsRaw;
  const timeframes = {};
  if (timeframesSource && typeof timeframesSource === 'object') {
    for (const [key, value] of Object.entries(timeframesSource)) {
      if (typeof value === 'string' && value.trim()) {
        timeframes[key] = value.trim();
      }
    }
  }

  const rawSymbol = String(row.symbol || details.rawSymbol || details.price_symbol || details.displaySymbol || '').toUpperCase();
  const displaySymbol = String(details.displaySymbol || row.display_symbol || rawSymbol).toUpperCase();

  const assetTypeRaw = details.asset_type || row.asset_type || 'equity';
  const assetType = typeof assetTypeRaw === 'string' ? assetTypeRaw.toLowerCase() : 'equity';
  const assetLabel = details.asset_label || (assetType === 'crypto' ? 'Crypto' : assetType === 'forex' ? 'FX' : 'Equity');

  let postedAt = details.posted_at || details.postedAt || row.timestamp || new Date().toISOString();
  const parsedDate = new Date(postedAt);
  postedAt = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();

  const description = typeof details.summary === 'string' && details.summary.trim()
    ? details.summary.trim()
    : (typeof row.recommendations === 'string' ? row.recommendations : '');

  const type = /SELL/i.test(String(row.signal_type || details.type || '')) ? 'SELL' : 'BUY';
  const signalStrength = row.signal_strength || details.signal_strength || null;
  const confidence = details.confidence || null;
  const score = details.score != null ? Number(details.score) : null;
  const chartUrl = details.chart_url || details.chartUrl || null;
  const status = row.status || details.status || 'active';
  const primaryTarget = targets[0] || null;

  const rawPerformance = details.performance && typeof details.performance === 'object' ? details.performance
    : row.performance && typeof row.performance === 'object' ? row.performance
    : null;
  const performance = rawPerformance && typeof rawPerformance === 'object'
    ? JSON.parse(JSON.stringify(rawPerformance))
    : null;

  const targetText = primaryTarget && primaryTarget.price != null
    ? `${formatCurrency(primaryTarget.price)}${primaryTarget.pct != null ? ` (${formatPercent(primaryTarget.pct)})` : ''}`
    : '';

  return {
    id: row.id,
    symbol: displaySymbol,
    rawSymbol: rawSymbol || displaySymbol,
    assetType,
    assetLabel,
    logoUrl: details.logo_url || details.logoUrl || null,
    type,
    price: priceValue != null ? formatCurrency(priceValue) : '',
    priceValue,
    entry,
    entryRange,
    targets,
    stop: stopDetail,
    stopLoss,
    target: targetText,
    signalStrength,
    confidence,
    score,
    timeframes,
    chartUrl,
    postedAt,
    time: postedAt,
    description,
    summary: description,
    status,
    details,
    performance,
  };
}

function invalidateSignalsCache() {
  let changed = false;
  for (const key of cacheMem.keys()) {
    if (key.startsWith('signals:')) {
      cacheMem.delete(key);
      changed = true;
    }
  }
  if (changed) setImmediate(persistCacheToDisk);
}

app.get('/api/signals', async (req, res) => {
  const perPageParam = parseInt(String(req.query.limit || '20'), 10);
  const perPage = Number.isFinite(perPageParam) ? Math.min(Math.max(perPageParam, 1), 100) : 20;
  const cacheKey = `signals:latest:${perPage}`;
  const cached = getCache(cacheKey);
  if (cached && Array.isArray(cached.items) && cached.items.length > 0) {
    return res.json({ ok: true, source: cached.source, items: cached.items });
  }

  const sql = getNeonSql();
  if (sql) {
    try {
      await ensureSignalsTable(sql);
      const pruneDays = Number(process.env.SIGNALS_PRUNE_DAYS || 10);
      await pruneOldSignals(sql, pruneDays);
      const rows = await sql`SELECT id, symbol, display_symbol, signal_type, price, timestamp, signal_strength, asset_type, recommendations, performance, details, status
                             FROM signals
                             ORDER BY timestamp DESC
                             LIMIT ${perPage}`;
      const items = rows.map((row) => formatSignalRow(row)).filter(Boolean);
      if (items.length > 0) {
      setCache(cacheKey, { source: 'postgres', items }, 45 * 1000);
      return res.json({ ok: true, source: 'postgres', items });
      }
    } catch (e) {
      console.warn('signals pg error:', e.message);
    }
  }

  try {
    const markets = await getCoinGeckoMarkets('usd', Math.min(perPage, 20));
    const nowIso = new Date().toISOString();
    const fallback = markets.map((m) => {
      const price = Number(m.current_price ?? 0);
      const change = Number(m.price_change_percentage_24h ?? 0);
      const symbol = (m.symbol || '').toUpperCase();
      const name = m.name || symbol;
      const type = change >= 0 ? 'BUY' : 'SELL';
      const details = {
        asset_type: 'crypto',
        summary: `${name} • 24h change ${change.toFixed(2)}%`,
      };
      return {
        id: m.id,
        symbol: `${symbol || name}/USD`,
        rawSymbol: symbol || name,
        assetType: 'crypto',
        assetLabel: 'Crypto',
        type,
        price: price ? `$${price.toLocaleString(undefined, { maximumFractionDigits: price >= 100 ? 2 : 4 })}` : '$0.00',
        priceValue: price,
        entry: null,
        entryRange: '',
        targets: [],
        stop: null,
        stopLoss: '',
        target: '',
        signalStrength: null,
        confidence: null,
        score: null,
        timeframes: {},
        chartUrl: `https://www.tradingview.com/symbols/${symbol || 'BTC'}USD/`,
        postedAt: nowIso,
        time: nowIso,
        description: `${name} • 24h change ${change.toFixed(2)}%`,
        summary: `${name} • 24h change ${change.toFixed(2)}%`,
        status: 'active',
        details,
      };
    });
    if (fallback.length > 0) {
    setCache(cacheKey, { source: 'fallback_market', items: fallback }, 30 * 1000);
    }
    return res.json({ ok: true, source: fallback.length > 0 ? 'fallback_market' : 'none', items: fallback });
  } catch (e) {
    console.error('signals fallback error:', e.message);
    return res.status(500).json({ ok: false, error: e.message || 'signals_error', items: [] });
  }
});

// Create a new signal (Postgres)
app.post('/api/signals', async (req, res) => {
  try {
    const sql = getNeonSql();
    if (!sql) return res.status(500).json({ ok: false, error: 'db_unavailable' });

    await ensureSignalsTable(sql);

    const botSecret = process.env.SITE_BOT_TOKEN || process.env.SIGNALS_SHARED_SECRET || process.env.SIGNAL_BOT_SECRET;
    const requestKey = (req.headers['x-bot-key'] || req.headers['x-bot-token'] || '').toString();
    const sessionUser = getSessionUser(req);
    const isBot = Boolean(botSecret && requestKey && requestKey === botSecret);
    const isAdmin = Boolean(sessionUser?.isAdmin);
    if (!isBot && !isAdmin) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }

    const body = req.body || {};
    const rawSymbolInput = body.symbol || body.displaySymbol || body.display_symbol || '';
    if (!rawSymbolInput) return res.status(400).json({ ok: false, error: 'missing_symbol' });
    const assetMeta = await resolveAssetMeta(rawSymbolInput);
    if (!assetMeta) return res.status(400).json({ ok: false, error: 'unknown_symbol' });

    const symbol = assetMeta.symbol;
    const displaySymbol = String(body.displaySymbol || body.display_symbol || assetMeta.displaySymbol || symbol).trim().toUpperCase();
    const type = String(body.type || '').toUpperCase().includes('SELL') ? 'SELL' : 'BUY';
    const assetType = String(assetMeta.assetType || body.assetType || body.asset_type || 'equity').toLowerCase();
    const assetName = assetMeta.name || displaySymbol;
    const signalStrength = body.signalStrength || body.signal_strength || null;
    let priceValue = null;
    if (body.price != null && body.price !== '') {
      const parsedPrice = Number(body.price);
      priceValue = Number.isFinite(parsedPrice) ? parsedPrice : null;
    }
    const rawStatus = body.status ? String(body.status).toLowerCase() : 'active';
    const normalizedStatus = ['active', 'pending', 'completed', 'closed'].includes(rawStatus) ? rawStatus : 'active';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const performance = typeof body.performance === 'string' ? body.performance : '';

    const timeframesInput = body.timeframes && typeof body.timeframes === 'object' ? body.timeframes : parseMaybeJson(body.recommendations);
    const entryInput = body.entry && typeof body.entry === 'object' ? body.entry : undefined;
    const targetsInput = Array.isArray(body.targets) ? body.targets : undefined;
    const stopInput = body.stop && typeof body.stop === 'object' ? body.stop : undefined;
    const confidence = body.confidence ?? (body.details && body.details.confidence);
    const score = body.score ?? (body.details && body.details.score);
    const chartUrl = body.chartUrl || body.chart_url || (body.details && body.details.chart_url);

    const parsedDetails = parseMaybeJson(body.details);
    const baseDetails = parsedDetails && typeof parsedDetails === 'object'
      ? { ...parsedDetails }
      : (body.details && typeof body.details === 'object' ? { ...body.details } : {});

    if (timeframesInput && typeof timeframesInput === 'object') baseDetails.timeframes = timeframesInput;
    if (entryInput) baseDetails.entry = entryInput;
    if (targetsInput) baseDetails.targets = targetsInput;
    if (stopInput) baseDetails.stop = stopInput;
    if (confidence != null && baseDetails.confidence == null) baseDetails.confidence = confidence;
    if (score != null && baseDetails.score == null) baseDetails.score = score;
    if (chartUrl && !baseDetails.chart_url) baseDetails.chart_url = chartUrl;
    if (!baseDetails.asset_type) baseDetails.asset_type = assetType;
    if (!baseDetails.asset_name && assetName) baseDetails.asset_name = assetName;
    if (signalStrength && !baseDetails.signal_strength) baseDetails.signal_strength = signalStrength;
    if (!baseDetails.displaySymbol) baseDetails.displaySymbol = displaySymbol;
    if (!baseDetails.rawSymbol) baseDetails.rawSymbol = symbol;
    if (!baseDetails.symbol_meta) baseDetails.symbol_meta = assetMeta;
    if (!baseDetails.logo_url && assetMeta.logo) baseDetails.logo_url = assetMeta.logo;
    if (!baseDetails.logoUrl && assetMeta.logo) baseDetails.logoUrl = assetMeta.logo;
    if (description && !baseDetails.summary) baseDetails.summary = description;
    if (body.timestamp && !baseDetails.posted_at) baseDetails.posted_at = body.timestamp;

    const recommendationsRaw = (() => {
      if (typeof body.recommendations === 'string') return body.recommendations;
      if (body.recommendations && typeof body.recommendations === 'object') return JSON.stringify(body.recommendations);
      if (timeframesInput && typeof timeframesInput === 'object') return JSON.stringify(timeframesInput);
      return description;
    })();

    const detailsJson = Object.keys(baseDetails).length > 0 ? JSON.stringify(baseDetails) : null;
    let timestampValue = body.timestamp ? new Date(body.timestamp) : new Date();
    if (Number.isNaN(timestampValue.getTime())) timestampValue = new Date();

    const rows = await sql`
      INSERT INTO signals (
        symbol,
        display_symbol,
        signal_type,
        price,
        signal_strength,
        asset_type,
        recommendations,
        performance,
        details,
        status,
        timestamp
      )
      VALUES (
        ${symbol},
        ${displaySymbol},
        ${type},
        ${priceValue},
        ${signalStrength || null},
        ${assetType || 'equity'},
        ${recommendationsRaw || ''},
        ${performance || ''},
        ${detailsJson},
        ${normalizedStatus},
        ${timestampValue}
      )
      RETURNING id, symbol, display_symbol, signal_type, price, timestamp, signal_strength, asset_type, recommendations, performance, details, status`;

    const inserted = rows?.[0];
    await pruneOldSignals(sql, Number(process.env.SIGNALS_PRUNE_DAYS || 10));
    invalidateSignalsCache();
    const formatted = formatSignalRow(inserted);
    broadcastSignalAdded(formatted || inserted);
    return res.json({ ok: true, item: formatted || inserted });
  } catch (e) {
    console.error('signals insert error:', e);
    return res.status(500).json({ ok: false, error: e?.message || 'insert_error' });
  }
});

app.patch('/api/signals/:id', async (req, res) => {
  try {
    const sql = getNeonSql();
    if (!sql) return res.status(500).json({ ok: false, error: 'db_unavailable' });

    await ensureSignalsTable(sql);

    const signalId = Number.parseInt(String(req.params.id || ''), 10);
    if (!Number.isFinite(signalId)) {
      return res.status(400).json({ ok: false, error: 'invalid_id' });
    }

    const botSecret = process.env.SITE_BOT_TOKEN || process.env.SIGNALS_SHARED_SECRET || process.env.SIGNAL_BOT_SECRET;
    const requestKey = (req.headers['x-bot-key'] || req.headers['x-bot-token'] || '').toString();
    const sessionUser = getSessionUser(req);
    const isBot = Boolean(botSecret && requestKey && requestKey === botSecret);
    const isAdmin = Boolean(sessionUser?.isAdmin);
    if (!isBot && !isAdmin) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }

    const body = req.body || {};

    // Build dynamic SET clause safely (Neon sql does not support sql.join)
    const setParts = [];
    const params = [];
    let idx = 1;

    if (typeof body.status === 'string' && body.status.trim()) {
      setParts.push(`status = $${idx++}`);
      params.push(body.status.trim().toLowerCase());
    }

    if (typeof body.performance === 'string' && body.performance.trim()) {
      setParts.push(`performance = $${idx++}`);
      params.push(body.performance.trim().toLowerCase());
    }

    if (body.details && typeof body.details === 'object') {
      setParts.push(`details = $${idx++}::jsonb`);
      params.push(JSON.stringify(body.details));
    }

    if (setParts.length === 0) {
      return res.json({ ok: true, unchanged: true });
    }

    const setClause = setParts.join(', ');
    const rows = await sql.unsafe(
      `UPDATE signals
       SET ${setClause}
       WHERE id = $${idx}
       RETURNING id, symbol, display_symbol, signal_type, price, timestamp, signal_strength, asset_type, recommendations, performance, details, status`,
      [...params, signalId]
    );

    invalidateSignalsCache();

    const updated = rows?.[0];
    if (!updated) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }

    return res.json({ ok: true, item: formatSignalRow(updated) });
  } catch (e) {
    console.error('signals update error:', e);
    return res.status(500).json({ ok: false, error: e?.message || 'update_failed' });
  }
});

// Delete signal (admin only)
app.delete('/api/signals/:id', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u || !u.isAdmin) return res.status(403).json({ ok: false, error: 'forbidden' });
    const id = Number(req.params.id);
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db_unavailable' });
    await sql`DELETE FROM signals WHERE id=${id}`;
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'delete_error' });
  }
});

// Admin-only: seed a few example signals
app.post('/api/signals/seed', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u || !u.isAdmin) return res.status(403).json({ ok: false, error: 'forbidden' });
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db_unavailable' });
    await ensureSignalsTable(sql);
    const rows = [
      { s: 'BTC', t: 'BUY', p: 68250, d: 'Breakout above 68k with rising volume' },
      { s: 'ETH', t: 'BUY', p: 3650, d: 'Strong L2 activity; funding neutral' },
      { s: 'AAPL', t: 'SELL', p: 237.4, d: 'Gap-fill setup; RSI cooling' },
      { s: 'NVDA', t: 'BUY', p: 132.8, d: 'Pullback to 20D MA; buyers defending' },
    ];
    for (const r of rows) {
      const assetType = /BTC|ETH|SOL|ADA|DOGE|BNB|XRP|DOT|AVAX|LINK/i.test(r.s) ? 'crypto' : 'equity';
      const bullish = r.t.toUpperCase() !== 'SELL';
      const targets = [{
        label: 'Target 1',
        price: bullish ? r.p * 1.04 : r.p * 0.96,
        pct: bullish ? 4 : -4,
      }];
      const details = {
        summary: r.d,
        asset_type: assetType,
        signal_strength: bullish ? '🟡 BUY' : '🔴 SELL',
        timeframes: { '1h': bullish ? 'BUY' : 'SELL', '4h': bullish ? 'BUY' : 'SELL' },
        targets,
        stop: { price: bullish ? r.p * 0.97 : r.p * 1.03, pct: bullish ? -3 : 3 },
        chart_url: assetType === 'crypto' ? `https://www.tradingview.com/symbols/${r.s}USD/` : `https://www.tradingview.com/symbols/${r.s}/`,
        posted_at: new Date().toISOString(),
      };
      const inserted = await sql`
        INSERT INTO signals (
          symbol,
          display_symbol,
          signal_type,
          price,
          signal_strength,
          asset_type,
          recommendations,
          performance,
          details,
          status
        )
        VALUES (
          ${r.s},
          ${r.s},
          ${r.t},
          ${r.p},
          ${details.signal_strength},
          ${assetType},
          ${JSON.stringify(details.timeframes)},
          ${''},
          ${JSON.stringify(details)},
          ${'active'}
        )
        RETURNING id, symbol, display_symbol, signal_type, price, timestamp, signal_strength, asset_type, recommendations, performance, details, status`;
      if (inserted?.[0]) {
        const formatted = formatSignalRow(inserted[0]);
        broadcastSignalAdded(formatted || inserted[0]);
      }
    }
    return res.json({ ok: true, inserted: rows.length });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'seed_error' });
  }
});

function parseSession(req) {
  const token = req.cookies?.joat_session;
  if (!token) return null;
  try {
    return jwt.verify(token, SESSION_SECRET);
  } catch {
    return null;
  }
}

app.get('/api/auth/discord/login', (req, res) => {
  if (!DISCORD_CLIENT_ID) return res.status(500).send('Missing DISCORD_CLIENT_ID');
  // Get return URL from query param or default to dashboard
  const returnTo = req.query.returnTo || '/dashboard';
  // Encode return URL in state parameter for OAuth flow
  const state = Buffer.from(JSON.stringify({ returnTo })).toString('base64');
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    response_type: 'code',
    redirect_uri: DISCORD_REDIRECT_URI,
    scope: 'identify',
    prompt: 'consent',
    state: state,
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

app.get('/api/auth/discord/callback', async (req, res) => {
  const { code, error, state } = req.query;
  if (error || !code) {
    // User cancelled or missing code: go back to sign-in page
    return res.redirect(`${FRONTEND_URL}/signin?error=${encodeURIComponent(error || 'cancelled')}`);
  }
  // Decode return URL from state parameter
  let returnTo = '/dashboard';
  try {
    if (state) {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
      if (decoded.returnTo) {
        returnTo = decoded.returnTo;
      }
    }
  } catch (e) {
    console.warn('Failed to decode OAuth state:', e);
  }
  try {
    const body = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: DISCORD_REDIRECT_URI,
    });
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      console.error('Discord token error:', t);
      return res.status(500).send('OAuth failed');
    }
    const tokenJson = await tokenRes.json();
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `${tokenJson.token_type} ${tokenJson.access_token}` },
    });
    const user = await userRes.json();

    let isSubscriber = false;
    let plan = 'Free';
    let isAdmin = false;

    // Role mapping via Discord guild membership
    const ROLE_IDS = {
      ADMIN: '1401732626041274469',
      ELITE: '1402067019091677244',
      PRO:   '1402061825461190656',
      CORE:  '1430718778785927239',
    };

    try {
      if (process.env.DISCORD_BOT_TOKEN && process.env.GUILD_ID) {
        const memRes = await fetch(`https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/members/${user.id}`, {
          headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        });
        if (memRes.ok) {
          const member = await memRes.json();
          const roles = new Set(member.roles || []);
          if (roles.has(ROLE_IDS.ADMIN)) {
            isAdmin = true;
            isSubscriber = true;
            plan = 'Elite';
          } else if (roles.has(ROLE_IDS.ELITE)) {
            isSubscriber = true;
            plan = 'Elite';
          } else if (roles.has(ROLE_IDS.PRO)) {
            isSubscriber = true;
            plan = 'Pro';
          } else if (roles.has(ROLE_IDS.CORE)) {
            isSubscriber = true;
            plan = 'Core';
          }
        } else {
          console.warn('Guild member lookup failed:', memRes.status);
        }
      }
    } catch (e) {
      console.warn('Guild member lookup error:', e.message);
    }

    setSessionCookie(res, {
      userId: user.id,
      username: user.username,
      avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : undefined,
      discordId: user.id,
      discordUsername: `${user.username}`,
      discordAvatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : undefined,
      isSubscriber,
      plan,
      isAdmin,
    });
    // Redirect to the return URL (or dashboard by default)
    res.redirect(`${FRONTEND_URL}${returnTo}`);
  } catch (e) {
    console.error('OAuth callback error:', e);
    res.status(500).send('OAuth error');
  }
});

app.get('/api/session', async (req, res) => {
  const sess = parseSession(req);
  if (!sess) return res.json({ session: null });
  // Merge authoritative fields from DB (username/plan/is_admin) if available
  try {
    const sql = getNeonSql();
    if (sql) {
      await ensureUsers(sql);
      const rows = await sql`SELECT username, plan, is_admin, trial_started_at, trial_ends_at, trial_used FROM users WHERE discord_id=${sess.discordId}`;
      if (rows && rows[0]) {
        const dbUser = rows[0];
        const now = Date.now();
        const ends = dbUser.trial_ends_at ? new Date(dbUser.trial_ends_at).getTime() : 0;
        const trialActive = !!ends && ends > now;
        const merged = {
          ...sess,
          username: dbUser.username || sess.username,
          plan: (() => {
            const plan = dbUser.plan || sess.plan;
            if ((!plan || plan === 'Free') && trialActive) return 'Pro';
            return plan;
          })(),
          isAdmin: dbUser.is_admin ?? sess.isAdmin,
          trialActive,
          trialEndsAt: ends || null,
        };
        // Re-issue cookie so it persists across reloads
        setSessionCookie(res, merged);
        return res.json({ session: merged });
      }
    }
  } catch {}
  return res.json({ session: sess });
});

// Watchlist (Postgres)
app.get('/api/watchlist', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const sql = getNeonSql();
    if (!sql) return res.json({ ok: true, items: [] });
    await ensureWatchlist(sql); await ensureUsers(sql);
    const rows = await sql`SELECT symbol, position, asset_type, display_symbol, display_name FROM watchlist WHERE user_id=${u.userId} ORDER BY position ASC`;
    const items = [];
    for (const row of rows || []) {
      const symbol = String(row.symbol || '').toUpperCase();
      if (!symbol) continue;
      let assetType = row.asset_type || null;
      let displaySymbol = row.display_symbol ? String(row.display_symbol).toUpperCase() : symbol;
      let displayName = row.display_name || symbol;
      if (!assetType || !displayName) {
        try {
          const meta = await resolveAssetMeta(symbol);
          if (!meta) {
            await sql`DELETE FROM watchlist WHERE user_id=${u.userId} AND symbol=${symbol}`;
            continue;
          }
          assetType = meta.assetType || assetType;
          displaySymbol = meta.displaySymbol || displaySymbol;
          displayName = meta.name || displayName;
          await sql`UPDATE watchlist SET asset_type=${assetType}, display_symbol=${displaySymbol}, display_name=${displayName} WHERE user_id=${u.userId} AND symbol=${symbol}`;
        } catch {}
      }
      items.push({
        symbol,
        position: Number.isFinite(row.position) ? Number(row.position) : 0,
        asset_type: assetType,
        display_symbol: displaySymbol,
        display_name: displayName,
      });
    }
    return res.json({ ok: true, items });
  } catch (e) {
    return res.json({ ok: true, items: [] });
  }
});

app.post('/api/watchlist', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const { symbol, position } = req.body || {};
    if (!symbol) return res.status(400).json({ ok: false, error: 'bad_symbol' });
    const sql = getNeonSql();
    if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    await ensureWatchlist(sql);

    const meta = await resolveAssetMeta(symbol);
    if (!meta) return res.status(400).json({ ok: false, error: 'unknown_symbol' });

    let pos = Number(position);
    if (!Number.isFinite(pos) || pos < 0) {
      try {
        const rows = await sql`SELECT COALESCE(MAX(position), -1) AS max_pos FROM watchlist WHERE user_id=${u.userId}`;
        const maxPos = rows && rows[0] ? Number(rows[0].max_pos) : -1;
        pos = Number.isFinite(maxPos) ? maxPos + 1 : 0;
      } catch {
        pos = 0;
      }
    }

    const normalizedSymbol = meta.symbol;
    const assetType = meta.assetType || null;
    const displaySymbol = meta.displaySymbol || normalizedSymbol;
    const displayName = meta.name || normalizedSymbol;

    await sql`INSERT INTO watchlist (user_id, symbol, position, asset_type, display_symbol, display_name)
              VALUES (${u.userId}, ${normalizedSymbol}, ${pos}, ${assetType}, ${displaySymbol}, ${displayName})
              ON CONFLICT (user_id, symbol) DO UPDATE SET position = EXCLUDED.position, asset_type = EXCLUDED.asset_type, display_symbol = EXCLUDED.display_symbol, display_name = EXCLUDED.display_name`;

    return res.json({ ok: true, item: { symbol: normalizedSymbol, position: pos, asset_type: assetType, display_symbol: displaySymbol, display_name: displayName }, meta });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'err' });
  }
});

app.delete('/api/watchlist', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const { symbol } = req.body || {};
    const sql = getNeonSql();
    if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    let normalizedSymbol = '';
    if (symbol) {
      try {
        const meta = await resolveAssetMeta(symbol);
        normalizedSymbol = meta?.symbol || String(symbol).trim().toUpperCase();
      } catch {
        normalizedSymbol = String(symbol).trim().toUpperCase();
      }
    }
    if (!normalizedSymbol) return res.status(400).json({ ok: false, error: 'bad_symbol' });
    await sql`DELETE FROM watchlist WHERE user_id=${u.userId} AND symbol=${normalizedSymbol}`;
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'err' });
  }
});

// Alerts (Postgres)
app.get('/api/alerts', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const sql = getNeonSql(); if (!sql) return res.json({ ok: true, items: [] });
    await ensureAlerts(sql); await ensureUsers(sql);
    const rows = await sql`SELECT id, symbol, type, direction, threshold, window_tf, cooldown, active, created_at, asset_type, display_symbol, display_name, last_triggered_at
                           FROM alerts WHERE user_id=${u.userId} ORDER BY created_at DESC`;
    const items = [];
    for (const row of rows || []) {
      const symbol = String(row.symbol || '').toUpperCase();
      if (!symbol) continue;
      let assetType = row.asset_type || null;
      let displaySymbol = row.display_symbol ? String(row.display_symbol).toUpperCase() : symbol;
      let displayName = row.display_name || symbol;
      if (!assetType || !displayName) {
        try {
          const meta = await resolveAssetMeta(symbol);
          if (meta) {
            assetType = meta.assetType || assetType;
            displaySymbol = meta.displaySymbol || displaySymbol;
            displayName = meta.name || displayName;
            await sql`UPDATE alerts SET asset_type=${assetType}, display_symbol=${displaySymbol}, display_name=${displayName}
                      WHERE id=${row.id} AND user_id=${u.userId}`;
          }
        } catch {}
      }
      items.push({
        id: row.id,
        symbol,
        type: row.type,
        direction: row.direction,
        threshold: row.threshold,
        window_tf: row.window_tf,
        cooldown: row.cooldown,
        active: row.active,
        created_at: row.created_at,
        asset_type: assetType,
        display_symbol: displaySymbol,
        display_name: displayName,
        last_triggered_at: row.last_triggered_at || null,
      });
    }
    return res.json({ ok: true, items });
  } catch (e) { return res.json({ ok: true, items: [] }); }
});

app.post('/api/alerts', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const { symbol, type, direction, threshold, windowTf, cooldown, active } = req.body || {};
    if (!symbol || !type || !direction) return res.status(400).json({ ok: false, error: 'bad_input' });
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    await ensureAlerts(sql);
    const meta = await resolveAssetMeta(symbol);
    if (!meta) return res.status(400).json({ ok: false, error: 'unknown_symbol' });

    const normalizedSymbol = meta.symbol;
    const assetType = meta.assetType || null;
    const displaySymbol = meta.displaySymbol || normalizedSymbol;
    const displayName = meta.name || normalizedSymbol;

    const normalizedType = String(type).toLowerCase() === '%' ? '%' : 'price';
    const normalizedDirection = String(direction) === '<=' ? '<=' : '>=';
    const thresholdValue = threshold != null && threshold !== '' && Number.isFinite(Number(threshold)) ? Number(threshold) : null;
    const activeValue = active === false ? false : true;
    const rows = await sql`INSERT INTO alerts (user_id, symbol, type, direction, threshold, window_tf, cooldown, active, asset_type, display_symbol, display_name)
              VALUES (${u.userId}, ${normalizedSymbol}, ${normalizedType}, ${normalizedDirection}, ${thresholdValue}, ${windowTf ?? null}, ${cooldown ?? null}, ${activeValue}, ${assetType}, ${displaySymbol}, ${displayName})
              RETURNING id, symbol, type, direction, threshold, window_tf, cooldown, active, created_at, asset_type, display_symbol, display_name, last_triggered_at`;
    const item = rows?.[0] || null;
    return res.json({ ok: true, item, meta });
  } catch (e) { return res.status(500).json({ ok: false, error: e?.message || 'err' }); }
});

app.patch('/api/alerts/:id', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const idParam = String(req.params.id || '').trim();
    if (!idParam || idParam === 'undefined' || idParam === 'null' || isNaN(Number(idParam))) {
      return res.status(400).json({ ok: false, error: 'invalid_id' });
    }
    const id = Number(idParam);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'invalid_id' });
    }
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    await ensureAlerts(sql);
    const { symbol, type, direction, threshold, windowTf, cooldown, active } = req.body || {};

    // First verify the alert exists and belongs to this user
    const rows = await sql`SELECT symbol, type, direction, threshold, window_tf, cooldown, active, asset_type, display_symbol, display_name
                            FROM alerts
                            WHERE id=${id} AND user_id=${u.userId}
                            LIMIT 1`;
    if (!rows || !rows.length || !rows[0]) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }
    const current = rows[0];

    let symbolValue = String(current.symbol || '').toUpperCase();
    let assetTypeValue = current.asset_type || null;
    let displaySymbolValue = current.display_symbol ? String(current.display_symbol).toUpperCase() : symbolValue;
    let displayNameValue = current.display_name || symbolValue;
    if (symbol) {
      const meta = await resolveAssetMeta(symbol);
      if (!meta) return res.status(400).json({ ok: false, error: 'unknown_symbol' });
      symbolValue = meta.symbol;
      assetTypeValue = meta.assetType || assetTypeValue;
      displaySymbolValue = meta.displaySymbol || symbolValue;
      displayNameValue = meta.name || displayNameValue;
    }

    let typeValue = current.type || 'price';
    if (type) typeValue = String(type).toLowerCase() === '%' ? '%' : 'price';

    let directionValue = current.direction || '>=';
    if (direction) directionValue = String(direction) === '<=' ? '<=' : '>=';

    let thresholdValue = current.threshold;
    if (threshold !== undefined) {
      const num = Number(threshold);
      thresholdValue = Number.isFinite(num) ? num : null;
    }

    let windowValue = windowTf !== undefined ? windowTf : current.window_tf;
    let cooldownValue = cooldown !== undefined ? cooldown : current.cooldown;

    let activeValue = current.active;
    if (active !== undefined) activeValue = active === false ? false : true;

    // Perform the UPDATE with explicit WHERE clause to ensure only one row is affected
    const updateResult = await sql`UPDATE alerts SET
                symbol=${symbolValue},
                asset_type=${assetTypeValue},
                display_symbol=${displaySymbolValue},
                display_name=${displayNameValue},
                type=${typeValue},
                direction=${directionValue},
                threshold=${thresholdValue},
                window_tf=${windowValue},
                cooldown=${cooldownValue},
                active=${activeValue}
              WHERE id=${id} AND user_id=${u.userId}`;
    
    // Verify only one row was affected (safety check)
    if (updateResult && updateResult.count !== undefined && updateResult.count > 1) {
      console.error(`[Alert Update] WARNING: Updated ${updateResult.count} rows for alert ID ${id}, user ${u.userId}`);
    }
    
    // Verify the update succeeded by fetching the updated row
    const verifyRows = await sql`SELECT id, active FROM alerts WHERE id=${id} AND user_id=${u.userId} LIMIT 1`;
    if (!verifyRows || !verifyRows.length || verifyRows[0].active !== activeValue) {
      console.error(`[Alert Update] WARNING: Update verification failed for alert ID ${id}`);
      return res.status(500).json({ ok: false, error: 'update_verification_failed' });
    }
    
    return res.json({ ok: true, id, active: activeValue });
  } catch (e) { return res.status(500).json({ ok: false, error: e?.message || 'err' }); }
});

app.delete('/api/alerts/:id', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const id = Number(req.params.id);
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    await sql`DELETE FROM alerts WHERE id=${id} AND user_id=${u.userId}`;
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ ok: false, error: e?.message || 'err' }); }
});

// Portfolio positions (Postgres)
app.get('/api/portfolio', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const sql = getNeonSql(); if (!sql) return res.json({ ok: true, items: [] });
    await ensurePortfolio(sql);
    const rows = await sql`SELECT id, symbol, quantity, cost_basis, target_price, risk, timeframe, notes, confidence, strategy, created_at, updated_at
                           FROM portfolio_positions WHERE user_id=${u.userId} ORDER BY created_at DESC`;
    return res.json({ ok: true, items: rows });
  } catch (e) {
    return res.json({ ok: true, items: [] });
  }
});

app.post('/api/portfolio', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const { symbol, quantity, costBasis, targetPrice, risk, timeframe, notes, confidence, strategy } = req.body || {};
    if (!symbol || typeof symbol !== 'string') return res.status(400).json({ ok: false, error: 'missing_symbol' });
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    await ensurePortfolio(sql);
    const rows = await sql`INSERT INTO portfolio_positions (user_id, symbol, quantity, cost_basis, target_price, risk, timeframe, notes, confidence, strategy)
                           VALUES (${u.userId}, ${symbol.trim().toUpperCase()}, ${quantity != null ? Number(quantity) : null},
                                   ${costBasis != null ? Number(costBasis) : null}, ${targetPrice != null ? Number(targetPrice) : null},
                                   ${risk || null}, ${timeframe || null}, ${notes || null},
                                   ${confidence != null ? Number(confidence) : null}, ${strategy || null})
                           RETURNING id`;
    return res.json({ ok: true, id: rows?.[0]?.id });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'err' });
  }
});

app.patch('/api/portfolio/:id', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const id = Number(req.params.id);
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    await ensurePortfolio(sql);
    const { symbol, quantity, costBasis, targetPrice, risk, timeframe, notes, confidence, strategy } = req.body || {};
    await sql`UPDATE portfolio_positions SET
                symbol = COALESCE(${symbol ? symbol.trim().toUpperCase() : null}, symbol),
                quantity = ${quantity != null ? Number(quantity) : null},
                cost_basis = ${costBasis != null ? Number(costBasis) : null},
                target_price = ${targetPrice != null ? Number(targetPrice) : null},
                risk = ${risk ?? null},
                timeframe = ${timeframe ?? null},
                notes = ${notes ?? null},
                confidence = ${confidence != null ? Number(confidence) : null},
                strategy = ${strategy ?? null},
                updated_at = now()
              WHERE id=${id} AND user_id=${u.userId}`;
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'err' });
  }
});

app.delete('/api/portfolio/:id', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const id = Number(req.params.id);
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    await ensurePortfolio(sql);
    await sql`DELETE FROM portfolio_positions WHERE id=${id} AND user_id=${u.userId}`;
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'err' });
  }
});

// DB health: show Postgres version (Neon)
app.get('/api/db/version', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) return res.status(500).json({ ok: false, error: 'missing_DATABASE_URL' });
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT version()`;
    const version = rows?.[0]?.version || 'unknown';
    return res.json({ ok: true, version });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'db_error' });
  }
});

// ----------------------------
// API: Health Checks
// ----------------------------
app.get('/api/health', async (req, res) => {
  const uptimeSec = Math.floor(process.uptime());
  const mem = process.memoryUsage ? process.memoryUsage() : {};
  const rss = typeof mem.rss === 'number' ? mem.rss : undefined;
  const heapUsed = typeof mem.heapUsed === 'number' ? mem.heapUsed : undefined;
  let db = 'unavailable';
  try {
    const sql = getNeonSql();
    if (sql) {
      await sql`SELECT 1`;
      db = 'ok';
    }
  } catch (e) {
    db = 'error';
  }
  return res.json({ ok: true, status: 'ok', uptimeSec, rss, heapUsed, db });
});

app.get('/api/health/db', async (req, res) => {
  try {
    const sql = getNeonSql();
    if (!sql) return res.status(503).json({ ok: false, status: 'unavailable' });
    await sql`SELECT 1`;
    return res.json({ ok: true, status: 'ok' });
  } catch (e) {
    return res.status(503).json({ ok: false, status: 'error', error: e?.message || 'db_check_failed' });
  }
});

// Update profile fields (e.g., username) and reissue session cookie
app.post('/api/profile', (req, res) => {
  const current = parseSession(req);
  if (!current) return res.status(401).json({ error: 'Not authenticated' });

  const { username } = req.body || {};
  if (typeof username !== 'string' || username.trim().length < 2 || username.length > 32) {
    return res.status(400).json({ error: 'Invalid username' });
  }

  const updated = {
    ...current,
    username: username.trim(),
  };
  setSessionCookie(res, updated);
  (async () => {
    try {
      const sql = getNeonSql();
      if (sql) {
        await ensureUsers(sql);
        await sql`INSERT INTO users (discord_id, username, plan, is_admin)
                  VALUES (${current.discordId}, ${updated.username}, ${current.plan || 'Free'}, ${!!current.isAdmin})
                  ON CONFLICT (discord_id) DO UPDATE SET username = EXCLUDED.username, updated_at = now()`;
      }
    } catch {}
  })();
  return res.json({ session: updated });
});

app.get('/api/profile/trading', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const sql = getNeonSql(); if (!sql) return res.json({ ok: true, profile: null });
    await ensureUserProfile(sql);
    const rows = await sql`SELECT skill_level, risk_appetite, focus, trading_style, goals FROM user_profile WHERE user_id=${u.userId} LIMIT 1`;
    const row = rows?.[0] || null;
    return res.json({ ok: true, profile: row ? {
      skillLevel: row.skill_level || 'Intermediate',
      riskAppetite: row.risk_appetite || 'Balanced',
      focus: row.focus || 'Both',
      tradingStyle: row.trading_style || 'Swing trading',
      goals: row.goals || 'Grow account steadily',
    } : null });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'profile_error' });
  }
});

app.post('/api/profile/trading', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const profile = req.body?.profile || {};
    const skill = typeof profile.skillLevel === 'string' ? profile.skillLevel : 'Intermediate';
    const risk = typeof profile.riskAppetite === 'string' ? profile.riskAppetite : 'Balanced';
    const focus = typeof profile.focus === 'string' ? profile.focus : 'Both';
    const style = typeof profile.tradingStyle === 'string' ? profile.tradingStyle : 'Swing trading';
    const goals = typeof profile.goals === 'string' ? profile.goals : 'Grow account steadily';
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    await ensureUserProfile(sql);
    await sql`INSERT INTO user_profile (user_id, skill_level, risk_appetite, focus, trading_style, goals)
              VALUES (${u.userId}, ${skill}, ${risk}, ${focus}, ${style}, ${goals})
              ON CONFLICT (user_id) DO UPDATE SET
                skill_level = EXCLUDED.skill_level,
                risk_appetite = EXCLUDED.risk_appetite,
                focus = EXCLUDED.focus,
                trading_style = EXCLUDED.trading_style,
                goals = EXCLUDED.goals,
                updated_at = now()`;
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'profile_error' });
  }
});

// ----------------------------
// API: Preferences (per-user)
// ----------------------------
app.get('/api/preferences', async (req, res) => {
  try {
    let u = getSessionUser(req);
    // For dev login, check if userId is in request header or body
    if (!u && req.headers['x-dev-user-id']) {
      const devUserId = req.headers['x-dev-user-id'];
      if (typeof devUserId === 'string' && devUserId.startsWith('dev-')) {
        u = { userId: devUserId, username: devUserId, plan: devUserId.replace('dev-', ''), isAdmin: false };
      }
    }
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const sql = getNeonSql(); if (!sql) return res.json({ ok: true, preferences: {} });
    await ensureUsers(sql);
    // For dev users, use userId as discord_id; for real users, use discord_id (same)
    const lookupKey = u.userId;
    const rows = await sql`SELECT preferences FROM users WHERE discord_id=${lookupKey}`;
    const prefs = rows?.[0]?.preferences || {};
    return res.json({ ok: true, preferences: prefs });
  } catch (e) {
    return res.json({ ok: true, preferences: {} });
  }
});

app.post('/api/preferences', async (req, res) => {
  try {
    let u = getSessionUser(req);
    // For dev login, check if userId is in request header
    if (!u && req.headers['x-dev-user-id']) {
      const devUserId = req.headers['x-dev-user-id'];
      if (typeof devUserId === 'string' && devUserId.startsWith('dev-')) {
        u = { userId: devUserId, username: devUserId, plan: devUserId.replace('dev-', ''), isAdmin: false };
      }
    }
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const { preferences } = req.body || {};
    const prefs = (preferences && typeof preferences === 'object') ? preferences : {};
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    await ensureUsers(sql);
    const lookupKey = u.userId;

    const existingRows = await sql`SELECT preferences FROM users WHERE discord_id=${lookupKey}`;
    const existingPrefsRaw = existingRows?.[0]?.preferences;
    const existingPrefs = (existingPrefsRaw && typeof existingPrefsRaw === 'object') ? existingPrefsRaw : {};

    const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

    const mergedPrefs = {
      ...existingPrefs,
      ...prefs,
    };

    const mergeSection = (key) => {
      if (!isPlainObject(existingPrefs[key]) && !isPlainObject(prefs[key])) return;
      mergedPrefs[key] = {
        ...(isPlainObject(existingPrefs[key]) ? existingPrefs[key] : {}),
        ...(isPlainObject(prefs[key]) ? prefs[key] : {}),
      };
    };

    ['general', 'notifications', 'privacy', 'mentor'].forEach(mergeSection);

    const prefsJson = JSON.stringify(mergedPrefs);
    // For dev users, use userId as discord_id; for real users, use discord_id (same)
    await sql`INSERT INTO users (discord_id, preferences)
              VALUES (${lookupKey}, ${prefsJson}::jsonb)
              ON CONFLICT (discord_id) DO UPDATE SET preferences = ${prefsJson}::jsonb, updated_at = now()`;
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ ok: false, error: e?.message || 'err' }); }
});

app.post('/api/account/erase', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const sql = getNeonSql();
    if (!sql) return res.status(500).json({ ok: false, error: 'db' });

    await deleteUserData(sql, u.userId);

    const erasedAt = new Date();
    const isoTimestamp = erasedAt.toISOString();
    const prettyTimestamp = erasedAt.toLocaleString('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });

    const dmMessage = `Hi — we erased your Jack Of All Trades data on ${prettyTimestamp}. If this wasn't you, contact support immediately.`;
    try {
      await sendDiscordDM(u.userId, dmMessage);
    } catch (dmErr) {
      console.warn('[Account] Failed to send erase DM:', dmErr?.message || dmErr);
    }

    broadcastUserNotification({
      userId: u.userId,
      level: 'warning',
      title: 'Account data erased',
      body: 'All saved alerts, mentor conversations, watchlists, and portfolio entries have been removed.',
      actionLabel: 'Sign in again',
      actionHref: '/',
      meta: { erasedAt: isoTimestamp },
    });

    broadcastAccountDeleted({
      userId: u.userId,
      reason: 'self_service_delete',
      message: 'Your account data has been erased. Sign in again to start fresh.',
    });

    try {
      res.clearCookie('joat_session', {
        httpOnly: true,
        secure: COOKIE_SECURE,
        sameSite: 'lax',
      });
    } catch {}

    return res.json({ ok: true, erasedAt: isoTimestamp });
  } catch (e) {
    console.error('[Account] erase error:', e);
    return res.status(500).json({ ok: false, error: e?.message || 'account_erase_failed' });
  }
});

// ----------------------------
// API: User feedback / issues
// ----------------------------
app.post('/api/feedback', async (req, res) => {
  try {
    const u = getSessionUser(req);
    const sess = parseSession(req) || {};
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const sql = getNeonSql();
    if (!sql) return res.status(500).json({ ok: false, error: 'db' });

    await ensureUserFeedback(sql);
    await ensureUsers(sql);

    const body = req.body || {};
    const allowedCategories = ['bug', 'feature', 'billing', 'mentor', 'performance', 'other'];
    const allowedSeverities = ['low', 'medium', 'high', 'critical'];

    let category = typeof body.category === 'string' ? body.category.toLowerCase() : 'other';
    if (!allowedCategories.includes(category)) category = 'other';

    let severity = typeof body.severity === 'string' ? body.severity.toLowerCase() : 'medium';
    if (!allowedSeverities.includes(severity)) severity = 'medium';

    const titleRaw = typeof body.title === 'string' ? body.title.trim() : '';
    if (titleRaw.length < 4 || titleRaw.length > 160) {
      return res.status(400).json({ ok: false, error: 'invalid_title' });
    }

    const descriptionRaw = typeof body.description === 'string' ? body.description.trim() : '';
    if (descriptionRaw.length < 10) {
      return res.status(400).json({ ok: false, error: 'invalid_description' });
    }

    const reproSteps = typeof body.reproSteps === 'string' ? body.reproSteps.trim() : null;
    const attachmentUrl = typeof body.attachmentUrl === 'string' ? body.attachmentUrl.trim() : null;
    const includeDiagnostics = body.includeDiagnostics === true;
    const allowContact = body.allowContact !== false;

    const rows = await sql`INSERT INTO user_feedback (
        user_id, username, plan, category, severity, title, description, repro_steps, attachment_url, include_diagnostics, allow_contact
      ) VALUES (
        ${u.userId}, ${u.username || null}, ${u.plan || 'Free'}, ${category}, ${severity}, ${titleRaw}, ${descriptionRaw}, ${reproSteps}, ${attachmentUrl}, ${includeDiagnostics}, ${allowContact}
      ) RETURNING id, created_at`;

    const inserted = rows?.[0];
    const feedbackId = inserted?.id;

    // Notify admins
    let adminRows = [];
    try {
      adminRows = await sql`SELECT discord_id, username FROM users WHERE is_admin=true`;
    } catch (err) {
      console.warn('[Feedback] failed to load admins:', err?.message || err);
    }

    const adminSet = new Set();
    const severityLabel = severity.toUpperCase();
    const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
    const notifTitle = `New ${categoryLabel} feedback (${severityLabel})`;
    const authorName = u.username || sess.discordUsername || u.userId;
    const authorDiscord = sess.discordUsername ? `${sess.discordUsername}` : undefined;
    const notifBody = `${titleRaw}${descriptionRaw ? ` — ${descriptionRaw.slice(0, 140)}${descriptionRaw.length > 140 ? '…' : ''}` : ''}\nFrom: ${authorName}${authorDiscord ? ` (${authorDiscord})` : ''}`;
    const adminAction = feedbackId ? `/dashboard/admin?tab=feedback&id=${feedbackId}` : '/dashboard/admin?tab=feedback';
    const level = severity === 'critical' ? 'danger' : severity === 'high' ? 'warning' : 'info';

    for (const admin of adminRows || []) {
      const adminId = admin?.discord_id ? String(admin.discord_id) : '';
      if (!adminId || adminSet.has(adminId)) continue;
      adminSet.add(adminId);
      try {
        broadcastUserNotification({
          userId: adminId,
          level,
          title: notifTitle,
          body: notifBody,
          actionLabel: 'Review',
          actionHref: adminAction,
          meta: { feedbackId, category, severity, author: { id: u.userId, username: u.username || null, discordUsername: sess.discordUsername || null, plan: u.plan || null } },
        });
      } catch (err) {
        console.warn('[Feedback] broadcast to admin failed:', err?.message || err);
      }
    }

    // Discord webhook notification (optional)
    try {
      const baseUrl = (FRONTEND_URL || '').replace(/\/$/, '');
      const feedbackUrl = feedbackId ? `${baseUrl}/dashboard/admin?tab=feedback&id=${feedbackId}` : `${baseUrl}/dashboard/admin?tab=feedback`;
      const discordDescription = [
        `**Title:** ${titleRaw}`,
        `**From:** ${u.username || sess.discordUsername || u.userId} (Plan: ${u.plan || sess.plan || 'Free'})`,
        `**Discord:** ${sess.discordUsername || 'unknown'} (ID: ${u.userId})`,
        `**Severity:** ${severityLabel}`,
        `**Category:** ${categoryLabel}`,
        '',
        descriptionRaw.slice(0, 1800),
      ].join('\n');
      await sendDiscordFeedbackMessage({
        title: `New ${severityLabel} ${categoryLabel} feedback`,
        description: discordDescription,
        severity,
        url: feedbackUrl,
      });
    } catch (err) {
      console.warn('[Feedback] webhook error:', err?.message || err);
    }

    return res.json({ ok: true, id: feedbackId });
  } catch (e) {
    console.error('[Feedback] submit error:', e);
    return res.status(500).json({ ok: false, error: e?.message || 'feedback_failed' });
  }
});

app.get('/api/admin/feedback', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u || !u.isAdmin) return res.status(403).json({ ok: false, error: 'forbidden' });
    const sql = getNeonSql(); if (!sql) return res.json({ ok: true, items: [] });
    await ensureUserFeedback(sql);
    const rows = await sql`SELECT id, user_id, username, plan, category, severity, title, description, repro_steps, attachment_url, include_diagnostics, allow_contact, status, resolution_notes, admin_id, created_at, updated_at
                           FROM user_feedback
                           ORDER BY created_at DESC
                           LIMIT 250`;
    return res.json({ ok: true, items: rows });
  } catch (e) {
    console.error('[Feedback] admin list error:', e);
    return res.json({ ok: true, items: [] });
  }
});

app.patch('/api/admin/feedback/:id', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u || !u.isAdmin) return res.status(403).json({ ok: false, error: 'forbidden' });
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ ok: false, error: 'invalid_id' });
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    await ensureUserFeedback(sql);

    const { status, resolutionNotes } = req.body || {};
    const allowedStatus = new Set(['new', 'in_progress', 'resolved', 'closed']);
    const nextStatus = typeof status === 'string' && allowedStatus.has(status.toLowerCase()) ? status.toLowerCase() : null;
    const notes = typeof resolutionNotes === 'string' ? resolutionNotes.trim() : null;

    if (!nextStatus && notes == null) {
      return res.status(400).json({ ok: false, error: 'no_changes' });
    }

    await sql`UPDATE user_feedback
              SET status = COALESCE(${nextStatus}, status),
                  resolution_notes = COALESCE(${notes}, resolution_notes),
                  admin_id = ${u.userId},
                  updated_at = now()
              WHERE id=${id}`;
    return res.json({ ok: true });
  } catch (e) {
    console.error('[Feedback] admin update error:', e);
    return res.status(500).json({ ok: false, error: e?.message || 'update_failed' });
  }
});

app.delete('/api/admin/feedback/:id', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u || !u.isAdmin) return res.status(403).json({ ok: false, error: 'forbidden' });
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ ok: false, error: 'invalid_id' });
    await ensureUserFeedback(sql);
    await sql`DELETE FROM user_feedback WHERE id=${id}`;
    return res.json({ ok: true });
  } catch (e) {
    console.error('[Feedback] admin delete error:', e);
    return res.status(500).json({ ok: false, error: e?.message || 'delete_failed' });
  }
});

// ----------------------------
// API: 7-day Trial
// ----------------------------
app.get('/api/trial/status', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const sql = getNeonSql(); if (!sql) return res.json({ ok: true, active: false });
    await ensureUsers(sql);
    const rows = await sql`SELECT trial_started_at, trial_ends_at, trial_used, plan FROM users WHERE discord_id=${u.userId}`;
    const r = rows?.[0];
    const ends = r?.trial_ends_at ? new Date(r.trial_ends_at).getTime() : 0;
    const active = !!ends && ends > Date.now();
    return res.json({ ok: true, active, trialUsed: !!r?.trial_used, endsAt: ends || null, plan: r?.plan || 'Free' });
  } catch (e) { return res.json({ ok: true, active: false }); }
});

// ----------------------------
// API: Mentor
// ----------------------------
app.post('/api/mentor/chat', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    let { message, symbol, mode, history, webSearchEnabled } = req.body || {};
    console.log('[Mentor] received payload:', { hasMessage: !!message, symbol, mode, webSearchEnabled: webSearchEnabled });
    if (!message || typeof message !== 'string') return res.status(400).json({ ok: false, error: 'missing_message' });

    const responseMode = mode === 'max' ? 'max' : 'default';
    const maxTokens = responseMode === 'max' ? 1200 : 800;
    const userMessageId = `usr-${Date.now()}-${crypto.randomUUID()}`;
    const assistantMessageId = `bot-${Date.now()}-${crypto.randomUUID()}`;

    const historyItems = Array.isArray(history) ? history : [];
    const trimmedHistory = historyItems
      .slice(-8)
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const role = item.role === 'assistant' ? 'assistant' : 'user';
        const content = typeof item.content === 'string' ? item.content.trim() : '';
        if (!content) return null;
        return { role, content: content.length > 2000 ? content.slice(-2000) : content };
      })
      .filter(Boolean);

    const stripMentorArtifacts = (text, { allowProfile = false } = {}) => {
      if (!text || typeof text !== 'string') return text;
      let cleaned = text;
      if (!allowProfile) {
        const patterns = [
          /(?:^|\n{2,})###?\s*Trading profile[\s\S]*?(?=(\n{2,}###)|\n{2,}[A-Z]|\n{2,}$|$)/gi,
          /(?:^|\n{2,})Trading profile[\s\S]*?(?=(\n{2,}###)|\n{2,}[A-Z]|\n{2,}$|$)/gi,
          /(?:^|\n{2,})###?\s*Watchlist focus[\s\S]*?(?=(\n{2,}###)|\n{2,}[A-Z]|\n{2,}$|$)/gi,
          /(?:^|\n{2,})Watchlist focus[\s\S]*?(?=(\n{2,}###)|\n{2,}[A-Z]|\n{2,}$|$)/gi,
        ];
        patterns.forEach((regex) => {
          cleaned = cleaned.replace(regex, '\n\n');
        });
      }
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
      return cleaned.trim();
    };

    const profileKeywordRegex = /\b(trading profile|my profile|skill level|risk appetite|goals|trading style)\b/i;
    const historyForModel = trimmedHistory.map((item, idx, arr) => {
      if (item.role !== 'assistant') return item;
      const prev = idx > 0 ? arr[idx - 1] : null;
      const prevAskedProfile = prev && prev.role === 'user' && profileKeywordRegex.test(prev.content || '');
      return { ...item, content: stripMentorArtifacts(item.content || '', { allowProfile: prevAskedProfile }) };
    });

    const userRequestedProfile = profileKeywordRegex.test(message);

    const sql = getNeonSql();
    await (sql ? ensureUsers(sql) : Promise.resolve());

    let messageCapacityLimit = DEFAULT_MENTOR_CAPACITY;
    if (sql) {
      try {
        await ensureMentorChatHistory(sql);
        const settings = await getMentorSettings(sql, u.userId);
        messageCapacityLimit = clampMentorCapacity(settings?.messageCapacity ?? DEFAULT_MENTOR_CAPACITY);
      } catch (settingsErr) {
        console.warn('[Mentor] failed to load mentor settings:', settingsErr?.message || settingsErr);
      }
    }

    // Load user row for plan and trial
    let dbUser = null;
    if (sql) {
      try {
        const rows = await sql`SELECT username, plan, is_admin, trial_ends_at FROM users WHERE discord_id=${u.userId}`;
        dbUser = rows?.[0] || null;
      } catch {}
    }

    // Pull live context: watchlist, alerts, latest signals
    let watch = [];
    let alerts = [];
    let portfolioPositions = [];
    let latestSignals = [];
    try {
      if (sql) {
        await ensureWatchlist(sql); await ensureAlerts(sql); await ensurePortfolio(sql);
        const wl = await sql`SELECT symbol, position FROM watchlist WHERE user_id=${u.userId} ORDER BY position ASC`;
        watch = wl || [];
        const al = await sql`SELECT symbol, type, direction, threshold, active FROM alerts WHERE user_id=${u.userId} ORDER BY created_at DESC LIMIT 20`;
        alerts = al || [];
        const pf = await sql`SELECT id, symbol, quantity, cost_basis, target_price, risk, timeframe, notes FROM portfolio_positions WHERE user_id=${u.userId} ORDER BY created_at DESC LIMIT 50`;
        portfolioPositions = pf || [];
      }
    } catch {}

    const majors = ['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','MATIC','LTC','DOT','LINK','AVAX'];
    const symbolBlocklist = new Set([
      'MARKET','MARKETS','CRYPTO','CRYPTOCURRENCY','STOCKS','INDEX','INDICES','SPY','QQQ',
      'NEWS','TODAY','NOW','CURRENT','TREND','PRICE','ANALYZE','ANALYSIS','PLEASE','THANKS',
      'HEY','HELLO','WHAT','WHY','HOW','ME','THE','THIS','THAT','IT','FOR','ABOUT','ARTICLE','ARTICLES'
    ]);
    const seenSymbols = new Set();
    let resolvedSymbol = typeof symbol === 'string' && symbol ? String(symbol).toUpperCase() : '';
    let resolvedCoinId = null;

    async function findSymbolFromTexts(texts = []) {
      for (const text of texts) {
        if (!text || typeof text !== 'string') continue;
        const words = text.split(/[^A-Za-z0-9]+/).filter(Boolean);
        if (!words.length) continue;
        const candidates = [];
        const analyzeIdx = words.findIndex(w => /analy[sz]e?/i.test(w));
        if (analyzeIdx >= 0 && words[analyzeIdx + 1]) candidates.push(words[analyzeIdx + 1]);
        for (const w of words) {
          const upper = w.toUpperCase();
          if (!upper || symbolBlocklist.has(upper)) continue;
          if (majors.includes(upper)) {
            candidates.push(upper);
          } else if (/^[A-Z]{2,6}$/.test(upper)) {
            candidates.push(upper);
          }
        }
        for (const raw of candidates) {
          const upper = String(raw).toUpperCase();
          if (seenSymbols.has(upper)) continue;
          if (symbolBlocklist.has(upper)) continue;
          seenSymbols.add(upper);
          const id = await resolveCoinId(upper).catch(() => null);
          if (id) return { symbol: upper, coinId: id };
        }
      }
      return null;
    }

    try {
      if (!resolvedSymbol) {
        const userHistoryTexts = trimmedHistory.filter((h) => h.role === 'user').map((h) => h.content);
        const texts = [String(message), ...userHistoryTexts.slice().reverse()];
        const found = await findSymbolFromTexts(texts);
        if (found) {
          resolvedSymbol = found.symbol;
          resolvedCoinId = found.coinId;
        }
      }
      if (resolvedSymbol && !resolvedCoinId) {
        resolvedCoinId = await resolveCoinId(resolvedSymbol).catch(() => null);
      }
      if (resolvedSymbol) symbol = resolvedSymbol;
    } catch {}
    try {
      // Reuse signals endpoint via internal call for consistency
      const perPage = 10;
      const rows = sql ? await sql`SELECT id, symbol, signal_type, price, timestamp FROM signals ORDER BY timestamp DESC LIMIT ${perPage}` : [];
      latestSignals = (rows || []).map(r => ({ id: r.id, symbol: String(r.symbol||'').toUpperCase(), type: r.signal_type, price: r.price ? Number(r.price) : null, time: r.timestamp }));
    } catch {}

    const hostList = ['app.jackofalltrades.ai', 'localhost'];
    const envUrl = process.env.FRONTEND_URL;
    if (envUrl) {
      try {
        const parsed = new URL(envUrl);
        hostList.push(parsed.hostname.replace(/^www\./, ''));
      } catch {}
    }
    const sourceSet = new Map();
    const internalHosts = new Set(hostList);
    const addSource = (url, label) => {
      if (!url) return;
      try {
        const parsed = new URL(url);
        const domain = parsed.hostname.replace(/^www\./, '');
        if (internalHosts.has(domain)) return;
        const key = `${domain}${parsed.pathname}`;
        if (!sourceSet.has(key)) {
          sourceSet.set(key, { label: label || domain, url: parsed.href, domain });
        }
      } catch {}
    };

    // Optional coin context
    let coinCtx = null;
    if (symbol && typeof symbol === 'string') {
      const normalizedSymbol = String(symbol).toUpperCase();
      symbol = normalizedSymbol;
      try {
        const coinId = resolvedCoinId || await resolveCoinId(normalizedSymbol).catch(() => null);
        if (coinId) {
          const coin = await getCoinGeckoCoinById(coinId);
          const rawDesc = coin.description?.en ? String(coin.description.en).replace(/<[^>]*>/g, ' ') : null;
          const cleanedDesc = rawDesc ? rawDesc.replace(/\s+/g, ' ').trim() : null;
          coinCtx = {
            id: coin.id,
            symbol: String(coin.symbol||'').toUpperCase(),
            name: coin.name,
            price: coin.market_data?.current_price?.usd ?? null,
            mc: coin.market_data?.market_cap?.usd ?? null,
            change24h: coin.market_data?.price_change_percentage_24h ?? null,
            change7d: coin.market_data?.price_change_percentage_7d_in_currency?.usd ?? coin.market_data?.price_change_percentage_7d ?? null,
            desc: cleanedDesc ? cleanedDesc.slice(0, 650) : null,
            homepage: Array.isArray(coin.links?.homepage) ? coin.links.homepage.find((x)=>x) || null : null,
            forum: Array.isArray(coin.links?.official_forum_url) ? coin.links.official_forum_url.find((x)=>x) || null : null,
          };
          // Don't add sources here - we'll add them later only if response is relevant
          resolvedCoinId = coin.id;
        }
      } catch {}
    }

    // Company knowledge
    const company = getCompanyKnowledge();

    // Compose prompt context (compact, structured)
    const plan = dbUser?.plan || (u.plan || 'Free');
    const trialEnds = dbUser?.trial_ends_at ? new Date(dbUser.trial_ends_at).getTime() : 0;
    const trialActive = !!trialEnds && trialEnds > Date.now();
    const depthWanted = /\b(in\s*depth|deeper|more detail|detailed|long(er)?|explain|break(\s|-)?down|deep dive|analysis|analyze)\b/i.test(message) || responseMode === 'max';
    const companyAsked = /\b(jack of all trades|\bjoat\b|your (site|website|company)|what is joat|about joat|about your (site|company|platform))\b/i.test(String(message).toLowerCase());

    const styleInstruction = responseMode === 'max'
      ? 'Max mode ON: deliver an in-depth mentor perspective. Begin with a bold thesis sentence, then use clear sections and bullet lists to cover market context, drivers, opportunities, risks, and next steps. Address every part of the prompt, including broader market news if mentioned. Only add a ### Sources section when you cite external material.'
      : 'Default mode: respond conversationally with concise insight. Cover each part of the question, provide a quick viewpoint, then actionable takeaways. Include ### Sources only when referencing external information.';

    const portfolioSummary = (portfolioPositions || []).map(p => ({
      symbol: p.symbol,
      quantity: p.quantity != null ? Number(p.quantity) : null,
      costBasis: p.cost_basis != null ? Number(p.cost_basis) : null,
      targetPrice: p.target_price != null ? Number(p.target_price) : null,
      risk: p.risk || null,
      timeframe: p.timeframe || null,
      notes: p.notes || null,
      confidence: p.confidence != null ? Number(p.confidence) : null,
      strategy: p.strategy || null,
    }));

    let profileRow = null;
    if (sql) {
      try {
        await ensureUserProfile(sql);
        const rows = await sql`SELECT skill_level, risk_appetite, focus, trading_style, goals FROM user_profile WHERE user_id=${u.userId} LIMIT 1`;
        profileRow = rows?.[0] || null;
      } catch {}
    }

    const context = {
      user: { id: u.userId, username: u.username, plan, isAdmin: !!(dbUser?.is_admin || u.isAdmin), trialActive },
      watchlist: (watch || []).map(w => w.symbol),
      alerts: (alerts || []).map(a => ({ symbol: a.symbol, type: a.type, when: `${a.direction} ${a.threshold}`, active: a.active })),
      signals: latestSignals.slice(0, 10),
      portfolio: portfolioSummary,
      coin: coinCtx,
      profile: profileRow ? {
        skillLevel: profileRow.skill_level || 'Intermediate',
        riskAppetite: profileRow.risk_appetite || 'Balanced',
        focus: profileRow.focus || 'Both',
        tradingStyle: profileRow.trading_style || 'Swing trading',
        goals: profileRow.goals || 'Grow account steadily',
      } : null,
    };

    const portfolioPromptLine = Array.isArray(context.portfolio) && context.portfolio.length
      ? `- Portfolio: ${context.portfolio.length} positions (${context.portfolio.slice(0, 3).map((p) => {
          const qty = typeof p.quantity === 'number' && Number.isFinite(p.quantity) ? `${p.quantity}` : '';
          return `${p.symbol}${qty ? ` ${qty}` : ''}`;
        }).join(', ')})`
      : '';

    // If OpenAI configured, generate; else return a deterministic summary
    let answer = '';
    if (process.env.OPENAI_API_KEY) {
      try {
        const { default: OpenAI } = await import('openai');
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        // Calculate web search requirements BEFORE creating system prompt
        const msgTrimmedForTools = String(message).trim().toLowerCase();
        const isSimpleGreetingForTools = /^\s*(hi|hey|hello|sup|yo|gm|gn|what\??|nothing|not much|nope|yeah|yep|nah|ok|okay|k|thanks?|thank you|how are you|how's it going|good|fine|alright|you\?|u\?|what|cool|nice|great)\b/i.test(msgTrimmedForTools) || 
                                          msgTrimmedForTools.length < 8 ||
                                          /^(you\?|u\?|what|cool|nice|great)$/i.test(msgTrimmedForTools);
        const isSpecificQuery = symbol || context.coin || /\b(analyze|tell me about|what is|explain|research|latest|news|recent|current|price|market|chart|analysis)\b/i.test(String(message));
        const wantsWebSearch = Boolean(webSearchEnabled && isSpecificQuery && !isSimpleGreetingForTools);
        
        const sys = `You are ${context.user.username || 'there'}'s trading mentor AI.

Core guidelines:
- Answer the user's exact question directly and completely
- Be conversational, confident, and helpful like ChatGPT
- Provide trading opinions and analysis
- When asked about the market, give actual market analysis and news, not just stats
- When asked for links/articles, provide relevant sources with a ### Sources section
${wantsWebSearch ? '- WEB SEARCH IS ENABLED: You have access to real-time web data. Use it to provide current news, articles, and fresh insights. Include a ### Sources section with the URLs you reference.' : ''}
- Only mention watchlist/signals/profile if the user specifically asks
- Never dump context blocks unless requested

User context (use for personalization, don't list):
- Plan: ${context.user.plan}
- Watchlist: ${context.watchlist.length} symbols${context.watchlist.length > 0 ? ` (${context.watchlist.slice(0, 3).join(', ')})` : ''}
${context.coin ? `- Viewing: ${context.coin.symbol} at ${context.coin.price ? '$' + context.coin.price.toLocaleString() : 'N/A'}` : ''}
${portfolioPromptLine ? `${portfolioPromptLine}\n` : ''}

Response format:
${responseMode === 'max' ? '- Max mode: Provide deeper analysis with clear sections and bullet points' : '- Default mode: Be concise but complete'}
- Use markdown for clarity
- Add a ### Sources section when you reference external material or when web search is used
- Keep it natural and flowing, not template-like

${companyAsked ? `If asked about JOAT: mention the AI Mentor and suggest visiting the dashboard.` : ''}`;

        const conversationMessages = historyForModel.map((item) => ({ role: item.role, content: item.content }));

        // Models
        const model = responseMode === 'max' ? (process.env.OPENAI_MODEL_MAX || 'gpt-4o') : (process.env.OPENAI_MODEL || 'gpt-4o-mini');

        console.log('[Mentor] mode:', responseMode, 'model:', model, 'webSearch:', wantsWebSearch, 'webSearchEnabled:', webSearchEnabled);

        if (wantsWebSearch) {
          // Try Responses API for web search if available
          console.log('[Mentor] Attempting web search via Responses API');
          
          // Check if Responses API is available in the SDK
          const hasResponsesAPI = typeof client.responses?.create === 'function';
          
          if (hasResponsesAPI) {
            try {
              const resp = await client.responses.create({
                model,
                input: [
                  { role: 'system', content: sys },
                  ...conversationMessages,
                  { role: 'user', content: String(message) },
                ],
                tools: [{ type: 'web_search' }],
                tool_choice: 'auto',
                max_output_tokens: maxTokens,
              });

              // Extract text and sources from Responses API
              answer = resp.output_text || '';
              
              // Try to extract sources from the response object if available
              if (resp.output && Array.isArray(resp.output)) {
                resp.output.forEach((item) => {
                  if (item.type === 'message' && Array.isArray(item.content)) {
                    item.content.forEach((block) => {
                      if (block.type === 'text') {
                        if (block.text && !answer) answer = block.text;
                        if (block.text?.value && !answer) answer = block.text.value;
                      }
                    });
                  }
                });
              }

              answer = (answer || '').trim();
              console.log('[Mentor] Responses API answer length:', answer.length);
            } catch (webSearchError) {
              console.error('[Mentor] Responses API failed:', webSearchError?.message, webSearchError?.code);
              // Fall through to Chat Completions fallback
            }
          }
          
          // Fallback to Chat Completions with web search instructions if Responses API not available or failed
          if (!answer || !hasResponsesAPI) {
            console.log('[Mentor] Using Chat Completions with web search instructions');
            const webSearchSys = sys + `\n\nIMPORTANT: The user has enabled web search. Provide current, real-time information about:
- Recent market news and developments
- Latest price movements and analysis
- Breaking news in crypto/trading
- Current trends and sentiment

Include a ### Sources section at the end with relevant URLs from:
- CoinGecko, CoinMarketCap, crypto news sites, financial news, trading analysis platforms
Use markdown links format: [Site Name](URL)

Answer with up-to-date information as if you have access to the latest web data.`;
            
            const resp = await client.chat.completions.create({
              model,
              messages: [
                { role: 'system', content: webSearchSys },
                ...conversationMessages,
                { role: 'user', content: String(message) },
              ],
              max_completion_tokens: maxTokens,
            });
            answer = resp.choices?.[0]?.message?.content?.trim() || '';
            console.log('[Mentor] Chat Completions (web search mode) answer length:', answer.length);
          }
        } else {
          // Regular Chat Completions without web search
          const resp = await client.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: sys },
              ...conversationMessages,
              { role: 'user', content: String(message) },
            ],
            max_completion_tokens: maxTokens,
          });
          answer = resp.choices?.[0]?.message?.content?.trim() || '';
          console.log('[Mentor] Chat Completions answer length:', answer.length);
        }
      } catch (e) {
        console.error('mentor_openai_error', e);
        answer = '';
      }
    }

    if (answer) {
      answer = stripMentorArtifacts(answer, { allowProfile: userRequestedProfile });
    }

    const repeatRequested = /\b(tell me again|repeat that|say it again|again please|repeat please|run it back)\b/i.test(String(message));
    if (!answer && repeatRequested) {
      const lastAssistant = [...historyForModel].reverse().find((h) => h.role === 'assistant');
      if (lastAssistant?.content) {
        answer = `${lastAssistant.content}\n\n_(Replaying the previous insight as requested.)_`;
      }
    }

    if (!answer) {
      const msgTrimmed = String(message).trim().toLowerCase();
      const isSimpleGreeting = /^\s*(hi|hey|hello|sup|yo|gm|gn|what\??|nothing|not much|nope|yeah|yep|nah|ok|okay|k|thanks?|thank you|how are you|how's it going|good|fine|alright)\b/i.test(msgTrimmed) || msgTrimmed.length < 8;

      if (isSimpleGreeting) {
        answer = `Hey **${u.username || 'there'}**! How can I help you today?`;
      } else {
        answer = `Hey **${u.username || 'there'}**. I'm temporarily unavailable. Please try again in a moment or toggle web search for real-time insights.`;
      }
    }

    // Only extract sources if the response actually contains informational/educational content
    // Filter out simple greetings, casual conversation, and internal dashboard links
    if (answer) {
      const lowerAnswer = answer.toLowerCase();
      // Check if message is a simple greeting/casual conversation
      const msgTrimmed = String(message).trim().toLowerCase();
      const isSimpleGreeting = /^\s*(hi|hey|hello|sup|yo|gm|gn|thanks?|thank you|ok|okay|k|yeah|yep|nah|nothing|nope|what\??|not much|you\?|u\?|cool|nice|great|how are you|how's it going|good|fine|alright)\b/i.test(msgTrimmed) || 
                                 msgTrimmed.length < 8;
      
      // Only add sources when:
      // 1. Web search is enabled AND max mode (for web search results)
      // 2. OR user clicked on a coin (symbol exists)
      // 3. AND it's not a simple greeting
      const lowerMessage = String(message).toLowerCase();
      const isInformationalQuery = lowerMessage.includes('analyze') || lowerMessage.includes('tell me about') || 
                                   lowerMessage.includes('what is') || lowerMessage.includes('explain') ||
                                   lowerMessage.includes('research') || lowerMessage.includes('information about') ||
                                   lowerMessage.includes('latest') || lowerMessage.includes('news') ||
                                   lowerMessage.includes('current');
      
      // Only add sources when:
      // 1. Web search was enabled AND used (we'll check for Sources section in response)
      // 2. OR user clicked on a coin (symbol exists)
      // 3. AND it's not a simple greeting
      const hasSourcesSection = lowerAnswer.includes('### sources') || lowerAnswer.includes('## sources') || lowerAnswer.includes('# sources');
      const webSearchWasUsed = webSearchEnabled && hasSourcesSection;
      
      // CRITICAL: Only add sources when it's truly informational OR web search was used
      // Don't add sources for casual messages even if coin context exists
      // Sources only when:
      // 1. Web search was actually used (has Sources section in response)
      // 2. OR current message explicitly references a coin (symbol in THIS message) AND it's informational
      // Note: context.coin alone is not enough - need explicit symbol OR informational query
      const hasExplicitCoinInCurrentMessage = !!symbol; // symbol only exists if current message has it
      const shouldAddSources = !isSimpleGreeting && (
                                  webSearchWasUsed ||
                                  (hasExplicitCoinInCurrentMessage && isInformationalQuery)
                                );
      
      if (shouldAddSources) {
        // Add coin-specific sources ONLY if we have coin context from current message AND it's informational OR web search was used
        if ((context.coin || symbol) && (hasExplicitCoinInCurrentMessage || webSearchWasUsed) && (isInformationalQuery || webSearchWasUsed)) {
          if (context.coin?.homepage) addSource(context.coin.homepage, `${context.coin.symbol} site`);
          if (context.coin?.forum) addSource(context.coin.forum, `${context.coin.symbol} forum`);
          if (context.coin?.id) {
            addSource(`https://www.coingecko.com/en/coins/${context.coin.id}`, 'coingecko.com');
            addSource(`https://coinmarketcap.com/currencies/${context.coin.id}`, 'coinmarketcap.com');
          }
        }
        
        // Only extract URLs from answer if web search was used (has Sources section)
        // Don't extract random URLs from casual responses
        if (webSearchWasUsed) {
          const linkRegex = /(https?:\/\/[^\s)]+)(?![^\[]*\])/g;
          let match;
          const internalHosts = ['localhost', 'app.jackofalltrades.ai', 'jackofalltrades.ai'];
          while ((match = linkRegex.exec(answer)) !== null) {
            try {
              const url = match[1];
              const parsed = new URL(url);
              const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
              // Skip internal dashboard links
              if (!internalHosts.some(h => hostname.includes(h))) {
                addSource(url);
              }
            } catch {}
          }
        }
      }
    }

    const sources = Array.from(sourceSet.values());
    try {
      await saveMentorMessage(sql, {
        userId: u.userId,
        messageId: userMessageId,
        role: 'user',
        content: String(message),
        mode: responseMode,
        metadata: {
          webSearchEnabled: !!webSearchEnabled,
          historyCount: historyItems.length,
        },
      });
      await saveMentorMessage(sql, {
        userId: u.userId,
        messageId: assistantMessageId,
        role: 'assistant',
        content: answer,
        mode: responseMode,
        metadata: { sources },
      });
      if (sql) {
        await enforceMentorHistoryLimit(sql, u.userId, messageCapacityLimit);
      }
    } catch (persistErr) {
      console.warn('[Mentor] failed to persist chat history:', persistErr?.message || persistErr);
    }
    return res.json({ ok: true, answer, context, sources, profile: context.profile, messageId: userMessageId, responseId: assistantMessageId, settings: { messageCapacity: messageCapacityLimit } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'mentor_error' });
  }
});

app.post('/api/mentor/feedback', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const { messageId, reaction, response, prompt, mode } = req.body || {};
    if (!messageId || typeof messageId !== 'string') return res.status(400).json({ ok: false, error: 'missing_message_id' });
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    await ensureMentorFeedback(sql);
    const normalizedReaction = typeof reaction === 'string' ? reaction.toLowerCase() : '';
    const responseText = typeof response === 'string' ? response : '';
    const promptText = typeof prompt === 'string' ? prompt : '';
    const modeValue = mode === 'max' ? 'max' : 'default';
    if (normalizedReaction !== 'like' && normalizedReaction !== 'dislike') {
      await sql`DELETE FROM mentor_feedback WHERE user_id=${u.userId} AND message_id=${messageId}`;
      return res.json({ ok: true, deleted: true });
    }
    await sql`INSERT INTO mentor_feedback (user_id, username, plan, message_id, reaction, response, prompt, mode)
              VALUES (${u.userId}, ${u.username || null}, ${u.plan || 'Free'}, ${messageId}, ${normalizedReaction}, ${responseText}, ${promptText}, ${modeValue})
              ON CONFLICT (user_id, message_id) DO UPDATE SET
                reaction = EXCLUDED.reaction,
                response = EXCLUDED.response,
                prompt = EXCLUDED.prompt,
                mode = EXCLUDED.mode,
                updated_at = now()`;
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'feedback_error' });
  }
});

app.get('/api/admin/mentor-feedback', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u || !u.isAdmin) return res.status(403).json({ ok: false, error: 'forbidden' });
    const sql = getNeonSql(); if (!sql) return res.json({ ok: true, items: [] });
    await ensureMentorFeedback(sql);
    const rows = await sql`SELECT id, user_id, username, plan, message_id, reaction, response, prompt, mode, created_at, updated_at FROM mentor_feedback ORDER BY created_at DESC LIMIT 200`;
    return res.json({ ok: true, items: rows });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'feedback_error' });
  }
});

app.delete('/api/admin/mentor-feedback/:id', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u || !u.isAdmin) return res.status(403).json({ ok: false, error: 'forbidden' });
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'bad_request' });
    await sql`DELETE FROM mentor_feedback WHERE id=${id}`;
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ ok: false, error: e?.message || 'err' }); }
});

app.post('/api/trial/start', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    await ensureUsers(sql);
    const rows = await sql`SELECT plan, trial_used, trial_ends_at FROM users WHERE discord_id=${u.userId}`;
    const r = rows?.[0] || {};
    // Cannot start if on paid plan
    const plan = (r.plan || 'Free');
    if (plan && plan !== 'Free') return res.status(400).json({ ok: false, error: 'already_subscribed' });
    // Cannot start if already used
    if (r.trial_used) return res.status(400).json({ ok: false, error: 'trial_already_used' });
    // If currently active, return status
    const endsExisting = r.trial_ends_at ? new Date(r.trial_ends_at).getTime() : 0;
    if (endsExisting && endsExisting > Date.now()) return res.json({ ok: true, endsAt: endsExisting });
    const now = new Date();
    const ends = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await sql`INSERT INTO users (discord_id, plan, trial_started_at, trial_ends_at, trial_used)
              VALUES (${u.userId}, 'Free', ${now.toISOString()}, ${ends.toISOString()}, true)
              ON CONFLICT (discord_id) DO UPDATE SET trial_started_at=${now.toISOString()}, trial_ends_at=${ends.toISOString()}, trial_used=true, updated_at=now()`;
    return res.json({ ok: true, endsAt: ends.getTime() });
  } catch (e) { return res.status(500).json({ ok: false, error: e?.message || 'err' }); }
});

// ----------------------------
// API: Whop Webhook
// ----------------------------
// GET endpoint for webhook validation (Whop tests the endpoint with GET)
app.get('/api/webhook/whop', (req, res) => {
  console.log('[Whop Webhook] GET request received (validation)');
  console.log('[Whop Webhook] GET headers:', JSON.stringify(req.headers, null, 2));
  return res.json({ ok: true, message: 'Webhook endpoint ready' });
});

app.post('/api/webhook/whop', async (req, res) => {
  try {
    // Raw body is captured by express.json verify above
    const raw = req.rawBody ? req.rawBody.toString('utf8') : null;
    const payload = raw ? JSON.parse(raw) : (req.body || {});

    // Log full payload for debugging
    console.log('\n========== [Whop Webhook] Received ==========');
    console.log('[Whop Webhook] Full payload:', JSON.stringify(payload, null, 2));
    console.log('[Whop Webhook] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[Whop Webhook] Raw body length:', raw?.length || 0);

    // Whop uses 'action' field for event type (e.g., "membership.activated", "dispute.created")
    const event = payload?.action || payload?.type || payload?.event_type || payload?.event || payload?.name || 'unknown';
    console.log('[Whop Webhook] Event type:', event);

    // Optional signature verification (recommended in production)
    const secret = process.env.WHOP_WEBHOOK_SECRET || '';
    try {
      if (secret) {
        // Support common header names and formats: "Whop-Signature" or "x-whop-signature"
        const sigHeader = req.header('Whop-Signature') || req.header('whop-signature') || req.header('x-whop-signature') || req.header('X-Whop-Signature') || '';
        if (!sigHeader) {
          console.warn('[Whop Webhook] No signature header found, skipping verification (for testing)');
          // Don't fail, just skip verification for testing
        } else {
          // Expect format similar to: t=timestamp,v1=hexdigest (Stripe-style)
          const parts = Object.fromEntries(String(sigHeader).split(',').map(kv => {
            const [k, v] = kv.split('=');
            return [String(k || '').trim(), String(v || '').trim()];
          }));
          const t = parts.t || parts.ts || '';
          const v1 = parts.v1 || parts.sig || '';

          // Build base string; try timestamped first, fallback to raw
          const tryBases = [t ? `${t}.${raw || ''}` : null, raw || ''].filter(Boolean);
          const valid = tryBases.some(base => {
            const h = crypto.createHmac('sha256', secret).update(base).digest('hex');
            // constant-time compare
            const a = Buffer.from(h);
            const b = Buffer.from(v1);
            return a.length === b.length && crypto.timingSafeEqual(a, b);
          });
          if (!valid) {
            console.warn('[Whop Webhook] Signature verification failed');
            // Don't fail for testing, just log warning
          } else {
            console.log('[Whop Webhook] Signature verified successfully');
          }
        }
      }
    } catch (verr) {
      console.warn('[Whop Webhook] signature verification error:', verr?.message || String(verr));
      // Don't fail, just log warning for testing
    }

    // Resolve Discord user ID from common Whop payload shapes (including GraphQL)
    const discordUserId = String(
      // Whop direct data paths (when data is the membership object itself)
      payload?.data?.discord_user_id ||
      payload?.data?.user?.discord_user_id ||
      payload?.data?.user_id ||
      payload?.data?.discord_id ||
      payload?.data?.member?.discord_user_id ||
      payload?.data?.membership?.discord_user_id ||
      payload?.data?.membership?.user?.discord_user_id ||
      // GraphQL-style paths
      payload?.data?.member?.user?.discord_user_id ||
      payload?.data?.membership?.user?.discord_user_id ||
      // Standard paths
      payload?.member?.discord_user_id ||
      payload?.data?.discord_user_id ||
      payload?.member?.user?.discord_user_id ||
      payload?.data?.user?.discord_user_id ||
      payload?.user?.discord_id ||
      payload?.discord_user_id ||
      payload?.user_id ||
      ''
    ).trim();

    console.log('[Whop Webhook] Extracted Discord user ID:', discordUserId || 'NOT FOUND');
    console.log('[Whop Webhook] Payload keys:', Object.keys(payload));

    if (!discordUserId) {
      console.warn('[Whop Webhook] Skipping: missing discord_user_id in payload');
      console.warn('[Whop Webhook] Available payload structure:', JSON.stringify(payload, null, 2));
      console.log('========== [Whop Webhook] End (Skipped: missing discord_user_id) ==========\n');
      return res.json({ ok: true, skipped: true, reason: 'missing_discord_user_id' });
    }

    // Product → Plan mapping via env variables (set these in deployment)
    const PRODUCT_TO_PLAN = {};
    if (process.env.WHOP_PRODUCT_ID_CORE) PRODUCT_TO_PLAN[process.env.WHOP_PRODUCT_ID_CORE] = 'Core';
    if (process.env.WHOP_PRODUCT_ID_PRO) PRODUCT_TO_PLAN[process.env.WHOP_PRODUCT_ID_PRO] = 'Pro';
    if (process.env.WHOP_PRODUCT_ID_ELITE) PRODUCT_TO_PLAN[process.env.WHOP_PRODUCT_ID_ELITE] = 'Elite';

    const productId = String(
      // Whop direct data paths (when data is the membership object itself)
      payload?.data?.product_id ||
      payload?.data?.product?.id ||
      payload?.data?.membership?.product_id ||
      payload?.data?.membership?.product?.id ||
      payload?.data?.member?.product_id ||
      payload?.data?.member?.product?.id ||
      // GraphQL-style paths
      payload?.data?.membership?.product?.id ||
      // Standard paths
      payload?.member?.product_id ||
      payload?.data?.product_id ||
      payload?.product_id ||
      payload?.product?.id ||
      ''
    ).trim();

    console.log('[Whop Webhook] Extracted product ID:', productId || 'NOT FOUND');

    // Default to Free unless a mapped product is present and the event is active
    // Whop uses both formats: "membership.activated" (with dot) and "membership_activated" (with underscore)
    const isActiveEvent = (
      event === 'member.created' ||
      event === 'member.updated' ||
      event === 'member.renewed' ||
      event === 'membership.activated' ||
      event === 'membership_activated' ||
      event === 'membership.updated' ||
      event === 'membership_updated' ||
      event === 'invoice.paid' ||
      event === 'invoice_paid' ||
      event === 'payment.succeeded' ||
      event === 'payment_succeeded' ||
      event === 'payment.successful' ||
      event === 'payment_successful'
    );

    if (!productId) {
      console.warn('[Whop Webhook] Skipping: missing product_id');
      console.log('========== [Whop Webhook] End (Skipped: missing product_id) ==========\n');
      return res.json({ ok: true, skipped: true, reason: 'missing_product_id' });
    }

    let plan = 'Free';
    if (isActiveEvent && productId && PRODUCT_TO_PLAN[productId]) {
      plan = PRODUCT_TO_PLAN[productId];
    } else if (isActiveEvent && productId && !PRODUCT_TO_PLAN[productId]) {
      console.warn('[Whop Webhook] Skipping: unmapped product id → plan', productId);
      console.log('========== [Whop Webhook] End (Skipped: unmapped_product) ==========' );
      return res.json({ ok: true, skipped: true, reason: 'unmapped_product' });
    }
    const shouldDeleteData = (
      event === 'member.cancelled' ||
      event === 'member.canceled' ||
      event === 'membership.cancelled' ||
      event === 'membership.canceled' ||
      event === 'membership.deactivated' ||
      event === 'membership_deactivated' ||
      event === 'payment.failed' ||
      event === 'payment_failed' ||
      event === 'invoice.past_due' ||
      event === 'invoice_past_due'
    );
    if (shouldDeleteData) {
      plan = 'Free';
    }

    const sql = getNeonSql();
    if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    await ensureUsers(sql);

    if (shouldDeleteData) {
      await deleteUserData(sql, discordUserId);
      const goodbyeMessage = `Hi there — your Jack Of All Trades membership is no longer active, so we deleted your saved alerts, watchlists, mentor chats, and portfolio data. If this was a mistake just resubscribe and you'll start fresh.`;
      try {
        const dmSent = await sendDiscordDM(discordUserId, goodbyeMessage);
        console.log(`[Whop Webhook] Account deletion DM ${dmSent ? 'sent' : 'not sent'} for user ${discordUserId}`);
      } catch (dmErr) {
        console.warn('[Whop Webhook] Failed to send goodbye DM:', dmErr?.message || dmErr);
      }
      broadcastAccountDeleted({ userId: discordUserId, reason: event, message: goodbyeMessage });
    } else {
      await sql`INSERT INTO users (discord_id, plan, updated_at)
                VALUES (${discordUserId}, ${plan}, now())
                ON CONFLICT (discord_id) DO UPDATE SET
                  plan = ${plan},
                  updated_at = now()`;
    }

    // Optional: sync Discord roles if configured
    if (process.env.DISCORD_BOT_TOKEN && process.env.GUILD_ID) {
      const ROLE_IDS = {
        ELITE: '1402067019091677244',
        PRO: '1402061825461190656',
        CORE: '1430718778785927239',
      };
      const targetRoleId = plan === 'Elite' ? ROLE_IDS.ELITE : plan === 'Pro' ? ROLE_IDS.PRO : plan === 'Core' ? ROLE_IDS.CORE : null;
      try {
        // Remove all subscription roles first
        for (const rid of Object.values(ROLE_IDS)) {
          try {
            await fetch(`https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/members/${discordUserId}/roles/${rid}`, {
              method: 'DELETE',
              headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
            });
          } catch {}
        }
        // Add the correct role if any
        if (targetRoleId) {
          await fetch(`https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/members/${discordUserId}/roles/${targetRoleId}`, {
            method: 'PUT',
            headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
          });
        }
      } catch (e) {
        console.warn('[Whop Webhook] Discord role sync error:', e?.message || String(e));
      }
    }

    if (shouldDeleteData) {
      const deletionNotice = 'Your membership has ended and your Jack Of All Trades account data has been removed. If this was unexpected, please contact support.';
      try {
        await ensureAnnouncements(sql);
        await sql`INSERT INTO announcements (title, body, audience) VALUES (${ 'Account removed' }, ${ deletionNotice }, ${ `user:${discordUserId}` })`;
      } catch (annErr) {
        console.warn('[Whop Webhook] announcement insert failed:', annErr?.message || annErr);
      }
      broadcastAccountDeleted({ userId: discordUserId, reason: event, message: deletionNotice });
      await sendDiscordDM(discordUserId, deletionNotice).catch(() => {});
      console.log(`[Whop Webhook] ✅ Account deleted: ${event} → user ${discordUserId}`);
      console.log('========== [Whop Webhook] End ==========' );
      return res.json({ ok: true, deleted: true });
    }

    console.log(`[Whop Webhook] ✅ Success: ${event} → user ${discordUserId} plan ${plan}${productId ? ` (product ${productId})` : ''}`);
    console.log('========== [Whop Webhook] End ==========\n');
    return res.json({ ok: true });
  } catch (e) {
    console.error('[Whop Webhook] ❌ Handler error:', e?.message || e);
    console.error('[Whop Webhook] Stack:', e?.stack);
    console.log('========== [Whop Webhook] End (Error) ==========\n');
    // Always return 200 OK to prevent Whop from thinking endpoint is broken
    return res.status(200).json({ ok: true, error: 'webhook_error', message: e?.message || 'Unknown error' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('joat_session', { path: '/', sameSite: COOKIE_SECURE ? 'strict' : 'lax', secure: COOKIE_SECURE });
  res.json({ ok: true });
});

const PORT = process.env.PORT || 8787;
const server = app.listen(PORT, () => console.log(`Auth server listening on :${PORT}`));

// ----------------------------
// WebSocket: Crypto price fan-out
// ----------------------------
const wss = new WebSocketServer({ server, path: '/ws' });

// Upstream (exchange) connections per symbol, shared across clients
const upstreamBySymbol = new Map(); // symbol -> { ws, count, pingTimer, reconnecting }
function subscribeUpstream(symbol) {
  if (upstreamBySymbol.has(symbol)) {
    const entry = upstreamBySymbol.get(symbol);
    entry.count += 1;
    return entry;
  }
  // Default to Coinbase Advanced Trade WS for crypto (port 443, widely allowed)
  // Allowlist common USD products; others fallback to REST
  const ALLOW = new Set(['BTC','ETH','SOL','XRP','ADA','DOGE','MATIC','LTC','DOT','LINK','AVAX','ARB','OP','APT','ATOM','BCH']);
  if (!ALLOW.has(symbol)) {
    console.warn(`[ws] skip upstream for ${symbol} (not in allowlist)`);
    return { ws: null, count: 1 };
  }
  const productId = `${symbol}-USD`;
  const url = `wss://advanced-trade-ws.coinbase.com`;
  const ws = new WSClient(url);
  const entry = { ws, count: 1, pingTimer: null, reconnecting: false };
  upstreamBySymbol.set(symbol, entry);
  ws.on('open', () => {
    console.log(`[ws] upstream open ${symbol} -> ${productId}`);
    // Subscribe to ticker channel for this product
    try {
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: 'ticker',
        product_ids: [productId],
      }));
    } catch {}
    // Heartbeat ping to keep the connection alive
    try {
      if (entry.pingTimer) clearInterval(entry.pingTimer);
      entry.pingTimer = setInterval(() => {
        try { ws.send(JSON.stringify({ type: 'ping' })); } catch {}
      }, 25000);
    } catch {}
  });
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      // Coinbase Advanced Trade WS: { channel:'ticker', events:[ { type:'update', tickers:[ { product_id, price, ... } ] } ] }
      if (data && data.channel === 'ticker' && Array.isArray(data.events)) {
        for (const ev of data.events) {
          const tickers = Array.isArray(ev?.tickers) ? ev.tickers : [];
          for (const t of tickers) {
            const price = parseFloat(t.price ?? t.mark_price ?? t.best_ask ?? t.best_bid ?? t.last_price);
            if (!isFinite(price)) continue;
            const payload = JSON.stringify({ type: 'tick', symbol, price, t: Date.now() });
            for (const client of wss.clients) {
              if (client.readyState === 1 && client.subs && client.subs.has(symbol)) {
                client.send(payload);
              }
            }
          }
        }
      }
    } catch {}
  });
  function scheduleReconnect() {
    if (entry.reconnecting) return;
    // Only reconnect if there are clients still subscribed to this symbol
    let anyClient = false;
    for (const client of wss.clients) {
      if (client.readyState === 1 && client.subs && client.subs.has(symbol)) { anyClient = true; break; }
    }
    if (!anyClient) return;
    entry.reconnecting = true;
    setTimeout(() => {
      // Remove stale entry and resubscribe
      if (entry.pingTimer) { try { clearInterval(entry.pingTimer); } catch {} }
      upstreamBySymbol.delete(symbol);
      try { subscribeUpstream(symbol); } catch {}
    }, 1500);
  }
  ws.on('close', () => {
    if (entry.pingTimer) { try { clearInterval(entry.pingTimer); } catch {} }
    upstreamBySymbol.delete(symbol);
    console.warn(`[ws] upstream closed ${symbol}`);
    scheduleReconnect();
  });
  ws.on('error', () => {
    try { ws.close(); } catch {}
    if (entry.pingTimer) { try { clearInterval(entry.pingTimer); } catch {} }
    upstreamBySymbol.delete(symbol);
    console.warn(`[ws] upstream error ${symbol}`);
    scheduleReconnect();
  });
  return entry;
}
function unsubscribeUpstream(symbol) {
  const entry = upstreamBySymbol.get(symbol);
  if (!entry) return;
  entry.count -= 1;
  if (entry.count <= 0) {
    try { entry.ws.close(); } catch {}
    upstreamBySymbol.delete(symbol);
  }
}

function broadcastSignalAdded(row) {
  if (!row) return;
  let signal = null;
  if (row && row.symbol && row.type && !row.signal_type) {
    signal = row;
  } else {
    signal = formatSignalRow(row);
  }
  if (!signal) {
    const fallback = {
      id: row.id,
      symbol: String(row.symbol || '').toUpperCase(),
      rawSymbol: String(row.symbol || '').toUpperCase(),
      type: /SELL/i.test(String(row.signal_type || '')) ? 'SELL' : 'BUY',
      price: row.price != null ? formatCurrency(Number(row.price)) : '',
      priceValue: row.price != null ? Number(row.price) : null,
      postedAt: row.timestamp || new Date().toISOString(),
      time: row.timestamp || new Date().toISOString(),
      description: row.recommendations || '',
      summary: row.recommendations || '',
      status: 'active',
    };
    signal = fallback;
  }
  const payload = JSON.stringify({
    type: 'signal_added',
    signal,
  });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      try { client.send(payload); } catch {}
    }
  }
}

function broadcastAlertTriggered(alert) {
  if (!alert) return;
  const triggeredAt = alert.triggeredAt || new Date().toISOString();
  const payload = {
    type: 'alert_triggered',
    alert: {
      id: alert.alertId || alert.id || Date.now(),
      userId: alert.userId || null,
      symbol: String(alert.displaySymbol || alert.symbol || '').toUpperCase(),
      direction: alert.direction || '>=',
      threshold: typeof alert.threshold === 'number' ? alert.threshold : null,
      currentPrice: typeof alert.currentPrice === 'number' ? alert.currentPrice : null,
      type: alert.type || alert.alertType || 'price',
      assetType: alert.assetType || null,
      displaySymbol: alert.displaySymbol || null,
      displayName: alert.displayName || null,
      createdAt: triggeredAt,
      triggeredAt,
      active: typeof alert.active === 'boolean' ? alert.active : false,
      change: typeof alert.changeValue === 'number' ? alert.changeValue : null,
    },
  };
  const text = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      try { client.send(text); } catch {}
    }
  }
}

function broadcastAccountDeleted({ userId, reason, message }) {
  if (!userId) return;
  const payload = JSON.stringify({
    type: 'account_deleted',
    userId: String(userId),
    reason: reason || 'membership_cancelled',
    message: message || 'Your account data has been deleted.',
    timestamp: new Date().toISOString(),
  });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      try { client.send(payload); } catch {}
    }
  }
}

function broadcastUserNotification({ userId, level = 'info', title, body, actionLabel, actionHref, meta, expiresAt }) {
  if (!userId) return;
  const notificationId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const payload = JSON.stringify({
    type: 'user_notification',
    userId: String(userId),
    notification: {
      id: notificationId,
      level,
      title: title || 'Notification',
      body: body || '',
      actionLabel: actionLabel || null,
      actionHref: actionHref || null,
      meta: meta || null,
      timestamp: new Date().toISOString(),
      expiresAt: expiresAt || null,
    },
  });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      try { client.send(payload); } catch {}
    }
  }
}

// Internal endpoint the bot can call to broadcast alert notifications
app.post('/api/alerts/trigger-notify', async (req, res) => {
  try {
    const key = process.env.INTERNAL_BOT_KEY;
    if (key && req.headers['x-internal-key'] !== key) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    const { userId, symbol, direction, threshold, currentPrice, type, alertId, assetType, displaySymbol, displayName } = req.body || {};
    if (!symbol) return res.status(400).json({ ok: false, error: 'missing_symbol' });
    broadcastAlertTriggered({ userId, symbol, direction, threshold, currentPrice, type, alertId, assetType, displaySymbol, displayName });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'err' });
  }
});

wss.on('connection', (ws) => {
  ws.subs = new Set();
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'subscribe' && typeof data.symbol === 'string') {
        const sym = data.symbol.toUpperCase();
        if (!ws.subs.has(sym)) {
          ws.subs.add(sym);
          subscribeUpstream(sym);
          ws.send(JSON.stringify({ type: 'subscribed', symbol: sym }));
        }
      } else if (data.type === 'unsubscribe' && typeof data.symbol === 'string') {
        const sym = data.symbol.toUpperCase();
        if (ws.subs.has(sym)) {
          ws.subs.delete(sym);
          unsubscribeUpstream(sym);
          ws.send(JSON.stringify({ type: 'unsubscribed', symbol: sym }));
        }
      }
    } catch {}
  });
  ws.on('close', () => {
    for (const sym of ws.subs) unsubscribeUpstream(sym);
  });
});

const DEFAULT_MENTOR_CAPACITY = 10;
const MIN_MENTOR_CAPACITY = 5;
const MAX_MENTOR_CAPACITY = 20;

function clampMentorCapacity(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_MENTOR_CAPACITY;
  return Math.max(MIN_MENTOR_CAPACITY, Math.min(MAX_MENTOR_CAPACITY, Math.round(num)));
}

async function getMentorSettings(sql, userId) {
  await ensureUsers(sql);
  const rows = await sql`SELECT preferences FROM users WHERE discord_id=${userId}`;
  const prefs = rows?.[0]?.preferences || {};
  const mentorPrefs = prefs?.mentor && typeof prefs.mentor === 'object' ? prefs.mentor : {};
  const messageCapacity = clampMentorCapacity(mentorPrefs.messageCapacity);
  return { messageCapacity };
}

async function updateMentorSettings(sql, userId, patch) {
  await ensureUsers(sql);
  const rows = await sql`SELECT preferences FROM users WHERE discord_id=${userId}`;
  const prefs = rows?.[0]?.preferences && typeof rows[0].preferences === 'object' ? rows[0].preferences : {};
  const currentMentor = prefs.mentor && typeof prefs.mentor === 'object' ? prefs.mentor : {};
  const updatedMentor = { ...currentMentor, ...patch };
  const nextPrefs = { ...prefs, mentor: updatedMentor };
  const prefsJson = JSON.stringify(nextPrefs);
  await sql`INSERT INTO users (discord_id, preferences)
            VALUES (${userId}, ${prefsJson}::jsonb)
            ON CONFLICT (discord_id) DO UPDATE SET preferences = ${prefsJson}::jsonb, updated_at = now()`;
  return updatedMentor;
}

async function enforceMentorHistoryLimit(sql, userId, capacity) {
  const limit = Math.max(MIN_MENTOR_CAPACITY * 2, Math.min(MAX_MENTOR_CAPACITY * 2, capacity * 2));
  await sql`DELETE FROM mentor_chat_history
            WHERE user_id=${userId}
              AND pinned = false
              AND id IN (
                SELECT id FROM (
                  SELECT id,
                         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
                  FROM mentor_chat_history
                  WHERE user_id=${userId} AND pinned = false
                ) AS ranked
                WHERE ranked.rn > ${limit}
              )`;
}

async function saveMentorMessage(sql, { userId, messageId, role, content, mode, metadata, pinned = false }) {
  if (!sql || !userId || !messageId || !role) return;
  await ensureMentorChatHistory(sql);
  const metaJson = metadata ? JSON.stringify(metadata) : null;
  await sql`INSERT INTO mentor_chat_history (user_id, message_id, role, content, mode, metadata, pinned)
            VALUES (${userId}, ${messageId}, ${role}, ${content}, ${mode || null}, ${metaJson}::jsonb, ${pinned})
            ON CONFLICT (user_id, message_id) DO UPDATE SET
              content = EXCLUDED.content,
              mode = EXCLUDED.mode,
              metadata = COALESCE(EXCLUDED.metadata, mentor_chat_history.metadata)`;
}

app.get('/api/mentor/chat/history', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const sql = getNeonSql();
    if (!sql) return res.json({ ok: true, messages: [], settings: { messageCapacity: DEFAULT_MENTOR_CAPACITY } });
    await ensureMentorChatHistory(sql);
    const settings = await getMentorSettings(sql, u.userId);
    const rows = await sql`SELECT message_id, role, content, mode, metadata, pinned, created_at
                           FROM mentor_chat_history
                           WHERE user_id=${u.userId}
                           ORDER BY created_at ASC
                           LIMIT 200`;
    const messages = (rows || []).map((row) => ({
      messageId: row.message_id,
      role: row.role,
      content: row.content,
      mode: row.mode,
      metadata: row.metadata || {},
      pinned: !!row.pinned,
      created_at: row.created_at,
    }));
    return res.json({ ok: true, messages, settings });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'history_error' });
  }
});

app.delete('/api/mentor/chat/history', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const sql = getNeonSql();
    if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    await ensureMentorChatHistory(sql);
    await sql`DELETE FROM mentor_chat_history WHERE user_id=${u.userId}`;
    const clearedAt = new Date();
    const isoTimestamp = clearedAt.toISOString();
    const prettyTimestamp = clearedAt.toLocaleString('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
    const dmMessage = `Hi there — we cleared your Mentor chat history on ${prettyTimestamp}. If this wasn't you, please reach out to support immediately.`;
    try {
      await sendDiscordDM(u.userId, dmMessage);
    } catch (dmErr) {
      console.warn('[Mentor] Failed to send history clear DM:', dmErr?.message || dmErr);
    }
    broadcastUserNotification({
      userId: u.userId,
      level: 'info',
      title: 'Mentor chat history cleared',
      body: 'Your Mentor conversation history has been erased. This cannot be undone.',
      actionLabel: 'Open Mentor',
      actionHref: '/dashboard/mentor',
      meta: { clearedAt: isoTimestamp },
    });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'history_clear_error' });
  }
});

app.post('/api/mentor/chat/pin', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const { messageId, pinned } = req.body || {};
    if (!messageId) return res.status(400).json({ ok: false, error: 'missing_message_id' });
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    await ensureMentorChatHistory(sql);
    const rows = await sql`UPDATE mentor_chat_history SET pinned=${!!pinned}
                           WHERE user_id=${u.userId} AND message_id=${messageId}
                           RETURNING message_id`;
    if (!rows || rows.length === 0) return res.status(404).json({ ok: false, error: 'not_found' });
    return res.json({ ok: true, messageId });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'pin_error' });
  }
});

app.post('/api/mentor/chat/settings', async (req, res) => {
  try {
    const u = getSessionUser(req);
    if (!u) return res.status(401).json({ ok: false, error: 'unauth' });
    const { messageCapacity } = req.body || {};
    const sql = getNeonSql(); if (!sql) return res.status(500).json({ ok: false, error: 'db' });
    const clamped = clampMentorCapacity(messageCapacity ?? DEFAULT_MENTOR_CAPACITY);
    await updateMentorSettings(sql, u.userId, { messageCapacity: clamped });
    await enforceMentorHistoryLimit(sql, u.userId, clamped);
    return res.json({ ok: true, settings: { messageCapacity: clamped } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'settings_error' });
  }
});


