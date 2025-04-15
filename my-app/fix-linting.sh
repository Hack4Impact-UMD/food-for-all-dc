#!/bin/bash

# This script automates fixing of ESLint and Prettier issues in the codebase

echo "Fixing ESLint issues..."
npx eslint --fix src/**/*.{js,jsx,ts,tsx}

echo "Formatting code with Prettier..."
npx prettier --write "src/**/*.{js,jsx,ts,tsx,json,css,scss}"

echo "All done! Please review the changes." 