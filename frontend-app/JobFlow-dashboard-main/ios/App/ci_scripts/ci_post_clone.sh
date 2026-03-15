#!/bin/sh
set -e

# Add Homebrew to PATH (Xcode Cloud uses /Users/local/Homebrew)
export PATH="/Users/local/Homebrew/bin:/Users/local/Homebrew/sbin:$PATH"

echo ">>> Installing Node.js via Homebrew..."
brew install node

echo ">>> Node version: $(node -v)"
echo ">>> npm version: $(npm -v)"

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

echo ">>> Adding GoogleService-Info.plist to Xcode project target..."
gem install xcodeproj --no-document 2>/dev/null || true
ruby "$SCRIPT_DIR/add_google_services.rb" "$SCRIPT_DIR/../App.xcodeproj"

echo ">>> Regenerating Package.resolved after cap sync..."
PACKAGE_DIR="$SCRIPT_DIR/../CapApp-SPM"
RESOLVED_DEST="$SCRIPT_DIR/../App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"

cd "$PACKAGE_DIR"
swift package resolve

mkdir -p "$RESOLVED_DEST"
cp "$PACKAGE_DIR/.build/workspace-state.json" /dev/null 2>/dev/null || true
cp "$PACKAGE_DIR/Package.resolved" "$RESOLVED_DEST/Package.resolved"
echo ">>> Package.resolved updated at $RESOLVED_DEST"

echo ">>> Post-clone steps complete."
