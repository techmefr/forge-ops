#!/bin/sh
set -eu

cat > /usr/share/nginx/html/config.js <<EOF
window.forgeAddresses = {
  instanceUrl: '${FORGE_INSTANCE_URL:-}',
  serverUrl: '${FORGE_SERVER_URL:-}'
}
EOF

if [ -n "${FORGE_API_PROXY_TARGET:-}" ]; then
  cat > /etc/nginx/forge-api-proxy.conf <<EOF
location /api/ {
    proxy_pass ${FORGE_API_PROXY_TARGET}/api/;
    proxy_set_header Host \$host;
    proxy_set_header Origin \$http_origin;
    proxy_set_header X-Forwarded-For \$remote_addr;
    proxy_set_header X-Forwarded-Proto \$scheme;
}
EOF
else
  : > /etc/nginx/forge-api-proxy.conf
fi
