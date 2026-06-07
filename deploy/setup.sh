#!/bin/bash
set -e

echo "=== GA4 Customer Report - VPS Setup ==="

# 1. System update
echo "[1/8] システム更新..."
apt update && apt upgrade -y

# 2. Install Node.js 22 LTS
echo "[2/8] Node.js インストール..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt install -y nodejs
fi
node -v
npm -v

# 3. Install Nginx
echo "[3/8] Nginx インストール..."
apt install -y nginx

# 4. Install Certbot
echo "[4/8] Certbot インストール..."
apt install -y certbot python3-certbot-nginx

# 5. Setup firewall
echo "[5/8] ファイアウォール設定..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 6. Install fail2ban
echo "[6/8] fail2ban インストール..."
apt install -y fail2ban
cat > /etc/fail2ban/jail.local << 'JAILEOF'
[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600

[nginx-limit-req]
enabled = true
port = http,https
filter = nginx-limit-req
logpath = /var/log/nginx/ga4kanri.error.log
maxretry = 5
bantime = 600
JAILEOF
systemctl enable fail2ban
systemctl restart fail2ban

# 7. Create app directory
echo "[7/8] アプリディレクトリ作成..."
mkdir -p /var/www/ga4-customer-report/data
chown -R www-data:www-data /var/www/ga4-customer-report

# 8. Setup SSL (run after DNS is configured)
echo "[8/8] SSL証明書取得..."
echo "DNSの設定が完了していることを確認してください。"
echo "以下のコマンドでSSL証明書を取得してください："
echo ""
echo "  certbot --nginx -d ga4kanri.customer8.jp"
echo ""

echo "=== セットアップ完了 ==="
echo ""
echo "次のステップ："
echo "1. DNS設定: ga4kanri.customer8.jp → 162.43.47.122"
echo "2. アプリをデプロイ: deploy.sh を実行"
echo "3. SSL証明書取得: certbot --nginx -d ga4kanri.customer8.jp"
