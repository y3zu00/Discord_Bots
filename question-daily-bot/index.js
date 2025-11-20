require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const cron = require("node-cron");
const OpenAI = require("openai");
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

// Singleton check - ensure only one instance runs (atomic lock file creation)
const lockFilePath = path.join(__dirname, ".question-bot.lock");
let lockFileHandle = null;

try {
  // Try to create lock file atomically (exclusive mode - fails if file exists)
  lockFileHandle = fs.openSync(lockFilePath, 'wx');
  // Write PID to lock file
  const pidBuffer = Buffer.from(process.pid.toString());
  fs.writeSync(lockFileHandle, pidBuffer, 0, pidBuffer.length);
} catch (err) {
  if (err.code === 'EEXIST') {
    // Lock file exists - another instance is running
    try {
      const existingPid = fs.readFileSync(lockFilePath, "utf8").trim();
      // Check if process is actually running (on Windows, this is approximate)
      try {
        process.kill(parseInt(existingPid, 10), 0); // Signal 0 just checks if process exists
        console.error(`❌ Another instance of question-daily-bot is already running (PID: ${existingPid}). Exiting.`);
        process.exit(1);
      } catch (killErr) {
        // Process doesn't exist - stale lock file
        console.warn("⚠️ Found stale lock file, removing it...");
        try {
          fs.unlinkSync(lockFilePath);
          // Retry creating lock file
          lockFileHandle = fs.openSync(lockFilePath, 'wx');
          const pidBuffer = Buffer.from(process.pid.toString());
          fs.writeSync(lockFileHandle, pidBuffer, 0, pidBuffer.length);
        } catch (retryErr) {
          console.error("❌ Failed to acquire lock after removing stale file:", retryErr);
          process.exit(1);
        }
      }
    } catch (readErr) {
      console.error("❌ Failed to read existing lock file:", readErr);
      process.exit(1);
    }
  } else {
    console.error("❌ Failed to create lock file:", err);
    process.exit(1);
  }
}

// Clean up lock file on exit
function cleanupLockFile() {
  try {
    if (lockFileHandle !== null) {
      try {
        fs.closeSync(lockFileHandle);
      } catch (e) {
        // Ignore close errors
      }
    }
    if (fs.existsSync(lockFilePath)) {
      fs.unlinkSync(lockFilePath);
    }
  } catch (err) {
    // Ignore errors during cleanup
  }
}

process.on("exit", cleanupLockFile);
process.on("uncaughtException", (err) => {
  cleanupLockFile();
  throw err;
});

// Discord client setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ],
});

// OpenAI setup (new SDK way)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Database setup
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is required for the daily question bot.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
});

const QUESTION_CRON = process.env.QUESTION_CRON || "0 12 * * *";
const POLL_OPTION_MAX = 55;
const askedQuestions = new Set();

const DEFAULT_TIMEZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const QUESTION_TIMEZONE =
  process.env.QUESTION_TIMEZONE?.trim() || DEFAULT_TIMEZONE;
const QUESTION_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: QUESTION_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

async function generateQuestion() {
  const topics = [
    "technical analysis patterns",
    "risk management strategies", 
    "market psychology",
    "trading psychology",
    "chart patterns",
    "indicator analysis",
    "position sizing",
    "stop loss placement",
    "market volatility",
    "trading strategies",
    "market structure",
    "support and resistance",
    "trend analysis",
    "momentum indicators",
    "volume analysis"
  ];
  
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];
  
  const prompt = `Create a UNIQUE INTERMEDIATE to ADVANCED trading question about ${randomTopic}. The question should be challenging but not impossible for experienced traders.

CRITICAL: You MUST follow this EXACT format:
Question: [your question here]
A) [first option]
B) [second option] 
C) [third option]

Requirements:
- Question must be under 200 characters
- Exactly 3 options (A, B, C)
- Focus specifically on: ${randomTopic}
- Make it challenging - avoid basic "what is" questions
- Include specific scenarios, chart patterns, or trading situations
- One option should be clearly correct, others should be plausible but wrong
- Make it DIFFERENT from common trading questions
- Use the EXACT format shown above

Examples of correct format:
Question: In a head and shoulders pattern, where should you place your stop loss?
A) Below the neckline
B) Above the right shoulder
C) At the left shoulder peak

Question: When RSI shows divergence on a 4-hour chart, what does this typically indicate?
A) Trend continuation
B) Trend reversal
C) Market consolidation

Question: During a market crash, which risk management strategy is most effective?
A) Increase position sizes
B) Reduce position sizes and tighten stops
C) Hold all positions and wait`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 200,
    temperature: 1.2  // Increased temperature for more creativity
  });
  return response.choices[0].message.content.trim();
}

