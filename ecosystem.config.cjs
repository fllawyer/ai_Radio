module.exports = {
  apps: [
    {
      name: 'claudio',
      script: 'server.js',
      cwd: __dirname,
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
      },
      watch: false,
      autorestart: true,
      max_memory_restart: '300M',
      time: true,
    },
  ],
};
