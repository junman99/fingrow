$ErrorActionPreference = "Stop"

# Clean caches & modules
if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules }
if (Test-Path package-lock.json) { Remove-Item -Force package-lock.json }
if (Test-Path yarn.lock) { Remove-Item -Force yarn.lock }
if (Test-Path pnpm-lock.yaml) { Remove-Item -Force pnpm-lock.yaml }
npm cache clean --force

# Reinstall
npm install

# Expo sanity + required modules
npx expo install --fix
npx expo-doctor
npx expo install expo-notifications
npx expo install expo-haptics
npx expo install expo-image-picker

# Start clean
npx expo start -c
