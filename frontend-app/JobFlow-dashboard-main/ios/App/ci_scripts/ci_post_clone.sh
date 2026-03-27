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

RESOLVED_PATH="$SCRIPT_DIR/../App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved"

# ── Linphone ──────────────────────────────────────────────────────────────────
echo ">>> Fetching Linphone stable HEAD..."
LINPHONE_REVISION=$(git ls-remote https://gitlab.linphone.org/BC/public/linphone-sdk-swift-ios.git refs/heads/stable 2>/dev/null | awk '{print $1}')
if [ -z "$LINPHONE_REVISION" ]; then
  echo ">>> ERROR: Could not fetch Linphone stable HEAD — aborting."
  exit 1
fi
echo ">>> Linphone stable HEAD: $LINPHONE_REVISION"

# ── Firebase ──────────────────────────────────────────────────────────────────
echo ">>> Fetching latest firebase-ios-sdk 12.x tag..."
FIREBASE_VERSION=$(git ls-remote --tags https://github.com/firebase/firebase-ios-sdk.git \
  | awk '{print $2}' \
  | grep -E '^refs/tags/12\.[0-9]+\.[0-9]+$' \
  | sed 's|refs/tags/||' \
  | sort -t. -k1,1n -k2,2n -k3,3n \
  | tail -1)
FIREBASE_REVISION=$(git ls-remote --tags https://github.com/firebase/firebase-ios-sdk.git \
  | grep "refs/tags/${FIREBASE_VERSION}$" \
  | awk '{print $1}')
if [ -z "$FIREBASE_VERSION" ] || [ -z "$FIREBASE_REVISION" ]; then
  echo ">>> ERROR: Could not resolve firebase-ios-sdk version — aborting."
  exit 1
fi
echo ">>> firebase-ios-sdk: $FIREBASE_VERSION ($FIREBASE_REVISION)"

# ── Inject both pins ──────────────────────────────────────────────────────────
echo ">>> Injecting pins into Package.resolved..."
python3 - "$RESOLVED_PATH" "$LINPHONE_REVISION" "$FIREBASE_VERSION" "$FIREBASE_REVISION" <<'PYEOF'
import json, sys
path, linphone_rev, firebase_ver, firebase_rev = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
with open(path) as f:
    data = json.load(f)

new_pins = [
    {
        "identity": "linphone-sdk-swift-ios",
        "kind": "remoteSourceControl",
        "location": "https://gitlab.linphone.org/BC/public/linphone-sdk-swift-ios.git",
        "state": {"branch": "stable", "revision": linphone_rev}
    },
    {
        "identity": "firebase-ios-sdk",
        "kind": "remoteSourceControl",
        "location": "https://github.com/firebase/firebase-ios-sdk.git",
        "state": {"revision": firebase_rev, "version": firebase_ver}
    }
]

# Remove stale entries for these two then append fresh pins
remove_ids = {"linphone-sdk-swift-ios", "firebase-ios-sdk"}
data["pins"] = [p for p in data["pins"] if p.get("identity") not in remove_ids]
data["pins"].extend(new_pins)
data["pins"].sort(key=lambda p: p["identity"])

with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
print(">>> Pins injected: linphone-sdk-swift-ios, firebase-ios-sdk")
PYEOF

echo ">>> Post-clone steps complete."
