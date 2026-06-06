module.exports = {
  apps: [
    {
      name: "my-tg-agent",
      script: "bun",
      args: "start",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      cron_restart: "0 2,14 * * *",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
