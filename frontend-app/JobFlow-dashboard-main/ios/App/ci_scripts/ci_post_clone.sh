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

echo ">>> Injecting Linphone pin into Package.resolved..."
RESOLVED_PATH="$SCRIPT_DIR/../App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved"

LINPHONE_REVISION=$(git ls-remote https://gitlab.linphone.org/BC/public/linphone-sdk-swift-ios.git refs/heads/stable 2>/dev/null | awk '{print $1}')
if [ -z "$LINPHONE_REVISION" ]; then
  echo ">>> ERROR: Could not fetch Linphone stable branch HEAD — aborting."
  exit 1
fi
echo ">>> Linphone stable HEAD: $LINPHONE_REVISION"

python3 - "$RESOLVED_PATH" "$LINPHONE_REVISION" <<'PYEOF'
import json, sys
path, revision = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = json.load(f)
pin = {
    "identity": "linphone-sdk-swift-ios",
    "kind": "remoteSourceControl",
    "location": "https://gitlab.linphone.org/BC/public/linphone-sdk-swift-ios.git",
    "state": {"branch": "stable", "revision": revision}
}
data["pins"] = [p for p in data["pins"] if p.get("identity") != "linphone-sdk-swift-ios"]
data["pins"].append(pin)
data["pins"].sort(key=lambda p: p["identity"])
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
print(">>> Linphone pin injected successfully")
PYEOF

echo ">>> Post-clone steps complete."
