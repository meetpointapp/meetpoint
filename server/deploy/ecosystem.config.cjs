// pm2 ile çoklu süreç: npm run build sonrası  pm2 start deploy/ecosystem.config.cjs --env production
// Cluster modu tek bağlantı noktasını (PORT) süreçler arasında paylaştırır. Uygulama Socket.IO'yu sadece
// websocket ile kullandığı için yapışkan oturum (sticky session) gerekmez.
// Zamanlayıcı lider kilidiyle çalışır: süreç sayısı kaç olursa olsun zamanlanmış işleri yalnızca biri yapar.
module.exports = {
  apps: [
    {
      name: 'vibeupme-api',
      script: 'dist/index.js',
      cwd: __dirname + '/..',
      exec_mode: 'cluster',
      // 4 çekirdekli makinede 3 süreç; kalan çekirdek PostgreSQL ve Redis'e. Büyük makinede: çekirdek sayısı - 1
      instances: Number(process.env.API_INSTANCES || 3),
      max_memory_restart: '1500M',
      kill_timeout: 15000, // düzgün kapanma (liderlik kilidi bırakılır, bağlantılar kapatılır)
      wait_ready: false,
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