async function generateAnswer(question, options) {
  const prompt = `You are a trading expert. Please provide the correct answer and explanation for this trading question.

Question: ${question}
Options:
A) ${options[0]}
B) ${options[1]}
C) ${options[2]}

Please provide:
1. The correct answer (A, B, or C)
2. A brief explanation (2-3 sentences) of why this is correct

Format your response as:
Answer: [A/B/C]
Explanation: [brief explanation]`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300,
    temperature: 0.3
  });
  return response.choices[0].message.content.trim();
}

function parseQuestionAndOptions(questionText) {
  try {
    const lines = questionText.split('\n').filter(line => line.trim());
    let question = "";
    const options = [];
    
    // Try multiple parsing patterns
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Pattern 1: "Question: [text]"
      if (trimmed.startsWith('Question:')) {
        question = trimmed.replace('Question:', '').trim();
      }
      // Pattern 2: Just the question text (no prefix)
      else if (!question && trimmed.length > 10 && !trimmed.match(/^[A-C][\.\)]/) && !trimmed.includes(')')) {
        question = trimmed;
      }
      
      // Pattern 1: "A) [text]"
      if (trimmed.match(/^[A-C]\)/)) {
        const option = trimmed.substring(2).trim();
        options.push(option);
      }
      // Pattern 2: "A. [text]"
      else if (trimmed.match(/^[A-C]\./)) {
        const option = trimmed.substring(2).trim();
        options.push(option);
      }
      // Pattern 3: "A [text]" (space only)
      else if (trimmed.match(/^[A-C] /)) {
        const option = trimmed.substring(2).trim();
        options.push(option);
      }
    }
    
    // If we still don't have a question, try to extract from the first line
    if (!question && lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine.length > 10 && !firstLine.match(/^[A-C][\.\)]/)) {
        question = firstLine;
      }
    }
    
    // If we still don't have enough options, try to find them in the text
    if (options.length < 3) {
      // Look for any lines that might be options
      for (const line of lines) {
        const trimmed = line.trim();
        // Look for lines that start with letters and contain trading terms
        if (trimmed.length > 5 && trimmed.length < 100 && 
            !trimmed.includes('Question:') && 
            !trimmed.includes('Format:') &&
            !trimmed.includes('Examples:') &&
            !trimmed.includes('Requirements:')) {
          
          // Skip if it looks like a question
          if (trimmed.includes('?') || trimmed.includes('what') || trimmed.includes('which') || trimmed.includes('how')) {
            continue;
          }
          
          // Skip if it's already an option
          if (options.includes(trimmed)) {
            continue;
          }
          
          options.push(trimmed);
          
          if (options.length >= 3) break;
        }
      }
    }
    
    // If we still don't have a question or enough options, generate a unique one
    if (!question || options.length < 3) {
      const timestamp = Date.now();
      return {
        question: `Trading Question ${timestamp}`,
        options: [
          `Option A - ${timestamp}`,
          `Option B - ${timestamp}`,
          `Option C - ${timestamp}`
        ]
      };
    }
    
    return { question, options: options.slice(0, 3) };
  } catch (error) {
    console.error("❌ Parsing Error:", error);
    const timestamp = Date.now();
    return {
      question: `Error Question ${timestamp}`,
      options: [
        `Error Option A - ${timestamp}`,
        `Error Option B - ${timestamp}`,
        `Error Option C - ${timestamp}`
      ]
    };
  }
}

function parseAnswer(answerText) {
  try {
    const lines = answerText.split('\n').filter(line => line.trim());
    
    let correctAnswer = "A";
    let explanation = "No explanation provided";
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('Answer:')) {
        correctAnswer = trimmed.replace('Answer:', '').trim();
      } else if (trimmed.startsWith('Explanation:')) {
        explanation = trimmed.replace('Explanation:', '').trim();
      }
    }
    
    return { correctAnswer, explanation };
  } catch (error) {
    console.error("❌ Answer Parsing Error:", error);
    return {
      correctAnswer: "A",
      explanation: "No explanation available"
    };
  }
}

function toDateString(date = new Date()) {
  return QUESTION_DATE_FORMATTER.format(date);
}

function parseOptionsString(optionsText) {
  if (!optionsText) return [];
  try {
    const parsed = JSON.parse(optionsText);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    // fall back to comma delimited string
  }
  return optionsText.split(",").map((opt) => opt.trim()).filter(Boolean);
}

