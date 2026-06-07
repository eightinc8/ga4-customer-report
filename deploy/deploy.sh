#!/bin/bash
set -e

APP_DIR="/var/www/ga4-customer-report"

echo "=== GA4 Customer Report - Deploy ==="

# 1. Stop current service
echo "[1/6] サービス停止..."
systemctl stop ga4report 2>/dev/null || true

# 2. Copy standalone build
echo "[2/6] ファイル配置..."
mkdir -p $APP_DIR/data
cp -r .next/standalone/* $APP_DIR/
cp -r .next/static $APP_DIR/.next/static
cp -r public $APP_DIR/public 2>/dev/null || true

# 3. Copy config files
echo "[3/6] 設定ファイル配置..."
if [ ! -f $APP_DIR/.env ]; then
    cp deploy/env.production $APP_DIR/.env
    echo "!! .env ファイルを作成しました。必ず値を変更してください !!"
fi

# 4. Set permissions
echo "[4/6] 権限設定..."
chown -R www-data:www-data $APP_DIR

# 5. Setup Nginx (初回のみ)
echo "[5/6] Nginx設定..."
if [ ! -f /etc/nginx/sites-available/ga4kanri.customer8.jp ]; then
    # rate limit zone を nginx.conf に追加
    if ! grep -q "zone=login" /etc/nginx/nginx.conf; then
        sed -i '/http {/a\\tlimit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;\n\tlimit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;' /etc/nginx/nginx.conf
    fi
    cp deploy/nginx.conf /etc/nginx/sites-available/ga4kanri.customer8.jp
    ln -sf /etc/nginx/sites-available/ga4kanri.customer8.jp /etc/nginx/sites-enabled/
fi
nginx -t && systemctl reload nginx

# 6. Setup and start service
echo "[6/6] サービス起動..."
cp deploy/ga4report.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable ga4report
systemctl start ga4report

echo ""
echo "=== デプロイ完了 ==="
echo "ステータス: systemctl status ga4report"
echo "ログ確認:   journalctl -u ga4report -f"
