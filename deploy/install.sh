#!/bin/bash
# One-shot provisioning on the apps VPS (idempotent). Run as root from /opt/details-whatsapp-ui
# after the code is copied there. Builds the frontend, installs the systemd unit, and swaps the
# tunnel nginx vhost to path-split between the existing backend (3400) and this new frontend (3401).
# Rollback: cp /etc/nginx/sites-available/whatsapp.details-wms.cloud.tunnel.bak over the live file,
# nginx -t && systemctl reload nginx, then systemctl disable --now details-whatsapp-ui.
set -euo pipefail
APP=/opt/details-whatsapp-ui
TUNNEL=/etc/nginx/sites-available/whatsapp.details-wms.cloud.tunnel

id -u whatsapp >/dev/null 2>&1 || { echo "المستخدم whatsapp غير موجود — شغّل تثبيت details-whatsapp أولًا" >&2; exit 1; }

cd "$APP"
npm install --no-audit --no-fund
NITRO_PRESET=node-server npm run build
chown -R root:whatsapp "$APP"; chmod -R g+rX "$APP"

install -m 644 "$APP/deploy/details-whatsapp-ui.service" /etc/systemd/system/details-whatsapp-ui.service

if [ -f "$TUNNEL" ] && [ ! -f "$TUNNEL.bak" ]; then
  cp "$TUNNEL" "$TUNNEL.bak"
  echo "نسخة احتياطية من الإعداد القديم: $TUNNEL.bak"
fi
install -m 644 "$APP/deploy/nginx-apps-tunnel.conf" "$TUNNEL"

systemctl daemon-reload
systemctl enable --now details-whatsapp-ui
systemctl restart details-whatsapp-ui
nginx -t && systemctl reload nginx
echo "install done — تحقق: curl -s http://127.0.0.1:3401/ (يجب أن يعيد 307 إلى / بمعاملات الفلترة الافتراضية)"