function mapRowToQuestion(row) {
  const options = parseOptionsString(row.options);
  return {
    id: row.id,
    question: row.question_text,
    options,
    answerData: {
      correctAnswer: (row.correct_answer || "A").toUpperCase(),
      explanation: row.explanation || "No explanation available",
    },
    postedDate: row.posted_date,
    answerRevealed: row.answer_revealed,
  };
}

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_questions (
      id BIGSERIAL PRIMARY KEY,
      question_text TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      options TEXT NOT NULL,
      posted_date DATE UNIQUE NOT NULL,
      posted_time TIMESTAMPTZ DEFAULT now(),
      answer_revealed BOOLEAN DEFAULT false,
      poll_message_id TEXT
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS question_responses (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      question_id BIGINT NOT NULL REFERENCES daily_questions(id) ON DELETE CASCADE,
      selected_answer TEXT NOT NULL,
      is_correct BOOLEAN NOT NULL,
      response_time TIMESTAMPTZ DEFAULT now(),
      response_delay_seconds INTEGER,
      UNIQUE(user_id, question_id)
    )
  `);
  await pool.query(`ALTER TABLE daily_questions ADD COLUMN IF NOT EXISTS explanation TEXT`);
  await pool.query(`ALTER TABLE daily_questions ADD COLUMN IF NOT EXISTS poll_message_id TEXT`);
}

async function hydrateAskedQuestionsFromDb(limit = 200) {
  const { rows } = await pool.query(
    `SELECT question_text FROM daily_questions ORDER BY posted_date DESC LIMIT $1`,
    [limit]
  );
  for (const row of rows) {
    askedQuestions.add(row.question_text);
  }
  console.log(`📚 Loaded ${rows.length} historical questions from the database.`);
}

async function fetchLatestQuestionBefore(date) {
  const dateOnly = toDateString(date);
  const { rows } = await pool.query(
    `SELECT * FROM daily_questions WHERE posted_date < $1 ORDER BY posted_date DESC LIMIT 1`,
    [dateOnly]
  );
  if (!rows.length) return null;
  return mapRowToQuestion(rows[0]);
}

async function saveQuestionToDatabase({ question, options, answerData, postedDate }) {
  const { rows } = await pool.query(
    `
      INSERT INTO daily_questions (question_text, correct_answer, options, explanation, posted_date, answer_revealed)
      VALUES ($1, $2, $3, $4, $5, false)
      ON CONFLICT (posted_date) DO UPDATE SET
        question_text = EXCLUDED.question_text,
        correct_answer = EXCLUDED.correct_answer,
        options = EXCLUDED.options,
        explanation = EXCLUDED.explanation,
        posted_time = now(),
        answer_revealed = false
      RETURNING *
    `,
    [question, answerData.correctAnswer, JSON.stringify(options), answerData.explanation, postedDate]
  );
  return mapRowToQuestion(rows[0]);
}

async function trySaveQuestionToDatabase({ question, options, answerData, postedDate }) {
  // Try to insert with DO NOTHING on conflict - returns row only if insert succeeded
  const { rows } = await pool.query(
    `
      INSERT INTO daily_questions (question_text, correct_answer, options, explanation, posted_date, answer_revealed)
      VALUES ($1, $2, $3, $4, $5, false)
      ON CONFLICT (posted_date) DO NOTHING
      RETURNING *
    `,
    [question, answerData.correctAnswer, JSON.stringify(options), answerData.explanation, postedDate]
  );
  // If rows.length > 0, we successfully inserted (no conflict)
  // If rows.length === 0, conflict occurred (another process already inserted)
  return rows.length > 0 ? mapRowToQuestion(rows[0]) : null;
}

async function markAnswerRevealed(questionId) {
  if (!questionId) return false;
  // Make this atomic - only update if answer_revealed is false so that
  // only ONE process wins the race to reveal yesterday's answer.
  const result = await pool.query(
    `UPDATE daily_questions
       SET answer_revealed = true
     WHERE id = $1
       AND answer_revealed = false
     RETURNING id`,
    [questionId]
  );
  // If rows.length === 0, another process already marked it as revealed.
  return result.rows.length > 0;
}

function sanitizeOptionText(option, index) {
  const fallback = `Option ${String.fromCharCode(65 + index)}`;
  let text = (option || fallback).toString().trim();
  if (!text) text = fallback;
  if (text.length > POLL_OPTION_MAX) {
    console.warn(`⚠️ Poll option too long (${text.length} chars). Truncating: "${text}"`);
    text = `${text.slice(0, POLL_OPTION_MAX - 3).trim()}...`;
  }
  return text;
}

async function fetchQuestionChannel() {
  const channelId = process.env.CHANNEL_ID;
  if (!channelId) {
    throw new Error("CHANNEL_ID is not configured in the environment.");
  }
  const channel = await client.channels.fetch(channelId);
  if (!channel) {
    throw new Error(`Channel ${channelId} not found or bot lacks access.`);
  }
  return channel;
}

async function hasQuestionForDate(date = new Date()) {
  const dateKey = typeof date === "string" ? date : toDateString(date);
  const { rows } = await pool.query(
    `SELECT 1 FROM daily_questions WHERE posted_date = $1 LIMIT 1`,
    [dateKey]
  );
  return rows.length > 0;
}

async function deletePreviousPollMessage(channel, referenceDate = new Date()) {
  try {
    const previousDate = new Date(referenceDate);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateKey = toDateString(previousDate);

    const { rows } = await pool.query(
      `SELECT poll_message_id FROM daily_questions WHERE posted_date = $1`,
      [previousDateKey]
    );

    if (rows.length === 0) return;
    const pollMessageId = rows[0]?.poll_message_id;
    if (!pollMessageId) return;

    try {
      const message = await channel.messages.fetch(pollMessageId);
      await message.delete();
      console.log(`🗑️ Deleted previous day's poll message (ID: ${pollMessageId})`);
    } catch (err) {
      if (err.code === 10008) {
        console.log("ℹ️ Previous poll message already deleted.");
      } else {
        console.warn(`⚠️ Failed to delete poll message: ${err.message}`);
      }
    }
  } catch (err) {
    console.warn(`⚠️ Error while deleting previous poll message: ${err.message}`);
    // Non-fatal: continue with sending today's question
  }
}

