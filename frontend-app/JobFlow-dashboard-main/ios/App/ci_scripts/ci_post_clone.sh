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

# ── Update Linphone pin revision from GitHub mirror ────────────────────────────
echo ">>> Fetching Linphone stable HEAD from GitHub mirror..."
LINPHONE_REVISION=$(git ls-remote https://github.com/oneeyedkingmktg/linphone-sdk-swift-ios-mirror.git refs/heads/stable 2>/dev/null | awk '{print $1}')
if [ -z "$LINPHONE_REVISION" ]; then
  echo ">>> WARNING: Could not fetch Linphone revision — using pinned revision from Package.resolved"
else
  echo ">>> Linphone stable HEAD: $LINPHONE_REVISION"
  python3 - "$RESOLVED_PATH" "$LINPHONE_REVISION" <<'PYEOF'
import json, sys
path, revision = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = json.load(f)
for pin in data["pins"]:
    if pin.get("identity") == "linphone-sdk-swift-ios-mirror":
        pin["state"]["revision"] = revision
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
print(">>> Linphone revision updated in Package.resolved")
PYEOF
fi

echo ">>> Post-clone steps complete."
