#!/bin/bash
# Publish script for veil-tx-builder

set -e  # Exit on error

# Get package metadata from package.json
PACKAGE_NAME=$(node -p "require('./package.json').name")
VERSION=$(node -p "require('./package.json').version")

echo "📦 Publishing $PACKAGE_NAME to npm"
echo ""

echo "Package: $PACKAGE_NAME"
echo "Version: $VERSION"
echo ""

# Check if we're logged in to npm
if ! npm whoami &> /dev/null; then
    echo "❌ Not logged in to npm"
    echo "Run: npm login"
    exit 1
fi

NPM_USER=$(npm whoami)
echo "Logged in as: $NPM_USER"
echo ""

# Build the package
echo "🔨 Building package..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful"
echo ""

# Show what will be published
echo "📋 Files that will be published:"
npm pack --dry-run 2>&1 | grep -E "^\s+[0-9]" | head -20
echo ""

# Confirm before publishing
read -p "Do you want to publish $PACKAGE_NAME@$VERSION to npm? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Publish cancelled"
    exit 0
fi

# Publish to npm
echo ""
echo "🚀 Publishing to npm..."
npm publish --access public

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully published $PACKAGE_NAME@$VERSION"
    echo ""
    echo "📦 View on npm:"
    echo "   https://www.npmjs.com/package/$PACKAGE_NAME"
    echo ""
    echo "📥 Install with:"
    echo "   npm install $PACKAGE_NAME"
    echo ""
else
    echo ""
    echo "❌ Publish failed"
    exit 1
fi