async function postDailyQuestion(
  channel,
  { reason = "scheduled", force = false, referenceDate = new Date() } = {}
) {
  if (!channel) {
    throw new Error("Channel is required to post the daily question.");
  }

  const referenceDateKey =
    typeof referenceDate === "string"
      ? referenceDate
      : toDateString(referenceDate);

  if (!force) {
    const alreadyPosted = await hasQuestionForDate(referenceDateKey);
    if (alreadyPosted) {
      console.log(`⚠️ Daily question already exists for today. Skipping send (${reason}).`);
      return null;
    }
  }

  const referenceDateObj =
    referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  // Clean up only the previous day's poll message so the channel stays tidy
  await deletePreviousPollMessage(channel, referenceDateObj);

  const { question, options } = await generateUniqueQuestion();
  console.log("📝 Question:", question);
  console.log("📝 Options:", options);

  const sanitizedOptions = options.map((option, index) => sanitizeOptionText(option, index));
  if (JSON.stringify(options) !== JSON.stringify(sanitizedOptions)) {
    console.log("✂️ Poll options truncated to satisfy Discord limits:", sanitizedOptions);
  }

  const answerText = await generateAnswer(question, options);
  const answerData = parseAnswer(answerText);
  const postedDate = referenceDateKey;

  // CRITICAL: Save to database FIRST (database-first approach to prevent duplicates)
  // Only send Discord message if we successfully inserted (meaning we're the first process)
  let savedQuestion = null;
  try {
    savedQuestion = await trySaveQuestionToDatabase({ question, options: sanitizedOptions, answerData, postedDate });
    if (!savedQuestion) {
      // Another process already inserted for this date - skip sending
      console.log(`⚠️ Daily question already exists in database for ${postedDate}. Another process sent it. Skipping Discord send (${reason}).`);
      return null;
    }
  } catch (dbErr) {
    console.error("❌ Failed to save question to database:", dbErr);
    console.error("Question text was:", question);
    // Don't send Discord if database save failed
    throw new Error(`Database save failed: ${dbErr.message}`);
  }

  // Only after we've successfully inserted today's question (meaning this
  // process "owns" today's send) do we reveal yesterday's answer.
  await sendPreviousAnswerIfNeeded(channel, referenceDateObj);

  // Only send Discord message if database save succeeded
  const pollData = {
    question: { text: question },
    answers: sanitizedOptions.map((option) => ({ text: option })),
    duration: 24,
    allow_multiselect: false,
  };

  let pollMessage = null;
  try {
    pollMessage = await channel.send({
      content: `## 🎯 **Today's Question**\n\n**${question}**`,
      poll: pollData,
    });
    console.log(`📨 Daily question sent via ${reason}${pollMessage?.id ? ` (message ID ${pollMessage.id})` : ""}.`);

    // Store the poll message so we can clean it up tomorrow
    if (pollMessage?.id) {
      await pool.query(
        `UPDATE daily_questions SET poll_message_id = $1 WHERE posted_date = $2`,
        [pollMessage.id, postedDate]
      );
    }
  } catch (discordErr) {
    console.error("❌ Failed to send Discord message after database save:", discordErr);
    // Question is already saved, but Discord send failed - this is logged but not fatal
  }

  return { question, options, answerData };
}

