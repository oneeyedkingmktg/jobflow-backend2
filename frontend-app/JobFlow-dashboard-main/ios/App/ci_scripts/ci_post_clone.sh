#!/bin/sh
set -e

# Add Homebrew to PATH (Xcode Cloud uses /Users/local/Homebrew)
export PATH="/Users/local/Homebrew/bin:/Users/local/Homebrew/sbin:$PATH"

echo ">>> Installing Node.js via Homebrew..."
brew install node

echo ">>> Node version: $(node -v)"
echo ">>> npm version: $(npm -v)"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR/../../.."
RESOLVED_PATH="$SCRIPT_DIR/../App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved"

echo ">>> Installing Node dependencies..."
cd "$APP_DIR"
npm install

echo ">>> Building web app..."
npm run build

echo ">>> Syncing Capacitor..."
npx cap sync ios

# ── Remove Package.resolved so Xcode Cloud auto-resolves all packages ──────────
# Linphone is referenced via GitHub mirror (accessible from Xcode Cloud).
# Letting Xcode resolve avoids manual maintenance of transitive Firebase deps.
echo ">>> Removing Package.resolved to allow Xcode Cloud auto-resolution..."
rm -f "$RESOLVED_PATH"

echo ">>> Post-clone steps complete."
