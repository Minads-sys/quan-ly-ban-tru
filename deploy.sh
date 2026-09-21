#!/bin/bash
set -e

APP_NAME="ban-tru"
APP_DIR="/var/www/$APP_NAME"
REPO_URL="https://github.com/Minads-sys/quan-ly-ban-tru.git"

echo "=========================================="
echo "  Deploy $APP_NAME"
echo "=========================================="

# 1. Pull code mới nhất
if [ ! -d "$APP_DIR/.git" ]; then
    echo "[1/7] Cloning repository..."
    git clone "$REPO_URL" "$APP_DIR"
else
    echo "[1/7] Pulling latest code..."
    cd "$APP_DIR"
    git pull origin main
fi

cd "$APP_DIR"

# 2. Kiểm tra .env.production
if [ ! -f ".env.production" ]; then
    echo "❌ ERROR: File .env.production không tồn tại!"
    echo "   Hãy tạo từ mẫu: cp .env.production.example .env.production"
    echo "   Sau đó điền giá trị Supabase thực."
    exit 1
fi

# 3. Cài dependencies
echo "[2/7] Installing dependencies..."
npm ci --production=false

# 4. Build Next.js standalone
echo "[3/7] Building Next.js (standalone)..."
npm run build

# 5. Copy static & public vào standalone
echo "[4/7] Copying static assets..."
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

# 6. Copy .env.production vào standalone
echo "[5/7] Copying env file..."
cp .env.production .next/standalone/.env.production

# 7. Khởi động/restart PM2
echo "[6/7] Starting/Restarting PM2..."
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
    pm2 restart "$APP_NAME"
else
    pm2 start ecosystem.config.js
fi
pm2 save

# 8. Thiết lập cron chống ngủ đông Supabase (chỉ lần đầu)
echo "[7/7] Checking Supabase keep-alive cron..."
if ! crontab -l 2>/dev/null | grep -q "ban-tru.*supabase"; then
    SUPA_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.production | cut -d= -f2-)
    SUPA_KEY=$(grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" .env.production | cut -d= -f2-)
    CRON_JOB="0 8 */3 * * curl -sf \"${SUPA_URL}/rest/v1/\" -H \"apikey: ${SUPA_KEY}\" > /dev/null 2>&1 # ban-tru supabase keep-alive"
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "   ✅ Đã thêm cron chống ngủ đông Supabase (mỗi 3 ngày lúc 8h sáng)"
else
    echo "   ℹ️  Cron đã tồn tại, bỏ qua."
fi

echo ""
echo "=========================================="
echo "  ✅ Deploy $APP_NAME hoàn tất!"
echo "  → Internal: http://127.0.0.1:3003"
echo "  → Domain:   https://bantrutd.mindigi.vn"
echo "=========================================="
