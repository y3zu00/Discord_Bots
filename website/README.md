# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/94cccc56-5f19-4da0-a06d-715313cd5e83

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/94cccc56-5f19-4da0-a06d-715313cd5e83) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/94cccc56-5f19-4da0-a06d-715313cd5e83) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Real Signals via Neon/PostgreSQL

The dashboard now pulls live signals directly from the shared Neon/PostgreSQL database—no local SQLite file is required.

1) Configure your Neon connection string in `website/.env`:

```
DATABASE_URL='postgresql://<user>:<password>@<host>/<database>?sslmode=require'
```

2) Start the API and frontend (from `website/`):

```sh
npm run server   # starts API on :8787 (reads DATABASE_URL)
npm run dev      # starts Vite on :8080 and proxies /api
```

The API automatically keeps the `signals` table pruned and falls back to CoinGecko market data only if Postgres is unreachable.

## Database migrations

Keep the database schema in sync before starting the server:

```sh
npm run migrate
# or from the repo root
python migrations/run_migrations.py
```

Migrations are tracked in the database and safe to run multiple times.

## Process manager (PM2)

To keep the backend and bots running in production, use the shared PM2 config:

```sh
npm install -g pm2
pm2 start pm2.config.cjs
```

This launches the website server alongside every bot using their own `.env` files.
