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
PACKAGE_DIR="$SCRIPT_DIR/../CapApp-SPM"
RESOLVED_DEST="$SCRIPT_DIR/../App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"
RESOLVED_PATH="$RESOLVED_DEST/Package.resolved"

echo ">>> Installing Node dependencies..."
cd "$APP_DIR"
npm install

echo ">>> Building web app..."
npm run build

echo ">>> Syncing Capacitor..."
npx cap sync ios

# ── Resolve all Swift package dependencies via SPM ─────────────────────────────
# swift package resolve records dependency graph + checksums without downloading
# binary XCFrameworks (those download during the build phase). This generates a
# complete Package.resolved including all Firebase transitive deps.
echo ">>> Running swift package resolve in CapApp-SPM..."
cd "$PACKAGE_DIR"
rm -f Package.resolved
swift package resolve
echo ">>> swift package resolve succeeded"

mkdir -p "$RESOLVED_DEST"
cp Package.resolved "$RESOLVED_PATH"
echo ">>> Package.resolved copied to xcworkspace location"

# ── Inject Linphone pin from GitHub mirror ─────────────────────────────────────
# Linphone is a direct Xcode project dependency (not in CapApp-SPM/Package.swift)
# so swift package resolve above won't include it — inject it manually.
echo ">>> Fetching Linphone stable HEAD from GitHub mirror..."
LINPHONE_REVISION=$(git ls-remote https://github.com/oneeyedkingmktg/linphone-sdk-swift-ios-mirror.git refs/heads/stable 2>/dev/null | awk '{print $1}')
if [ -z "$LINPHONE_REVISION" ]; then
  echo ">>> WARNING: Could not fetch Linphone revision — skipping Linphone pin"
else
  echo ">>> Linphone stable HEAD: $LINPHONE_REVISION"
  python3 - "$RESOLVED_PATH" "$LINPHONE_REVISION" <<'PYEOF'
import json, sys
path, revision = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = json.load(f)
data["pins"] = [p for p in data["pins"] if p.get("identity") != "linphone-sdk-swift-ios-mirror"]
data["pins"].append({
    "identity": "linphone-sdk-swift-ios-mirror",
    "kind": "remoteSourceControl",
    "location": "https://github.com/oneeyedkingmktg/linphone-sdk-swift-ios-mirror.git",
    "state": {"branch": "stable", "revision": revision}
})
data["pins"].sort(key=lambda p: p["identity"])
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
print(">>> Linphone pin injected successfully")
PYEOF
fi

echo ">>> Post-clone steps complete."
