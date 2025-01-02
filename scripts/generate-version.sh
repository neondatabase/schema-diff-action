#!/usr/bin/bash

version=$(node -p "require('./package.json').version")
echo "export const version = '$version'" > src/version.ts
echo "\n// This file is auto-generated. Use 'npm run prebuild' when you need to update the version!" >> src/version.ts