async function catchUpQuestionIfMissing(channel) {
  const now = new Date();
  const missing = !(await hasQuestionForDate(now));
  if (!missing) {
    console.log("✅ Daily question already exists for today. No catch-up needed.");
    return false;
  }
  console.log("⚠️ No question recorded for today. Sending catch-up question now.");
  await postDailyQuestion(channel, { reason: "startup-catch-up", force: true, referenceDate: now });
  return true;
}

function createAnswerEmbed(questionData) {
  const { question, options, answerData } = questionData;
  const { correctAnswer, explanation } = answerData;
  const index = correctAnswer === "B" ? 1 : correctAnswer === "C" ? 2 : 0;
  const correctOption = options[index] || "Unavailable";

  return {
    color: 0x00ff00,
    title: "📚 Yesterday's Answer",
    fields: [
      { name: "❓ Question", value: question, inline: false },
      { name: "✅ Correct Answer", value: `**${correctAnswer})** ${correctOption}`, inline: true },
      { name: "📖 Explanation", value: explanation, inline: false },
    ],
    footer: { text: "Keep learning and improving! 🚀" },
    timestamp: new Date(),
  };
}

async function sendPreviousAnswerIfNeeded(channel, referenceDate = new Date()) {
  const previousQuestion = await fetchLatestQuestionBefore(referenceDate);
  if (!previousQuestion || previousQuestion.answerRevealed) {
    return;
  }

  // Try to atomically mark this question as revealed. If this returns false,
  // some other process already revealed & sent it, so we skip to avoid dupes.
  const wasMarked = await markAnswerRevealed(previousQuestion.id);
  if (!wasMarked) {
    console.log("📚 Yesterday's answer already sent by another process. Skipping.");
    return;
  }

  const answerEmbed = createAnswerEmbed(previousQuestion);
  await channel.send({ embeds: [answerEmbed] });
  console.log("📚 Yesterday's answer sent from database backup!");
}

async function generateUniqueQuestion() {
  let attempts = 0;
  const maxAttempts = 5;
  let questionText, question, options;
  do {
    questionText = await generateQuestion();
    const parsed = parseQuestionAndOptions(questionText);
    question = parsed.question;
    options = parsed.options;
    attempts++;
    if (attempts >= maxAttempts) {
      console.log("⚠️ Max attempts reached, using current question");
      break;
    }
  } while (askedQuestions.has(question));

  askedQuestions.add(question);
  return { question, options };
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  try {
    await initDatabase();
    await hydrateAskedQuestionsFromDb();
  } catch (err) {
    console.error("❌ Failed to initialize database:", err);
    process.exit(1);
  }

  console.log(`⏰ Daily question cron schedule: "${QUESTION_CRON}" (server time)`);
  console.log(`🕒 Current server time: ${new Date().toLocaleString()}`);
  console.log(`🗓️ Question timezone for date calculations: ${QUESTION_TIMEZONE}`);

  let verifiedChannel = null;
  try {
    verifiedChannel = await fetchQuestionChannel();
    console.log(`📡 Target channel resolved: #${verifiedChannel.name} (${verifiedChannel.id})`);
    await catchUpQuestionIfMissing(verifiedChannel);
  } catch (err) {
    console.error("❌ Unable to verify channel or send catch-up question:", err);
  }

  cron.schedule(QUESTION_CRON, async () => {
    console.log("⏰ Cron job triggered at:", new Date().toLocaleString());
    try {
      const channel = verifiedChannel ?? (await fetchQuestionChannel());
      await postDailyQuestion(channel, { reason: "cron", referenceDate: new Date() });
    } catch (err) {
      console.error("❌ Error sending scheduled question:", err);
    }
  });
});

client.login(process.env.DISCORD_TOKEN);

async function gracefulShutdown(signal) {
  try {
    console.log(`\n🛑 Received ${signal}. Closing resources...`);
    await pool.end();
    client.destroy();
    cleanupLockFile();
  } catch (err) {
    console.error("❌ Error during shutdown:", err);
  } finally {
    cleanupLockFile(); // Ensure lock file is removed even if errors occur
    process.exit(0);
  }
}

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => gracefulShutdown(signal));
});
