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

echo ">>> Resolving Xcode project package dependencies..."
PROJECT_PATH="$SCRIPT_DIR/../App.xcodeproj"
RESOLVED_DEST="$SCRIPT_DIR/../App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"

echo ">>> Deleting stale Package.resolved files..."
rm -f "$RESOLVED_DEST/Package.resolved"
rm -f "$SCRIPT_DIR/../CapApp-SPM/Package.resolved"

echo ">>> Running xcodebuild -resolvePackageDependencies..."
xcodebuild -resolvePackageDependencies -project "$PROJECT_PATH"
echo ">>> Package dependencies resolved."

echo ">>> Post-clone steps complete."
