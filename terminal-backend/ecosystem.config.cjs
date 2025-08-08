module.exports = {
  apps: [{
    name: 'terminal-backend',
    script: './src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 80,
      SERVE_STATIC: 'true',
      STATIC_PATH: '../terminal-ui/dist'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 80,
      SERVE_STATIC: 'true',
      STATIC_PATH: '../terminal-ui/dist'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}