#!/bin/sh
set -eu

cat > /usr/share/nginx/html/config.js <<EOF
window.forgeAddresses = {
  instanceUrl: '${FORGE_INSTANCE_URL:-}',
  serverUrl: '${FORGE_SERVER_URL:-}'
}
EOF
