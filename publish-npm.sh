#!/bin/bash
# Publish script for veil-tx-builder

set -e  # Exit on error

# Check for version bump argument
if [ -z "$1" ]; then
    echo "❌ Usage: ./publish-npm.sh <patch|minor|major>"
    echo ""
    echo "Version bump types:"
    echo "  patch - Bug fixes (1.0.0 → 1.0.1)"
    echo "  minor - New features (1.0.0 → 1.1.0)"
    echo "  major - Breaking changes (1.0.0 → 2.0.0)"
    exit 1
fi

BUMP_TYPE=$1

# Validate bump type
if [[ ! "$BUMP_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo "❌ Invalid version bump type: $BUMP_TYPE"
    echo "Must be one of: patch, minor, major"
    exit 1
fi

# Get current package metadata
PACKAGE_NAME=$(node -p "require('./package.json').name")
CURRENT_VERSION=$(node -p "require('./package.json').version")

echo "📦 Publishing $PACKAGE_NAME to npm"
echo ""
echo "Current version: $CURRENT_VERSION"
echo "Bump type: $BUMP_TYPE"
echo ""

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "❌ You have uncommitted changes. Please commit them first."
    echo ""
    echo "Run: git status"
    exit 1
fi

# Check if we're logged in to npm
if ! npm whoami &> /dev/null; then
    echo "❌ Not logged in to npm"
    echo "Run: npm login"
    exit 1
fi

NPM_USER=$(npm whoami)
echo "Logged in as: $NPM_USER"
echo ""

# Bump version (creates commit + tag automatically)
echo "📈 Bumping version..."
npm version $BUMP_TYPE

NEW_VERSION=$(node -p "require('./package.json').version")
echo "✅ Version bumped: $CURRENT_VERSION → $NEW_VERSION"
echo ""

# Push to git with tags
echo "📤 Pushing to git..."
git push origin master --tags

if [ $? -ne 0 ]; then
    echo "❌ Git push failed"
    exit 1
fi

echo "✅ Pushed to git"
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
read -p "Do you want to publish $PACKAGE_NAME@$NEW_VERSION to npm? (yes/no): " confirm

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
    echo "✅ Successfully published $PACKAGE_NAME@$NEW_VERSION"
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
