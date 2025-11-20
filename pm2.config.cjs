module.exports = {
  apps: [
    {
      name: "signals-bot",
      cwd: "./signals-bot",
      script: "main.py",
      interpreter: process.platform === "win32" ? "python" : "python3",
      env_file: "./signals-bot/.env",
    },
    {
      name: "trading-mentor-bot",
      cwd: "./trading-mentor-bot",
      script: "index.js",
      interpreter: "node",
      env_file: "./trading-mentor-bot/.env",
    },
    {
      name: "question-daily-bot",
      cwd: "./question-daily-bot",
      script: "index.js",
      interpreter: "node",
      env_file: "./question-daily-bot/.env",
    },
    {
      name: "news-bot",
      cwd: "./news-bot",
      script: "index.js",
      interpreter: "node",
      env_file: "./news-bot/.env",
    },
    {
      name: "website-server",
      cwd: "./website",
      script: "server/server.js",
      interpreter: "node",
      env_file: "./website/.env",
    },
  ],
};


