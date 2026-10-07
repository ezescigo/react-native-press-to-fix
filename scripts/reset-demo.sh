#!/bin/bash
# Puts Pocket's seeded bugs back (git tag demo-start), boots a simulator and opens the app in
# Expo Go. SIMULATOR names the simulator to use (iPhone 17 when not set).
set -euo pipefail
cd "$(dirname "$0")/.."

git checkout demo-start -- example/src example/App.tsx
SIMULATOR=${SIMULATOR:-iPhone 17}
xcrun simctl boot "$SIMULATOR" 2>/dev/null || true
open -a Simulator
cd example && npx expo start --ios --go
