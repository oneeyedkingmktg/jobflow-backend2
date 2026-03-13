#!/bin/sh
set -e

# Ensure Node/npm are on PATH (Xcode Cloud Apple Silicon Mac)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

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
