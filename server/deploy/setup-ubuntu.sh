#!/usr/bin/env bash
# VibeUpMe sunucu kurulumu (Ubuntu 22.04/24.04, root olarak). Depoyu /opt/vibeupme içine aldıktan sonra:
#   sudo bash /opt/vibeupme/server/deploy/setup-ubuntu.sh
# Yaptıkları: paketler, Node 24, pm2, PostgreSQL + Redis ayarı, nginx yapılandırması, güvenlik duvarı.
# Parolalar rastgele üretilip /opt/vibeupme/secrets/ altına yazılır (sadece root okur). Betik tekrar çalıştırılabilir.
set -euo pipefail

APP_DIR=/opt/vibeupme
DEPLOY="$APP_DIR/server/deploy"
SECRETS="$APP_DIR/secrets"
[ "$(id -u)" = 0 ] || { echo "root olarak çalıştırın (sudo)"; exit 1; }
[ -d "$DEPLOY" ] || { echo "$DEPLOY bulunamadı: depoyu önce $APP_DIR içine alın"; exit 1; }

echo "==> Paketler"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ufw nginx redis-server postgresql postgresql-contrib certbot python3-certbot-nginx build-essential openssl

echo "==> Node 24"
if ! command -v node >/dev/null || ! node -v | grep -q '^v24'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2

echo "==> Kullanıcı ve klasörler"
id vibeupme >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash vibeupme
mkdir -p "$SECRETS" "$APP_DIR/uploads" "$APP_DIR/private-uploads"
chmod 700 "$SECRETS"
chown -R vibeupme:vibeupme "$APP_DIR/server" "$APP_DIR/uploads" "$APP_DIR/private-uploads"
chown vibeupme:vibeupme "$SECRETS"  # uygulama kullanıcısı (örn. Firebase anahtar dosyası) buradan okur; başkası giremez (700)

echo "==> PostgreSQL"
PGPASS_FILE="$SECRETS/db-password"
[ -f "$PGPASS_FILE" ] || openssl rand -hex 24 > "$PGPASS_FILE"
PGPASS=$(cat "$PGPASS_FILE")
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='vibeupme'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE vibeupme LOGIN PASSWORD '$PGPASS'"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='vibeupme'" | grep -q 1 \
  || sudo -u postgres createdb -O vibeupme vibeupme
CONFD=$(ls -d /etc/postgresql/*/main/conf.d | head -1)
cp "$DEPLOY/postgresql-vibeupme.conf" "$CONFD/vibeupme.conf"
systemctl restart postgresql
sudo -u postgres psql -d vibeupme -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements" || true

echo "==> Redis"
REDISPASS_FILE="$SECRETS/redis-password"
[ -f "$REDISPASS_FILE" ] || openssl rand -hex 24 > "$REDISPASS_FILE"
REDISPASS=$(cat "$REDISPASS_FILE")
sed "s/DEGISTIR-uzun-rastgele-bir-parola/$REDISPASS/" "$DEPLOY/redis-vibeupme.conf" > /etc/redis/vibeupme.conf
chown redis:redis /etc/redis/vibeupme.conf && chmod 640 /etc/redis/vibeupme.conf
grep -q 'include /etc/redis/vibeupme.conf' /etc/redis/redis.conf || echo 'include /etc/redis/vibeupme.conf' >> /etc/redis/redis.conf
systemctl restart redis-server
systemctl enable redis-server

echo "==> nginx"
cp "$DEPLOY/nginx-vibeupme.conf" /etc/nginx/sites-available/vibeupme
ln -sf /etc/nginx/sites-available/vibeupme /etc/nginx/sites-enabled/vibeupme
cp "$DEPLOY/nginx-vibeupme-site.conf" /etc/nginx/sites-available/vibeupme-site
ln -sf /etc/nginx/sites-available/vibeupme-site /etc/nginx/sites-enabled/vibeupme-site
rm -f /etc/nginx/sites-enabled/default
echo "   (HTTPS için: alan adlarını sunucuya yönlendirin, sonra certbot --nginx; ayrıntı aşağıdaki adımlarda)"

echo "==> Güvenlik duvarı (SSH, HTTP, HTTPS)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> pm2 açılışta başlasın"
env PATH="$PATH" pm2 startup systemd -u vibeupme --hp /home/vibeupme >/dev/null || true

cat <<MSG

Kurulum tamam. Sıradaki adımlar (ayrıntı: docs/yayin-sunucu-kurulumu.md):
  1) Parolalar:   cat $SECRETS/db-password   cat $SECRETS/redis-password
  2) $APP_DIR/server/.env dosyasını $DEPLOY/.env.production.example'dan oluşturup doldurun
     (DATABASE_URL ve REDIS_URL'e yukarıdaki parolaları yazın)
  3) vibeupme kullanıcısıyla:  cd $APP_DIR/server && npm ci && npx prisma migrate deploy && npm run build
  4) REDIS_URL=... npm run redis:check     (hepsi OK olmalı)
  5) pm2 start deploy/ecosystem.config.cjs --env production && pm2 save
  6) nginx -t && systemctl reload nginx && certbot --nginx -d api.vibeupme.com -d vibeupme.com -d www.vibeupme.com
MSG
