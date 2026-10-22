#!/usr/bin/env bash
# Deploy the latest git state of ffxiv-companion (kitocloud.net).
# Usage: ~/deploy-site.sh        (skips if nothing new)
#        ~/deploy-site.sh -f     (rebuild even if already up to date)
set -euo pipefail

REPO=/srv/ffxiv-companion/fflogs-log-comparison
APP="$REPO/fflogs-compare"
SERVICE=ffxiv-companion
DB_DIR=/var/lib/ffxiv-companion
BACKUP_DIR="$HOME/ffxiv-backups"
KEEP=5

FORCE=0
[[ "${1:-}" == "-f" ]] && FORCE=1

cd "$REPO"
OLD=$(git rev-parse HEAD)
echo "==> Pulling"
git pull --ff-only
NEW=$(git rev-parse HEAD)

if [[ "$OLD" == "$NEW" && $FORCE -eq 0 ]]; then
  echo "Already up to date. Use -f to rebuild anyway."
  exit 0
fi

# Warn if the start script changed (Nix ExecStart would need updating)
if git diff "$OLD" "$NEW" -- fflogs-compare/package.json | grep -q '^[+-].*"start"'; then
  echo "!! The \"start\" script in package.json changed."
  echo "!! Update ExecStart in ~/nixos-homelab/modules/services/ffxiv-companion.nix and rebuild NixOS."
  read -rp "Continue anyway? [y/N] " ans
  [[ "$ans" == [yY] ]] || exit 1
fi

# From here on, make sure the service is started again even if something fails
trap 'echo "!! Deploy failed, starting service again"; sudo systemctl start "$SERVICE"' ERR

echo "==> Stopping $SERVICE"
sudo systemctl stop "$SERVICE"

echo "==> Backing up database"
STAMP=$(date +%F_%H%M%S)
mkdir -p "$BACKUP_DIR/$STAMP"
cp -a "$DB_DIR"/app.db* "$BACKUP_DIR/$STAMP/"
# keep only the newest $KEEP backups
ls -1dt "$BACKUP_DIR"/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf

echo "==> Building"
cd "$APP"
npm ci
npm run codegen
npm run build

echo "==> Starting $SERVICE"
sudo systemctl start "$SERVICE"
trap - ERR

sleep 3
if systemctl is-active --quiet "$SERVICE"; then
  echo "==> Deployed ${OLD:0:7} -> ${NEW:0:7}"
else
  echo "!! Service is not running. Backup is in $BACKUP_DIR/$STAMP"
fi
journalctl -u "$SERVICE" -n 20 --no-pager
