#!/bin/bash

echo "� Killing stray Node processes..."
pkill -f node || echo "No stray node processes found."

echo "� Cleaning up old dependencies and lock files..."
rm -rf node_modules
rm -f package-lock.json yarn.lock pnpm-lock.yaml
npm cache clean --force

echo "� Installing base dependencies..."
npm install

echo "� Syncing Expo-compatible versions..."
npx expo install --fix

echo "�� Running Expo doctor..."
npx expo-doctor

echo "�� Installing required Expo modules..."
npx expo install expo-notifications expo-haptics expo-image-picker

echo "� Checking for missing 'simple-swizzle' dependency..."
if ! npm ls simple-swizzle >/dev/null 2>&1; then
  echo "� Installing simple-swizzle@^0.2.2..."
  npm install simple-swizzle@^0.2.2
else
  echo "✅ simple-swizzle already installed."
fi

echo "� Starting Expo with clean Metro cache..."
npx expo start -c


