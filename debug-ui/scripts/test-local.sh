#!/bin/bash

# Quick local testing script for browser debug UI
# Can be run from anywhere: repo root, debug-ui/, or scripts/

set -e

echo "🧪 Testing Veil Browser Debug UI Locally"
echo "========================================"
echo ""

# Determine paths based on script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEBUG_UI_DIR="$REPO_ROOT/debug-ui"

# Step 1: Build if needed
if [ ! -d "$DEBUG_UI_DIR/dist" ] || [ ! -f "$DEBUG_UI_DIR/dist/veil-wasm.bundle.js" ]; then
    echo "📦 Building bundle (first time)..."
    "$SCRIPT_DIR/build-debug-ui.sh"
    echo ""
fi

# Copy test page to dist
echo "📋 Copying test page..."
cp "$DEBUG_UI_DIR/test-bundle.html" "$DEBUG_UI_DIR/dist/"
echo ""

# Step 2: Check for Python
if command -v python3 &> /dev/null; then
    echo "✅ Python3 found"
    echo ""
    echo "🌐 Starting local server on http://localhost:8000"
    echo ""
    echo "📝 Test pages available:"
    echo "   http://localhost:8000/test-bundle.html (Quick tests)"
    echo "   http://localhost:8000/veil-debug.html (Full UI)"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""

    cd "$DEBUG_UI_DIR/dist"
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    echo "✅ Python found"
    echo ""
    echo "🌐 Starting local server on http://localhost:8000"
    echo ""
    echo "📝 Test pages available:"
    echo "   http://localhost:8000/test-bundle.html (Quick tests)"
    echo "   http://localhost:8000/veil-debug.html (Full UI)"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""

    cd "$DEBUG_UI_DIR/dist"
    python -m SimpleHTTPServer 8000
else
    echo "❌ Python not found"
    echo ""
    echo "Options to start a local server:"
    echo ""
    echo "1. Install Python and run:"
    echo "   python3 -m http.server 8000"
    echo ""
    echo "2. Use npx (if you have Node.js):"
    echo "   cd dist && npx http-server -p 8000"
    echo ""
    echo "3. Use Node http-server:"
    echo "   npm install -g http-server"
    echo "   cd dist && http-server -p 8000"
    echo ""
fi
