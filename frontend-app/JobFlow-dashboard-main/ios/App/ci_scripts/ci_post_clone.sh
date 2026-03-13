#!/bin/sh
set -e

# Diagnostics
echo ">>> Current PATH: $PATH"
echo ">>> which node: $(which node 2>/dev/null || echo NOT FOUND)"
echo ">>> which npm: $(which npm 2>/dev/null || echo NOT FOUND)"
echo ">>> ls /opt/homebrew/bin/node: $(ls /opt/homebrew/bin/node 2>/dev/null || echo NOT FOUND)"
echo ">>> ls /usr/local/bin/node: $(ls /usr/local/bin/node 2>/dev/null || echo NOT FOUND)"
find /usr/local /opt/homebrew -name "npm" 2>/dev/null | head -5 || echo "npm not found in common dirs"

# Navigate relative to this script's location
# Script is at ios/App/ci_scripts/ so ../../.. = JobFlow-dashboard-main/
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR/../../.."

echo ">>> Installing Node dependencies..."
cd "$APP_DIR"
npm install

echo ">>> Building web app..."
npm run build

echo ">>> Syncing Capacitor..."
npx cap sync ios

echo ">>> Post-clone steps complete."
