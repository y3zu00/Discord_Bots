import json
import os
import datetime as dt
import logging
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests
import time
from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg import OperationalError
from psycopg_pool import ConnectionPool


load_dotenv()


class DatabaseManager:
    """PostgreSQL-backed storage for signals bot."""

    def __init__(self, dsn: Optional[str] = None) -> None:
        self.dsn = dsn or os.getenv("DATABASE_URL")
        if not self.dsn:
            raise RuntimeError("DATABASE_URL is not configured for the signals bot")
        # Autocommit so we don't need explicit conn.commit()
        self.pool = ConnectionPool(self.dsn, max_size=10, kwargs={"autocommit": True})
        try:
            self.signal_duplicate_window = max(
                0,
                int(
                    os.getenv(
                        "SIGNAL_DB_DUPLICATE_WINDOW_MINUTES",
                        os.getenv("SIGNAL_DUPLICATE_WINDOW_MINUTES", "120"),
                    )
                ),
            )
        except ValueError:
            self.signal_duplicate_window = 0
        self.init_database()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _execute(
        self,
        query: str,
        params: Optional[Iterable[Any]] = None,
        *,
        fetch: bool = False,
        fetchone: bool = False,
        row_factory=None,
    ):
        last_exc: Optional[Exception] = None
        for attempt in range(3):
            try:
                with self.pool.connection() as conn:
                    with conn.cursor(row_factory=row_factory) as cur:
                        cur.execute(query, params or ())
                        if fetchone:
                            return cur.fetchone()
                        if fetch:
                            return cur.fetchall()
                        return None
            except OperationalError as exc:
                last_exc = exc
                logging.warning("DB operation failed (attempt %s/3): %s", attempt + 1, exc)
                # Exponential backoff with cap
                time.sleep(min(2 ** attempt, 5))
                continue
        # If all retries failed, re-raise last exception
        if last_exc:
            raise last_exc
        return None

    def _execute_many(self, statements: Iterable[Tuple[str, Optional[Iterable[Any]]]]) -> None:
        last_exc: Optional[Exception] = None
        for attempt in range(3):
            try:
                with self.pool.connection() as conn:
                    with conn.cursor() as cur:
                        for query, params in statements:
                            cur.execute(query, params or ())
                return
            except OperationalError as exc:
                last_exc = exc
                logging.warning("DB batch operation failed (attempt %s/3): %s", attempt + 1, exc)
                time.sleep(min(2 ** attempt, 5))
                continue
        if last_exc:
            raise last_exc

    # ------------------------------------------------------------------
    # Schema
    # ------------------------------------------------------------------
    def init_database(self) -> None:
        statements = [
            (
                """
                CREATE TABLE IF NOT EXISTS signals (
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
                )
                """,
                None,
            ),
            ("ALTER TABLE signals ADD COLUMN IF NOT EXISTS display_symbol TEXT", None),
            ("ALTER TABLE signals ADD COLUMN IF NOT EXISTS signal_strength TEXT", None),
            ("ALTER TABLE signals ADD COLUMN IF NOT EXISTS asset_type TEXT DEFAULT 'equity'", None),
            ("ALTER TABLE signals ADD COLUMN IF NOT EXISTS recommendations TEXT", None),
            ("ALTER TABLE signals ADD COLUMN IF NOT EXISTS performance TEXT", None),
            ("ALTER TABLE signals ADD COLUMN IF NOT EXISTS details JSONB", None),
            ("ALTER TABLE signals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'", None),
            ("ALTER TABLE signals ADD COLUMN IF NOT EXISTS message_id TEXT", None),
            ("ALTER TABLE signals ADD COLUMN IF NOT EXISTS message_channel_id TEXT", None),
            (
                """
                CREATE TABLE IF NOT EXISTS signal_subscriptions (
                    id BIGSERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT now(),
                    UNIQUE(user_id, symbol)
                )
                """,
                None,
            ),
            (
                """
                CREATE TABLE IF NOT EXISTS watchlist (
                    user_id TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    position INTEGER NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT now(),
                    PRIMARY KEY (user_id, symbol)
                )
                """,
                None,
            ),
            ("CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist (user_id, position)", None),
            ("ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS asset_type TEXT", None),
            ("ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS display_symbol TEXT", None),
            ("ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS display_name TEXT", None),
            (
                """
                CREATE TABLE IF NOT EXISTS alerts (
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
                )
                """,
                None,
            ),
            ("CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts (user_id, symbol)", None),
            ("CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts (active, symbol)", None),
            ("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS asset_type TEXT", None),
            ("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS display_symbol TEXT", None),
            ("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS display_name TEXT", None),
            ("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ", None),
            (
                """
                CREATE TABLE IF NOT EXISTS portfolio_positions (
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
                    updated_at TIMESTAMPTZ DEFAULT now(),
                    closed_at TIMESTAMPTZ,
                    exit_price NUMERIC,
                    pnl NUMERIC,
                    last_notified_pnl NUMERIC
                )
                """,
                None,
            ),
            ("CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio_positions (user_id, symbol)", None),
            (
                """
                CREATE TABLE IF NOT EXISTS user_profile (
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
                )
                """,
                None,
            ),
            (
                """
                CREATE TABLE IF NOT EXISTS daily_questions (
                    id BIGSERIAL PRIMARY KEY,
                    question_text TEXT NOT NULL,
                    correct_answer TEXT NOT NULL,
                    options TEXT NOT NULL,
                    posted_date DATE UNIQUE NOT NULL,
                    posted_time TIMESTAMPTZ DEFAULT now(),
                    answer_revealed BOOLEAN DEFAULT false
                )
                """,
                None,
            ),
            (
                """
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
                """,
                None,
            ),
            (
                """
                CREATE TABLE IF NOT EXISTS learning_progress (
                    id BIGSERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    module_name TEXT NOT NULL,
                    completion_percentage INTEGER DEFAULT 0,
                    time_spent_minutes INTEGER DEFAULT 0,
                    last_accessed TIMESTAMPTZ DEFAULT now(),
                    quiz_scores TEXT DEFAULT '[]',
                    UNIQUE(user_id, module_name)
                )
                """,
                None,
            ),
        ]
        self._execute_many(statements)

    # ------------------------------------------------------------------
    # Signals
    # ------------------------------------------------------------------
    def add_signal(
        self,
        symbol: str,
        signal_type: str,
        price: Optional[float],
        recommendations: str,
        *,
        display_symbol: Optional[str] = None,
        signal_strength: Optional[str] = None,
        asset_type: str = "equity",
        details: Optional[Dict[str, Any]] = None,
    ) -> Optional[int]:
        if getattr(self, "signal_duplicate_window", 0) > 0:
            try:
                if self.has_recent_signal_any(symbol, self.signal_duplicate_window):
                    logging.info(
                        "Skipping duplicate signal for %s (within %s minutes)",
                        symbol,
                        self.signal_duplicate_window,
                    )
                    return None
            except Exception as dup_err:
                logging.debug("Duplicate signal check failed for %s: %s", symbol, dup_err)
        row = self._execute(
            """
            INSERT INTO signals (symbol, display_symbol, signal_type, price, recommendations, signal_strength, asset_type, details)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                symbol,
                display_symbol or symbol,
                signal_type,
                price,
                recommendations,
                signal_strength,
                asset_type,
                json.dumps(details) if details is not None else None,
            ),
            fetchone=True,
        )
        signal_id = None
        if row:
            if isinstance(row, dict):
                signal_id = row.get("id")
            else:
                signal_id = row[0]
        try:
            self.prune_old_signals()
        except Exception:
            pass
        try:
            site_url = os.getenv("SITE_SIGNAL_URL", "http://localhost:8787/api/signals")
            bot_token = os.getenv("SITE_BOT_TOKEN")
            if site_url:
                headers = {"Content-Type": "application/json"}
                if bot_token:
                    headers["x-bot-key"] = bot_token
                payload = {
                    "symbol": str(symbol or "").upper(),
                    "displaySymbol": str(display_symbol or symbol or "").upper(),
                    "type": "SELL" if str(signal_type).upper().startswith("SELL") else "BUY",
                    "price": float(price) if price is not None else None,
                    "description": str(recommendations or ""),
                    "signalStrength": signal_strength,
                    "assetType": asset_type,
                    "details": details,
                    "timestamp": dt.datetime.utcnow().isoformat(),
                }
                resp = requests.post(site_url, json=payload, headers=headers, timeout=5)
                if resp.status_code >= 400:
                    logging.warning("Mirror to website failed for %s: %s", symbol, resp.text[:200])
        except Exception as exc:
            logging.debug("Mirror to website raised error for %s: %s", symbol, exc)
        return signal_id

    def prune_old_signals(self, days: int = 10) -> None:
        days = max(int(days or 10), 1)
        self._execute(
            "DELETE FROM signals WHERE timestamp < now() - interval '%s days'",
            (days,),
        )

    def set_signal_message(self, signal_id: int, message_id: int, channel_id: Optional[int] = None) -> None:
        if channel_id is not None:
            self._execute(
                "UPDATE signals SET message_id = %s, message_channel_id = %s WHERE id = %s",
                (str(message_id), str(channel_id), signal_id),
            )
        else:
            self._execute(
                "UPDATE signals SET message_id = %s WHERE id = %s",
                (str(message_id), signal_id),
            )

    def get_signal_by_message(self, message_id: int) -> Optional[Dict[str, Any]]:
        row = self._execute(
            "SELECT id, symbol, status FROM signals WHERE message_id = %s LIMIT 1",
            (str(message_id),),
            fetchone=True,
        )
        if not row:
            return None
        if isinstance(row, dict):
            return row
        return {"id": row[0], "symbol": row[1], "status": row[2] if len(row) > 2 else None}

    def update_signal_status(self, signal_id: int, status: str) -> None:
        normalized = status.lower()
        self._execute(
            "UPDATE signals SET status = %s WHERE id = %s",
            (normalized, signal_id),
        )
        try:
            site_url = os.getenv("SITE_SIGNAL_URL", "http://localhost:8787/api/signals").rstrip("/")
            bot_token = os.getenv("SITE_BOT_TOKEN")
            if site_url:
                headers = {"Content-Type": "application/json"}
                if bot_token:
                    headers["x-bot-key"] = bot_token
                requests.patch(
                    f"{site_url}/{signal_id}",
                    json={"status": normalized},
                    headers=headers,
                    timeout=5,
                )
        except Exception as exc:
            logging.debug("Mirror status update failed for signal %s: %s", signal_id, exc)

    def delete_signal(self, signal_id: int) -> None:
        self._execute("DELETE FROM signals WHERE id = %s", (signal_id,))
        try:
            site_url = os.getenv("SITE_SIGNAL_URL", "http://localhost:8787/api/signals").rstrip("/")
            bot_token = os.getenv("SITE_BOT_TOKEN")
            if site_url:
                headers = {"Content-Type": "application/json"}
                if bot_token:
                    headers["x-bot-key"] = bot_token
                requests.delete(f"{site_url}/{signal_id}", headers=headers, timeout=5)
        except Exception as exc:
            logging.debug("Mirror delete failed for signal %s: %s", signal_id, exc)

    def has_recent_signal(self, symbol: str, minutes: int = 180) -> bool:
        row = self._execute(
            "SELECT 1 FROM signals WHERE symbol = %s AND status = 'active' AND timestamp >= now() - interval '%s minutes' LIMIT 1",
            (symbol.upper(), minutes),
            fetchone=True,
        )
        return row is not None

    def has_recent_signal_any(self, symbol: str, minutes: int = 180) -> bool:
        interval_minutes = max(int(minutes or 0), 0)
        if interval_minutes <= 0:
            return False
        row = self._execute(
            f"""
            SELECT 1
            FROM signals
            WHERE symbol = %s
              AND timestamp >= now() - interval '{interval_minutes} minutes'
            LIMIT 1
            """,
            (symbol.upper(),),
            fetchone=True,
        )
        return row is not None

    def get_signals_for_performance(self, recheck_minutes: int, limit: int = 12) -> List[Dict[str, Any]]:
        interval_minutes = max(int(recheck_minutes or 5), 5)
        rows = self._execute(
            f"""
            SELECT id, symbol, display_symbol, signal_type, price, timestamp, asset_type, details, performance, status
            FROM signals
            WHERE status IN ('active', 'pending')
              AND (
                details->'performance' IS NULL
                OR COALESCE(details->'performance'->>'status', 'open') = 'open'
              )
              AND (
                details->'performance'->>'evaluatedAt' IS NULL
                OR (details->'performance'->>'evaluatedAt')::timestamptz <= now() - interval '{interval_minutes} minutes'
              )
            ORDER BY timestamp DESC
            LIMIT %s
            """,
            (limit,),
            fetch=True,
            row_factory=dict_row,
        ) or []

        results: List[Dict[str, Any]] = []
        for row in rows:
            details = row.get("details")
            if isinstance(details, str):
                try:
                    details = json.loads(details)
                except json.JSONDecodeError:
                    details = None
            if isinstance(details, dict):
                row["details"] = details
            else:
                row["details"] = {}

            price_val = row.get("price")
            if isinstance(price_val, Decimal):
                row["price"] = float(price_val)

            results.append(row)
        return results

    def update_signal_performance(
        self,
        signal_id: int,
        performance_status: str,
        details: Dict[str, Any],
        *,
        new_status: Optional[str] = None,
    ) -> None:
        assignments: List[str] = []
        params: List[Any] = []

        if performance_status:
            assignments.append("performance = %s")
            params.append(performance_status)
        if new_status:
            assignments.append("status = %s")
            params.append(new_status)
        if details is not None:
            assignments.append("details = %s::jsonb")
            params.append(json.dumps(details))

        if not assignments:
            return

        params.append(signal_id)
        query = f"UPDATE signals SET {', '.join(assignments)} WHERE id = %s"
        self._execute(query, tuple(params))

        try:
            site_url = os.getenv("SITE_SIGNAL_URL", "http://localhost:8787/api/signals").rstrip("/")
            bot_token = os.getenv("SITE_BOT_TOKEN")
            if site_url:
                headers = {"Content-Type": "application/json"}
                if bot_token:
                    headers["x-bot-key"] = bot_token
                payload: Dict[str, Any] = {"performance": performance_status, "details": details}
                if new_status:
                    payload["status"] = new_status
                requests.patch(f"{site_url}/{signal_id}", json=payload, headers=headers, timeout=5)
        except Exception as exc:
            logging.debug("Mirror performance update failed for signal %s: %s", signal_id, exc)

    # ------------------------------------------------------------------
    # Signal admin notifications
    # ------------------------------------------------------------------
    def get_signal_by_id(self, signal_id: int) -> Optional[Dict[str, Any]]:
        row = self._execute(
            """
            SELECT id, symbol, display_symbol, signal_type, price, timestamp,
                   signal_strength, asset_type, recommendations, performance, details, status
            FROM signals
            WHERE id = %s
            """,
            (signal_id,),
            fetchone=True,
            row_factory=dict_row,
        )
        if not row:
            return None
        return self._normalize_signal_row(row)

    def get_signals_pending_admin_notify(self, limit: int = 25) -> List[Dict[str, Any]]:
        rows = self._execute(
            """
            SELECT id, symbol, display_symbol, signal_type, price, timestamp,
                   signal_strength, asset_type, recommendations, performance, details, status
            FROM signals
            WHERE details->'admin_notify'->>'pending' = 'true'
            ORDER BY COALESCE((details->'admin_notify'->>'lastResolvedAt')::timestamptz, timestamp) DESC
            LIMIT %s
            """,
            (limit,),
            fetch=True,
            row_factory=dict_row,
        ) or []
        return [self._normalize_signal_row(dict(row)) for row in rows]

    def mark_admin_notified(self, signal_id: int) -> None:
        row = self._execute(
            "SELECT details FROM signals WHERE id = %s",
            (signal_id,),
            fetchone=True,
        )
        if not row:
            return
        details = row[0] if isinstance(row, tuple) else row.get("details")
        if isinstance(details, str):
            try:
                details = json.loads(details)
            except json.JSONDecodeError:
                details = {}
        if not isinstance(details, dict):
            details = {}
        admin_meta = dict(details.get("admin_notify") or {})
        admin_meta["pending"] = False
        admin_meta["notifiedAt"] = dt.datetime.utcnow().isoformat()
        details["admin_notify"] = admin_meta
        self._execute(
            "UPDATE signals SET details = %s::jsonb WHERE id = %s",
            (json.dumps(details), signal_id),
        )

    def _normalize_signal_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        result = dict(row)
        for key in ("price",):
            val = result.get(key)
            if isinstance(val, Decimal):
                result[key] = float(val)
        details = result.get("details")
        if isinstance(details, str):
            try:
                details = json.loads(details)
            except json.JSONDecodeError:
                details = {}
        if isinstance(details, dict):
            result["details"] = details
        else:
            result["details"] = {}
        perf = result.get("performance")
        if isinstance(perf, str):
            try:
                result["performance"] = json.loads(perf)
            except json.JSONDecodeError:
                result["performance"] = {}
        return result

    # ------------------------------------------------------------------
    # Subscriptions
    # ------------------------------------------------------------------
    def toggle_subscription(self, user_id: int, symbol: str) -> bool:
        user = str(user_id)
        symbol_up = symbol.upper()
        exists = self._execute(
            "SELECT 1 FROM signal_subscriptions WHERE user_id = %s AND symbol = %s",
            (user, symbol_up),
            fetchone=True,
        )
        if exists:
            self._execute(
                "DELETE FROM signal_subscriptions WHERE user_id = %s AND symbol = %s",
                (user, symbol_up),
            )
            return False
        self._execute(
            "INSERT INTO signal_subscriptions (user_id, symbol) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (user, symbol_up),
        )
        return True

    def is_subscribed(self, user_id: int, symbol: str) -> bool:
        row = self._execute(
            "SELECT 1 FROM signal_subscriptions WHERE user_id = %s AND symbol = %s",
            (str(user_id), symbol.upper()),
            fetchone=True,
        )
        return row is not None

    def get_user_subscriptions(self, user_id: int) -> List[str]:
        rows = self._execute(
            "SELECT symbol FROM signal_subscriptions WHERE user_id = %s ORDER BY created_at DESC",
            (str(user_id),),
            fetch=True,
        )
        return [row[0] for row in rows]

    def get_symbol_subscribers(self, symbol: str) -> List[int]:
        rows = self._execute(
            "SELECT user_id FROM signal_subscriptions WHERE symbol = %s",
            (symbol.upper(),),
            fetch=True,
        )
        subscribers: List[int] = []
        for row in rows:
            try:
                subscribers.append(int(row[0]))
            except (ValueError, TypeError):
                continue
        return subscribers

    # ------------------------------------------------------------------
    # Watchlist
    # ------------------------------------------------------------------
    def get_user_watchlist(self, user_id: int) -> List[str]:
        rows = self._execute(
            "SELECT symbol FROM watchlist WHERE user_id = %s ORDER BY position ASC",
            (str(user_id),),
            fetch=True,
        )
        return [row[0] for row in rows]

    def add_to_watchlist(self, user_id: int, symbol: str) -> None:
        user = str(user_id)
        symbol_up = symbol.upper()
        next_position_row = self._execute(
            "SELECT COALESCE(MAX(position), 0) + 1 FROM watchlist WHERE user_id = %s",
            (user,),
            fetchone=True,
        )
        next_position = next_position_row[0] if next_position_row else 1
        self._execute(
            """
            INSERT INTO watchlist (user_id, symbol, position)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, symbol) DO UPDATE SET position = EXCLUDED.position
            """,
            (user, symbol_up, next_position),
        )

    def remove_from_watchlist(self, user_id: int, symbol: str) -> None:
        self._execute(
            "DELETE FROM watchlist WHERE user_id = %s AND symbol = %s",
            (str(user_id), symbol.upper()),
        )

    # ------------------------------------------------------------------
    # Alerts
    # ------------------------------------------------------------------
    def add_alert(self, user_id: int, symbol: str, target_price: float, alert_type: str) -> None:
        self._execute(
            """
            INSERT INTO alerts (user_id, symbol, type, direction, threshold, window_tf, cooldown, active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, true)
            """,
            (
                str(user_id),
                symbol.upper(),
                'price',
                '>=' if alert_type.upper() != 'PRICE_BELOW' else '<=',
                target_price,
                '1h',
                'none',
            ),
        )

    def get_user_alerts(self, user_id: int) -> List[Tuple[str, float, str, str, str]]:
        rows = self._execute(
            """
            SELECT symbol, threshold, type, created_at, direction
            FROM alerts
            WHERE user_id = %s AND active = true
            ORDER BY created_at DESC
            """,
            (str(user_id),),
            fetch=True,
        )
        result: List[Tuple[str, float, str, str, str]] = []
        for symbol, threshold, alert_type, created_at, direction in rows:
            created_str = created_at.isoformat() if created_at else ""
            price = float(threshold) if threshold is not None else 0.0
            result.append((symbol, price, (alert_type or "price").upper(), created_str, direction or '>='))
        return result

    def get_all_active_alerts(self) -> List[Tuple[int, int, str, float, str, str, Optional[str], Optional[str], Optional[str]]]:
        rows = self._execute(
            """
            SELECT id, user_id, symbol, threshold, type, direction, asset_type, display_symbol, display_name
            FROM alerts
            WHERE active = true
            """,
            fetch=True,
        )
        result: List[Tuple[int, int, str, float, str, str, Optional[str], Optional[str], Optional[str]]] = []
        for alert_id, user_id, symbol, threshold, alert_type, direction, asset_type, display_symbol, display_name in rows:
            try:
                uid_int = int(user_id)
            except (ValueError, TypeError):
                continue
            price = float(threshold) if threshold is not None else 0.0
            result.append((int(alert_id), uid_int, symbol, price, alert_type or 'price', direction or '>=', asset_type, display_symbol, display_name))
        return result

    def mark_alert_triggered(self, alert_id: int) -> bool:
        """Mark the alert as triggered. Returns True if it was active and updated."""
        row = self._execute(
            "UPDATE alerts SET active = false, last_triggered_at = now() WHERE id = %s AND active = true RETURNING id",
            (alert_id,),
            fetchone=True,
        )
        return bool(row)

    def set_alert_active(self, alert_id: int, user_id: int, active: bool) -> None:
        """Activate or deactivate an alert for the given user."""
        self._execute(
            "UPDATE alerts SET active = %s WHERE id = %s AND user_id = %s",
            (active, alert_id, str(user_id)),
        )

    def delete_alert(self, alert_id: int, user_id: int) -> None:
        """Delete an alert owned by the given user."""
        self._execute(
            "DELETE FROM alerts WHERE id = %s AND user_id = %s",
            (alert_id, str(user_id)),
        )

    def update_alert_threshold(self, alert_id: int, user_id: int, threshold: float) -> None:
        """Update the alert threshold and reactivate the alert."""
        self._execute(
            "UPDATE alerts SET threshold = %s, active = true WHERE id = %s AND user_id = %s",
            (threshold, alert_id, str(user_id)),
        )

    # ------------------------------------------------------------------
    # Portfolio
    # ------------------------------------------------------------------
    def get_portfolio_positions_for_notifications(self) -> List[Tuple[int, int, str, float, float, Optional[float], Optional[float]]]:
        rows = self._execute(
            """
            SELECT pp.id, pp.user_id, pp.symbol,
                   COALESCE(pp.quantity, 0) AS quantity,
                   COALESCE(pp.cost_basis, 0) AS cost_basis,
                   pp.last_notified_pnl,
                   u.preferences
            FROM portfolio_positions pp
            LEFT JOIN users u ON u.discord_id = pp.user_id
            WHERE pp.closed_at IS NULL
            """,
            fetch=True,
        )
        result: List[Tuple[int, int, str, float, float, Optional[float], Optional[float]]] = []
        for pid, user_id, symbol, quantity, cost_basis, last_notified, preferences in rows:
            try:
                uid_int = int(user_id)
            except (ValueError, TypeError):
                continue
            qty = float(quantity) if quantity is not None else 0.0
            basis = float(cost_basis) if cost_basis is not None else 0.0
            last = float(last_notified) if isinstance(last_notified, (int, float, Decimal)) else None
            threshold = self._extract_portfolio_threshold(preferences)
            result.append((int(pid), uid_int, symbol, qty, basis, last, threshold))
        return result

    def update_portfolio_notification_pnl(self, position_id: int, pnl: float) -> None:
        self._execute(
            "UPDATE portfolio_positions SET last_notified_pnl = %s, updated_at = now() WHERE id = %s",
            (pnl, position_id),
        )

    def add_portfolio_position(self, user_id: int, symbol: str, shares: float, avg_price: float) -> None:
        self._execute(
            """
            INSERT INTO portfolio_positions (user_id, symbol, quantity, cost_basis)
            VALUES (%s, %s, %s, %s)
            """,
            (str(user_id), symbol.upper(), shares, avg_price),
        )

    def get_user_portfolio(self, user_id: int) -> List[Tuple[str, float, float, str]]:
        rows = self._execute(
            """
            SELECT symbol, quantity, cost_basis, created_at
            FROM portfolio_positions
            WHERE user_id = %s AND closed_at IS NULL
            ORDER BY created_at DESC
            """,
            (str(user_id),),
            fetch=True,
        )
        result: List[Tuple[str, float, float, str]] = []
        for symbol, quantity, cost_basis, created_at in rows:
            qty = float(quantity) if quantity is not None else 0.0
            basis = float(cost_basis) if cost_basis is not None else 0.0
            created_str = created_at.isoformat() if created_at else ""
            result.append((symbol, qty, basis, created_str))
        return result

    def close_portfolio_position(self, user_id: int, symbol: str, exit_price: float) -> Optional[float]:
        row = self._execute(
            """
            SELECT id, quantity, cost_basis
            FROM portfolio_positions
            WHERE user_id = %s AND symbol = %s AND closed_at IS NULL
            ORDER BY created_at ASC
            LIMIT 1
            """,
            (str(user_id), symbol.upper()),
            fetchone=True,
        )
        if not row:
            return None
        position_id, quantity, cost_basis = row
        qty = float(quantity) if quantity is not None else 0.0
        basis = float(cost_basis) if cost_basis is not None else 0.0
        pnl = (exit_price - basis) * qty
        self._execute(
            """
            UPDATE portfolio_positions
            SET closed_at = now(), exit_price = %s, pnl = %s, updated_at = now()
            WHERE id = %s
            """,
            (exit_price, pnl, position_id),
        )
        return pnl

    def _extract_portfolio_threshold(self, preferences: Any) -> Optional[float]:
        default_threshold = 5.0
        prefs_obj: Dict[str, Any] = {}
        if isinstance(preferences, str):
            try:
                prefs_obj = json.loads(preferences)
            except json.JSONDecodeError:
                prefs_obj = {}
        elif isinstance(preferences, dict):
            prefs_obj = dict(preferences)

        general = prefs_obj.get('general') if isinstance(prefs_obj.get('general'), dict) else {}
        raw_value = general.get('portfolioNotifyPct')
        if raw_value is None:
            logging.debug(f"Portfolio threshold: None, using default {default_threshold}")
            return default_threshold
        if isinstance(raw_value, str):
            if raw_value.lower() in {'off', 'none', 'disable', 'disabled'}:
                logging.debug("Portfolio threshold: 'off' detected, returning None")
                return None
            try:
                raw_value = float(raw_value)
            except ValueError:
                logging.warning(f"Portfolio threshold: invalid string '{raw_value}', using default {default_threshold}")
                return default_threshold
        if isinstance(raw_value, (int, float)):
            val = float(raw_value)
            if val <= 0:
                logging.debug(f"Portfolio threshold: {val} <= 0, returning None (disabled)")
                return None
            result = max(1.0, min(15.0, val))
            logging.debug(f"Portfolio threshold: extracted {val}, clamped to {result}")
            return result
        logging.warning(f"Portfolio threshold: unexpected type {type(raw_value)}, using default {default_threshold}")
        return default_threshold

    # ------------------------------------------------------------------
    # User profiles
    # ------------------------------------------------------------------
    def create_user_profile(self, user_id: int, username: str, **kwargs) -> None:
        self._execute(
            """
            INSERT INTO user_profile (user_id, username, skill_level, risk_appetite, focus, trading_style, goals,
                                      trading_experience, preferred_timeframe, risk_tolerance, learning_goals, last_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (user_id) DO UPDATE SET
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
                last_active = now()
            """,
            (
                str(user_id),
                username,
                kwargs.get('trading_experience', 'beginner'),
                kwargs.get('risk_tolerance', 'moderate'),
                kwargs.get('preferred_timeframe', '1h'),
                kwargs.get('trading_style', 'swing'),
                kwargs.get('learning_goals', ''),
                kwargs.get('trading_experience', 'beginner'),
                kwargs.get('preferred_timeframe', '1h'),
                kwargs.get('risk_tolerance', 'moderate'),
                kwargs.get('learning_goals', ''),
            ),
        )

    def get_user_profile(self, user_id: int) -> Optional[Dict[str, Any]]:
        row = self._execute(
            "SELECT * FROM user_profile WHERE user_id = %s",
            (str(user_id),),
            fetchone=True,
            row_factory=dict_row,
        )
        return dict(row) if row else None

    def update_user_activity(self, user_id: int) -> None:
        self._execute(
            "UPDATE user_profile SET last_active = now() WHERE user_id = %s",
            (str(user_id),),
        )

    def update_user_preferences(self, user_id: int, **kwargs) -> None:
        if not kwargs:
            return
        columns = []
        values: List[Any] = []
        mapping = {
            'trading_experience': 'trading_experience',
            'preferred_timeframe': 'preferred_timeframe',
            'risk_tolerance': 'risk_tolerance',
            'learning_goals': 'learning_goals',
            'skill_level': 'skill_level',
            'focus': 'focus',
            'risk_appetite': 'risk_appetite',
            'trading_style': 'trading_style',
            'goals': 'goals',
        }
        for key, value in kwargs.items():
            column = mapping.get(key, key)
            columns.append(column)
            values.append(value)
        if not columns:
            return
        set_clause = ', '.join(f"{col} = %s" for col in columns)
        set_clause = f"{set_clause}, last_active = now()"
        values.append(str(user_id))
        query = f"UPDATE user_profile SET {set_clause} WHERE user_id = %s"
        self._execute(query, values)

    # ------------------------------------------------------------------
    # Daily questions & learning
    # ------------------------------------------------------------------
    def add_daily_question(self, question_text: str, correct_answer: str, options: List[str], posted_date: str) -> None:
        options_str = ','.join(options)
        self._execute(
            """
            INSERT INTO daily_questions (question_text, correct_answer, options, posted_date)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (posted_date) DO UPDATE SET
                question_text = EXCLUDED.question_text,
                correct_answer = EXCLUDED.correct_answer,
                options = EXCLUDED.options,
                posted_time = now()
            """,
            (question_text, correct_answer, options_str, posted_date),
        )

    def get_todays_question(self) -> Optional[Dict[str, Any]]:
        today = dt.date.today()
        row = self._execute(
            "SELECT * FROM daily_questions WHERE posted_date = %s",
            (today,),
            fetchone=True,
            row_factory=dict_row,
        )
        return dict(row) if row else None

    def record_question_response(self, user_id: int, question_id: int, selected_answer: str, is_correct: bool, response_delay: int) -> None:
        self._execute(
            """
            INSERT INTO question_responses (user_id, question_id, selected_answer, is_correct, response_delay_seconds)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (user_id, question_id) DO UPDATE SET
                selected_answer = EXCLUDED.selected_answer,
                is_correct = EXCLUDED.is_correct,
                response_delay_seconds = EXCLUDED.response_delay_seconds,
                response_time = now()
            """,
            (str(user_id), question_id, selected_answer, is_correct, response_delay),
        )

    def reveal_todays_answer(self) -> None:
        today = dt.date.today()
        self._execute(
            "UPDATE daily_questions SET answer_revealed = true WHERE posted_date = %s",
            (today,),
        )

    def get_question_leaderboard(self, days: int = 30) -> List[Tuple[str, int, int, float]]:
        rows = self._execute(
            """
            SELECT up.username,
                   COUNT(qr.id) AS total_questions,
                   SUM(CASE WHEN qr.is_correct THEN 1 ELSE 0 END) AS correct_answers,
                   ROUND(AVG(COALESCE(qr.response_delay_seconds, 0))::numeric, 2) AS avg_response_time
            FROM user_profile up
            LEFT JOIN question_responses qr ON up.user_id = qr.user_id
            LEFT JOIN daily_questions dq ON qr.question_id = dq.id
            WHERE dq.posted_date >= CURRENT_DATE - INTERVAL %s
            GROUP BY up.user_id, up.username
            ORDER BY correct_answers DESC, avg_response_time ASC
            LIMIT 10
            """,
            (f"{int(days)} days",),
            fetch=True,
        )
        result: List[Tuple[str, int, int, float]] = []
        for username, total_q, correct, avg_time in rows:
            avg_val = float(avg_time) if avg_time is not None else 0.0
            result.append((username or "Unknown", int(total_q or 0), int(correct or 0), avg_val))
        return result

    def update_learning_progress(self, user_id: int, module_name: str, completion_percentage: int, time_spent: int = 0) -> None:
        self._execute(
            """
            INSERT INTO learning_progress (user_id, module_name, completion_percentage, time_spent_minutes, last_accessed)
            VALUES (%s, %s, %s, %s, now())
            ON CONFLICT (user_id, module_name) DO UPDATE SET
                completion_percentage = EXCLUDED.completion_percentage,
                time_spent_minutes = EXCLUDED.time_spent_minutes,
                last_accessed = now()
            """,
            (str(user_id), module_name, completion_percentage, time_spent),
        )

    def get_user_learning_progress(self, user_id: int) -> List[Tuple[str, int, int, str]]:
        rows = self._execute(
            """
            SELECT module_name, completion_percentage, time_spent_minutes, last_accessed
            FROM learning_progress
            WHERE user_id = %s
            ORDER BY last_accessed DESC
            """,
            (str(user_id),),
            fetch=True,
        )
        result: List[Tuple[str, int, int, str]] = []
        for module_name, completion, time_spent, last_accessed in rows:
            last = last_accessed.isoformat() if last_accessed else ""
            result.append((module_name, int(completion or 0), int(time_spent or 0), last))
        return result

    def get_user_stats(self, user_id: int) -> Dict[str, Any]:
        profile = self.get_user_profile(user_id)
        if not profile:
            return {}
        stats: Dict[str, Any] = {"profile": profile}

        portfolio_row = self._execute(
            """
            SELECT COUNT(*) AS total_positions,
                   COALESCE(SUM(CASE WHEN closed_at IS NOT NULL THEN pnl ELSE 0 END), 0) AS total_pnl,
                   COUNT(CASE WHEN closed_at IS NOT NULL THEN 1 END) AS closed_positions
            FROM portfolio_positions
            WHERE user_id = %s
            """,
            (str(user_id),),
            fetchone=True,
        )
        if portfolio_row:
            stats["portfolio"] = {
                "total_positions": int(portfolio_row[0] or 0),
                "total_pnl": float(portfolio_row[1] or 0),
                "closed_positions": int(portfolio_row[2] or 0),
            }

        question_row = self._execute(
            "SELECT COUNT(*) AS total_questions, SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) AS correct_answers FROM question_responses WHERE user_id = %s",
            (str(user_id),),
            fetchone=True,
        )
        if question_row:
            total_questions = int(question_row[0] or 0)
            correct_answers = int(question_row[1] or 0)
            accuracy = round((correct_answers / total_questions) * 100, 2) if total_questions else 0
            stats["questions"] = {
                "total_questions": total_questions,
                "correct_answers": correct_answers,
                "accuracy": accuracy,
            }

        learning_row = self._execute(
            "SELECT COUNT(*) AS total_modules, AVG(completion_percentage) AS avg_completion FROM learning_progress WHERE user_id = %s",
            (str(user_id),),
            fetchone=True,
        )
        if learning_row:
            stats["learning"] = {
                "total_modules": int(learning_row[0] or 0),
                "avg_completion": round(float(learning_row[1] or 0), 2) if learning_row[1] is not None else 0,
            }

        return stats

    # ------------------------------------------------------------------
    # Analytics
    # ------------------------------------------------------------------
    def get_signals_stats(self, days: int = 30) -> Dict[str, Any]:
        row = self._execute(
            """
            SELECT COUNT(*) AS total_signals,
                   COUNT(DISTINCT symbol) AS unique_symbols,
                   AVG(NULLIF(performance::numeric, 0)) AS avg_performance
            FROM signals
            WHERE timestamp >= now() - interval %s
            """,
            (f"{int(days)} days",),
            fetchone=True,
        )
        if not row:
            return {"total_signals": 0, "unique_symbols": 0, "avg_performance": 0}
        avg_perf = float(row[2]) if row[2] is not None else 0
        return {
            "total_signals": int(row[0] or 0),
            "unique_symbols": int(row[1] or 0),
            "avg_performance": avg_perf,
        }


