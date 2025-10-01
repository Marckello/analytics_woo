module.exports = {
  apps: [
    {
      name: 'adaptoheal-analytics-auth',
      script: 'server-ultimate.js',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      time: true
    }
  ]
}