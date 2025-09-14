#!/bin/bash

echo "í´§ Killing stray Node processes..."
pkill -f node || echo "No stray node processes found."

echo "í·¹ Cleaning up old dependencies and lock files..."
rm -rf node_modules
rm -f package-lock.json yarn.lock pnpm-lock.yaml
npm cache clean --force

echo "í³¦ Installing base dependencies..."
npm install

echo "í´§ Syncing Expo-compatible versions..."
npx expo install --fix

echo "ï¿½ï¿½ Running Expo doctor..."
npx expo-doctor

echo "ï¿½ï¿½ Installing required Expo modules..."
npx expo install expo-notifications expo-haptics expo-image-picker

echo "í·© Checking for missing 'simple-swizzle' dependency..."
if ! npm ls simple-swizzle >/dev/null 2>&1; then
  echo "í³¦ Installing simple-swizzle@^0.2.2..."
  npm install simple-swizzle@^0.2.2
else
  echo "âœ… simple-swizzle already installed."
fi

echo "íº€ Starting Expo with clean Metro cache..."
npx expo start -c


