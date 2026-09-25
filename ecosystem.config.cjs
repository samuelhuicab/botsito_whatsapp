// Configuración de pm2 para producción.
// Uso: pm2 start ecosystem.config.cjs  ·  pm2 logs botsito  ·  pm2 restart botsito

module.exports = {
  apps: [
    {
      name: 'botsito',
      script: 'src/index.js',
      cwd: __dirname,
      instances: 1, // WhatsApp solo permite una sesión por carpeta data/: nunca subir esto
      exec_mode: 'fork',
      autorestart: true,
      // Si se cae varias veces seguidas, espera cada vez más antes de reintentar.
      exp_backoff_restart_delay: 2000,
      // Chrome va creciendo en memoria; en un VPS de 1-2 GB conviene reiniciarlo antes de que se ahogue.
      max_memory_restart: '800M',
      // Tiempo para que Chrome cierre bien la sesión antes de matar el proceso.
      kill_timeout: 15000,
      time: true,
      env: {
        NODE_ENV: 'production',
        // Hora local solo para el bot (logs y recordatorios), sin cambiar la del servidor.
        TZ: 'America/Mexico_City',
      },
    },
  ],
};
