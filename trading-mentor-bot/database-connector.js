const { Pool } = require('pg');

class DatabaseConnector {
    constructor() {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error('DATABASE_URL is not configured for the trading mentor bot');
        }

        const ssl = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
            ? false
            : { rejectUnauthorized: false };

        this.pool = new Pool({
            connectionString,
            max: 10,
            ssl,
        });

        console.log('🔗 Connected to shared Neon/Postgres database');
        this.ready = this.initTables().catch((err) => {
            console.error('❌ Failed to initialise Postgres tables for trading mentor bot:', err);
            throw err;
        });
    }

    static getInstance() {
        if (!DatabaseConnector.instance) {
            DatabaseConnector.instance = new DatabaseConnector();
        }
        return DatabaseConnector.instance;
    }

    async initTables() {
        const statements = [
            `CREATE TABLE IF NOT EXISTS user_profile (
                user_id TEXT PRIMARY KEY,
                username TEXT,
                skill_level TEXT,
                risk_appetite TEXT,
                focus TEXT,
                trading_style TEXT,
                goals TEXT,
                trading_experience TEXT,
                preferred_timeframe TEXT,
                risk_tolerance TEXT,
                learning_goals TEXT,
                last_active TIMESTAMPTZ DEFAULT now()
            )`,
            `CREATE TABLE IF NOT EXISTS daily_questions (
                id BIGSERIAL PRIMARY KEY,
                question_text TEXT NOT NULL,
                correct_answer TEXT NOT NULL,
                options TEXT NOT NULL,
                posted_date DATE UNIQUE NOT NULL,
                posted_time TIMESTAMPTZ DEFAULT now(),
                answer_revealed BOOLEAN DEFAULT false
            )`,
            `CREATE TABLE IF NOT EXISTS question_responses (
                id BIGSERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                question_id BIGINT NOT NULL REFERENCES daily_questions(id) ON DELETE CASCADE,
                selected_answer TEXT NOT NULL,
                is_correct BOOLEAN NOT NULL,
                response_time TIMESTAMPTZ DEFAULT now(),
                response_delay_seconds INTEGER,
                UNIQUE(user_id, question_id)
            )`,
            `CREATE TABLE IF NOT EXISTS learning_progress (
                id BIGSERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                module_name TEXT NOT NULL,
                completion_percentage INTEGER DEFAULT 0,
                time_spent_minutes INTEGER DEFAULT 0,
                last_accessed TIMESTAMPTZ DEFAULT now(),
                quiz_scores TEXT DEFAULT '[]',
                UNIQUE(user_id, module_name)
            )`
        ];

        for (const text of statements) {
            await this.pool.query(text);
        }

        console.log('✅ Verified mentor tables in Postgres');
    }

    async query(text, params = []) {
        await this.ready;
        return this.pool.query(text, params);
    }

    async createUserProfile(userId, username, options = {}) {
        const params = [
            String(userId),
            username,
            options.skill_level || null,
            options.risk_appetite || null,
            options.focus || null,
            options.trading_style || null,
            options.goals || null,
            options.trading_experience || 'beginner',
            options.preferred_timeframe || '1h',
            options.risk_tolerance || 'moderate',
            options.learning_goals || '',
        ];

        await this.query(
            `INSERT INTO user_profile (
                user_id,
                username,
                skill_level,
                risk_appetite,
                focus,
                trading_style,
                goals,
                trading_experience,
                preferred_timeframe,
                risk_tolerance,
                learning_goals,
                last_active
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now()
            )
            ON CONFLICT (user_id)
            DO UPDATE SET
                username = EXCLUDED.username,
                skill_level = EXCLUDED.skill_level,
                risk_appetite = EXCLUDED.risk_appetite,
                focus = EXCLUDED.focus,
                trading_style = EXCLUDED.trading_style,
                goals = EXCLUDED.goals,
                trading_experience = EXCLUDED.trading_experience,
                preferred_timeframe = EXCLUDED.preferred_timeframe,
                risk_tolerance = EXCLUDED.risk_tolerance,
                learning_goals = EXCLUDED.learning_goals,
                last_active = now();`,
            params,
        );

        return userId;
    }

    async getUserProfile(userId) {
        const { rows } = await this.query(
            'SELECT * FROM user_profile WHERE user_id = $1 LIMIT 1',
            [String(userId)],
        );
        return rows[0] || null;
    }

    async updateUserPreferences(userId, updates = {}) {
        const allowed = {
            skill_level: 'skill_level',
            risk_appetite: 'risk_appetite',
            focus: 'focus',
            trading_style: 'trading_style',
            goals: 'goals',
            trading_experience: 'trading_experience',
            preferred_timeframe: 'preferred_timeframe',
            risk_tolerance: 'risk_tolerance',
            learning_goals: 'learning_goals',
        };

        const entries = Object.entries(updates || {}).filter(([key, value]) =>
            allowed[key] && value !== undefined && value !== null,
        );

        if (entries.length === 0) {
            return 0;
        }

        const setFragments = entries.map(([key], index) => `${allowed[key]} = $${index + 2}`);
        const values = entries.map(([, value]) => value);

        const result = await this.query(
            `UPDATE user_profile
             SET ${setFragments.join(', ')}, last_active = now()
             WHERE user_id = $1`,
            [String(userId), ...values],
        );

        return result.rowCount || 0;
    }

    async updateUserActivity(userId) {
        const result = await this.query(
            'UPDATE user_profile SET last_active = now() WHERE user_id = $1',
            [String(userId)],
        );
        return result.rowCount || 0;
    }

    async updateLearningProgress(userId, moduleName, completionPercentage, timeSpent = 0) {
        await this.query(
            `INSERT INTO learning_progress (
                user_id,
                module_name,
                completion_percentage,
                time_spent_minutes,
                last_accessed
            ) VALUES ($1, $2, $3, $4, now())
            ON CONFLICT (user_id, module_name)
            DO UPDATE SET
                completion_percentage = EXCLUDED.completion_percentage,
                time_spent_minutes = EXCLUDED.time_spent_minutes,
                last_accessed = now();`,
            [String(userId), moduleName, completionPercentage, timeSpent],
        );
        return true;
    }

    async getUserLearningProgress(userId) {
        const { rows } = await this.query(
            `SELECT module_name, completion_percentage, time_spent_minutes, last_accessed
             FROM learning_progress
             WHERE user_id = $1
             ORDER BY last_accessed DESC`,
            [String(userId)],
        );
        return rows;
    }

    async getUserPortfolio(userId) {
        const { rows } = await this.query(
            `SELECT symbol, quantity, cost_basis, created_at
             FROM portfolio_positions
             WHERE user_id = $1 AND closed_at IS NULL
             ORDER BY created_at DESC`,
            [String(userId)],
        );

        return rows.map((row) => ({
            symbol: row.symbol,
            shares: Number(row.quantity ?? 0),
            avg_price: Number(row.cost_basis ?? 0),
            entry_date: row.created_at,
        }));
    }

    async getUserWatchlist(userId) {
        const { rows } = await this.query(
            `SELECT symbol, created_at
             FROM watchlist
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [String(userId)],
        );

        return rows.map((row) => ({
            symbol: row.symbol,
            added_at: row.created_at,
        }));
    }

    async getUserQuestionStats(userId) {
        const { rows } = await this.query(
            `SELECT
                COUNT(*)::int AS total_questions,
                SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::int AS correct_answers,
                ROUND(AVG(COALESCE(response_delay_seconds, 0))::numeric, 2) AS avg_response_time
             FROM question_responses
             WHERE user_id = $1`,
            [String(userId)],
        );
        const row = rows[0];
        if (!row) {
            return { total_questions: 0, correct_answers: 0, avg_response_time: 0 };
        }
        return {
            total_questions: row.total_questions ?? 0,
            correct_answers: row.correct_answers ?? 0,
            avg_response_time: Number(row.avg_response_time ?? 0),
        };
    }

    async getUserStats(userId) {
        try {
            const profile = await this.getUserProfile(userId);
            if (!profile) {
                return null;
            }

            const [portfolio, watchlist, questionStats, learningProgress] = await Promise.all([
                this.getUserPortfolio(userId),
                this.getUserWatchlist(userId),
                this.getUserQuestionStats(userId),
                this.getUserLearningProgress(userId),
            ]);

            const totalPortfolioValue = portfolio.reduce((sum, position) => sum + (position.shares * position.avg_price), 0);
            const totalLearningCompletion = learningProgress.length > 0
                ? learningProgress.reduce((sum, module) => sum + Number(module.completion_percentage || 0), 0) / learningProgress.length
                : 0;

            return {
                profile,
                portfolio: {
                    positions: portfolio.length,
                    symbols: portfolio.map((p) => p.symbol),
                    totalValue: Number(totalPortfolioValue.toFixed(2)),
                },
                watchlist: {
                    symbols: watchlist.map((w) => w.symbol),
                    count: watchlist.length,
                },
                questions: questionStats,
                learning: {
                    moduleCount: learningProgress.length,
                    totalCompletion: Number(totalLearningCompletion.toFixed(2)),
                    modules: learningProgress.map((module) => ({
                        name: module.module_name,
                        completion: module.completion_percentage,
                        timeSpent: module.time_spent_minutes,
                    })),
                },
            };
        } catch (error) {
            console.error('Error getting user stats:', error);
            return null;
        }
    }

    async getQuestionLeaderboard(days = 30) {
        const rawDays = Number(days);
        const safeDays = Number.isFinite(rawDays) && rawDays > 0 ? Math.floor(rawDays) : 30;

        const { rows } = await this.query(
            `SELECT
                up.username,
                COUNT(qr.id)::int AS total_questions,
                COALESCE(SUM(CASE WHEN qr.is_correct THEN 1 ELSE 0 END), 0)::int AS correct_answers,
                ROUND(AVG(COALESCE(qr.response_delay_seconds, 0))::numeric, 2) AS avg_response_time
             FROM user_profile up
             LEFT JOIN question_responses qr ON up.user_id = qr.user_id
             LEFT JOIN daily_questions dq ON qr.question_id = dq.id
             WHERE dq.posted_date IS NULL OR dq.posted_date >= CURRENT_DATE - ($1::int) * INTERVAL '1 day'
             GROUP BY up.user_id, up.username
             ORDER BY correct_answers DESC, avg_response_time ASC
             LIMIT 10`,
            [safeDays],
        );

        return rows.map((row) => ({
            username: row.username || 'Unknown trader',
            total_questions: row.total_questions ?? 0,
            correct_answers: row.correct_answers ?? 0,
            avg_response_time: Number(row.avg_response_time ?? 0),
        }));
    }

    async getCourseProgress(userId) {
        const modules = [
            'Trading Psychology',
            'Risk Management',
            'Technical Analysis',
            'Advanced Strategies',
            'Live Trading Sessions',
        ];

        const progress = await this.getUserLearningProgress(userId);

        const courseProgress = modules.map((module) => {
            const match = progress.find((entry) => entry.module_name === module);
            return {
                module,
                completion: match ? match.completion_percentage : 0,
                timeSpent: match ? match.time_spent_minutes : 0,
                lastAccessed: match ? match.last_accessed : null,
            };
        });

        const totalCompletion = courseProgress.reduce((sum, item) => sum + item.completion, 0) / modules.length;

        return {
            modules: courseProgress,
            totalCompletion: Math.round(totalCompletion),
            completedModules: courseProgress.filter((p) => p.completion >= 100).length,
            totalModules: modules.length,
        };
    }

    async close() {
        if (this.pool) {
            await this.pool.end().catch((err) => {
                console.error('❌ Error closing Postgres pool:', err);
            });
            this.pool = null;
        }
    }

    async healthCheck() {
        try {
            await this.query('SELECT 1');
            console.log('✅ Postgres health check passed');
            return true;
        } catch (error) {
            console.error('❌ Postgres health check failed:', error);
            throw error;
        }
    }

    static async shutdown() {
        if (DatabaseConnector.instance) {
            console.log('🔄 Shutting down Postgres pool...');
            await DatabaseConnector.instance.close();
            DatabaseConnector.instance = null;
        }
    }
}

module.exports = DatabaseConnector;
