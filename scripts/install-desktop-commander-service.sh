#!/usr/bin/env bash
set -euo pipefail

USER_NAME="${SUDO_USER:-$USER}"
if [ "$USER_NAME" = "root" ]; then USER_NAME="ubuntu"; fi
HOME_DIR="$(getent passwd "$USER_NAME" | cut -d: -f6)"
NPX_BIN="$(sudo -u "$USER_NAME" bash -lc 'command -v npx')"

if [ -z "$NPX_BIN" ]; then
  echo "ERRO: npx não encontrado para $USER_NAME"
  exit 1
fi

# Evita duas instâncias disputando o mesmo refresh token.
pkill -u "$USER_NAME" -f '@wonderwhy-er/desktop-commander.*remote' 2>/dev/null || true
sleep 2

sudo tee /etc/systemd/system/desktop-commander.service >/dev/null <<EOF
[Unit]
Description=Desktop Commander Remote MCP
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$HOME_DIR
Environment=HOME=$HOME_DIR
Environment=PATH=$(dirname "$NPX_BIN"):/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=$NPX_BIN @wonderwhy-er/desktop-commander@latest remote
Restart=always
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now desktop-commander.service
sleep 3

sudo systemctl --no-pager --full status desktop-commander.service || true

echo
echo "Desktop Commander configurado para iniciar automaticamente com o servidor."
echo "Se aparecer um novo código de autorização, autorize uma única vez e não inicie outra instância manualmente."
