# Database migrations

All services share the same PostgreSQL database. The repository now ships with
a lightweight migration runner so schema changes can be applied once and tracked
forever.

## Running migrations

```bash
python migrations/run_migrations.py
```

The script will:

1. Load `DATABASE_URL` from any available `.env` file (`.env`, `website/.env`,
   `signals-bot/.env`, `trading-mentor-bot/.env`).
2. Ensure the `schema_migrations` table exists.
3. Execute any `*.sql` files in `migrations/sql` that have not been applied yet.

The process is idempotent—you can run it as often as you like. Each migration is
logged in `schema_migrations` so it only runs once per database.

## Creating a new migration

1. Create a new SQL file inside `migrations/sql/` with a numeric prefix, for
   example `002_add_new_table.sql`.
2. Put your SQL inside the file. Multiple statements are fine.
3. Run the migration runner: `python migrations/run_migrations.py`.

Keep migrations additive and backwards compatible. If you need to modify or
drop columns, add the necessary guards (e.g. `IF EXISTS`).


