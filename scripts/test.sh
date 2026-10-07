#!/bin/bash
# Runs every check: the mod's manifests and tests, the receiver's tests, the React Native
# package's tests and types, and the example app's types.
set -euo pipefail
cd "$(dirname "$0")/.."

claude plugin validate .
claude plugin validate mod
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test mod
node --test --test-concurrency=1 mod/tests/*.node.test.mjs

npm test -w packages/react-native-press-to-fix
npx tsc --noEmit -p packages/react-native-press-to-fix
npx tsc --noEmit -p example
