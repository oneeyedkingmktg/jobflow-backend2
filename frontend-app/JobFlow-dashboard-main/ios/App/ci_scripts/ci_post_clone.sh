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

echo ">>> Regenerating Package.resolved after cap sync..."
PACKAGE_DIR="$SCRIPT_DIR/../CapApp-SPM"
RESOLVED_DEST="$SCRIPT_DIR/../App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"

cd "$PACKAGE_DIR"

echo ">>> Clearing stale Package.resolved files..."
rm -f "$PACKAGE_DIR/Package.resolved"
rm -f "$RESOLVED_DEST/Package.resolved"

# Retry swift package resolve up to 3 times — binary target downloads can timeout transiently
for i in 1 2 3; do
  echo ">>> swift package resolve attempt $i..."
  swift package resolve && break
  if [ $i -lt 3 ]; then
    echo ">>> Attempt $i failed, retrying in 20 seconds..."
    sleep 20
  else
    echo ">>> All swift package resolve attempts failed."
    exit 1
  fi
done

mkdir -p "$RESOLVED_DEST"
cp "$PACKAGE_DIR/.build/workspace-state.json" /dev/null 2>/dev/null || true
cp "$PACKAGE_DIR/Package.resolved" "$RESOLVED_DEST/Package.resolved"
echo ">>> Package.resolved updated at $RESOLVED_DEST"

echo ">>> Resolving Xcode project remote packages (linphone etc.)..."
cd "$SCRIPT_DIR/.."
xcodebuild -resolvePackageDependencies \
  -workspace App.xcworkspace \
  -scheme App \
  2>&1 | tail -5 || true
echo ">>> Xcode package resolution complete."

echo ">>> Post-clone steps complete."
