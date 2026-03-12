#!/bin/sh
set -e

echo ">>> Installing Node dependencies..."
cd "$CI_WORKSPACE/frontend-app/JobFlow-dashboard-main"
npm install

echo ">>> Building web app..."
npm run build

echo ">>> Syncing Capacitor..."
npx cap sync ios

echo ">>> Resolving SPM package dependencies..."
xcodebuild -resolvePackageDependencies \
  -project "$CI_WORKSPACE/frontend-app/JobFlow-dashboard-main/ios/App/App.xcodeproj" \
  -scheme App \
  -clonedSourcePackagesDirPath "$CI_WORKSPACE/frontend-app/JobFlow-dashboard-main/ios/App/SourcePackages"

echo ">>> Pre-build steps complete."
