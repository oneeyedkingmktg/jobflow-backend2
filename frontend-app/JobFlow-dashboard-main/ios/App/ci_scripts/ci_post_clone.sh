#!/bin/sh
set -e

echo ">>> Installing Node dependencies..."
cd "$CI_WORKSPACE/frontend-app/JobFlow-dashboard-main"
npm install

echo ">>> Building web app..."
npm run build

echo ">>> Syncing Capacitor..."
npx cap sync ios

echo ">>> Resolving SPM packages via swift package resolve..."
PACKAGE_DIR="$CI_WORKSPACE/frontend-app/JobFlow-dashboard-main/ios/App/CapApp-SPM"
RESOLVED_DEST="$CI_WORKSPACE/frontend-app/JobFlow-dashboard-main/ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"

cd "$PACKAGE_DIR"
swift package resolve

mkdir -p "$RESOLVED_DEST"
cp "$PACKAGE_DIR/Package.resolved" "$RESOLVED_DEST/Package.resolved"

echo ">>> Package.resolved copied to workspace location."
echo ">>> Post-clone steps complete."
