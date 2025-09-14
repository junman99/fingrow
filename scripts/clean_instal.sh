#!/bin/bash
set -euo pipefail

ps aux | grep node | grep -v grep | awk '{print $2}' | xargs -r kill -9

# Clean caches & modules
rm -rf node_modules || true
rm -f package-lock.json yarn.lock pnpm-lock.yaml || true
npm cache clean --force

# Reinstall
npm install

# Expo sanity + required modules
npx expo install --fix || true
npx expo-doctor || true
npx expo install expo-notifications || true
npx expo install expo-haptics || true
npx expo install expo-image-picker || true
npx expo install react-native-svg
npm install simple-swizzle@^0.2.2 || true

# Start clean
npx expo start -c

