const fs = require('fs');
const path = require('path');

// Đọc .env.production file
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env.production');
  const envVars = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim();
          const value = trimmed.substring(eqIndex + 1).trim();
          envVars[key] = value;
        }
      }
    }
  }
  return envVars;
}

const envVars = loadEnvFile();

module.exports = {
  apps: [
    {
      name: "ban-tru",
      script: ".next/standalone/server.js",
      cwd: "/var/www/ban-tru",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        PORT: "3003",
        HOSTNAME: "127.0.0.1",
        ...envVars
      },
      error_file: "/root/.pm2/logs/ban-tru-error.log",
      out_file: "/root/.pm2/logs/ban-tru-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss"
    }
  ]
};
