#!/bin/bash

# Build script for browser-based debug UI
# This bundles the veil-wasm-wrapper library for browser use
# Can be run from anywhere: repo root, debug-ui/, or scripts/

set -e

echo "🔨 Building Veil Debug UI for Browser..."
echo ""

# Determine paths based on script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEBUG_UI_DIR="$REPO_ROOT/debug-ui"

# Step 1: Install esbuild if not present
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js"
    exit 1
fi

echo "📦 Installing build dependencies..."
cd "$REPO_ROOT"
npm install --save-dev esbuild

# Step 2: Bundle with esbuild (browser entry point already exists)
echo "🔧 Bundling with esbuild..."
npx esbuild "$DEBUG_UI_DIR/src/browser.ts" \
  --bundle \
  --format=iife \
  --global-name=VeilWasm \
  --outfile="$DEBUG_UI_DIR/dist/veil-wasm.bundle.js" \
  --platform=browser \
  --target=es2020 \
  --sourcemap \
  --external:crypto

echo "✅ Bundle created: dist/veil-wasm.bundle.js"
echo ""

# Step 3: Copy WASM files to dist
echo "📋 Copying WASM files..."
mkdir -p "$DEBUG_UI_DIR/dist"
if [ -f "$REPO_ROOT/node_modules/@blondfrogs/secp256k1-wasm/veil_wasm_bg.wasm" ]; then
    cp "$REPO_ROOT/node_modules/@blondfrogs/secp256k1-wasm/veil_wasm_bg.wasm" "$DEBUG_UI_DIR/dist/"
    cp "$REPO_ROOT/node_modules/@blondfrogs/secp256k1-wasm/veil_wasm.js" "$DEBUG_UI_DIR/dist/"
    echo "✅ WASM files copied:"
    echo "   - veil_wasm_bg.wasm (binary)"
    echo "   - veil_wasm.js (glue code)"
else
    echo "⚠️  WASM files not found. Run 'npm install' first."
fi

# Step 4: Create standalone HTML
echo "🌐 Creating standalone debug UI..."
cat > "$DEBUG_UI_DIR/dist/veil-debug.html" << 'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Veil Transaction Debug Tool</title>
    <style>
HTMLEOF

# Extract styles from debug-ui.html
sed -n '/<style>/,/<\/style>/p' "$DEBUG_UI_DIR/debug-ui.html" >> "$DEBUG_UI_DIR/dist/veil-debug.html"

cat >> "$DEBUG_UI_DIR/dist/veil-debug.html" << 'HTMLEOF'
    </style>
</head>
<body>
HTMLEOF

# Extract body content from debug-ui.html
# This includes all scripts and closing tags
sed -n '/<body>/,/<\/body>/p' "$DEBUG_UI_DIR/debug-ui.html" | sed '1d' >> "$DEBUG_UI_DIR/dist/veil-debug.html"

cat >> "$DEBUG_UI_DIR/dist/veil-debug.html" << 'HTMLEOF'
</html>
HTMLEOF

echo "✅ Standalone HTML created: dist/veil-debug.html"
echo ""

# Step 6: Create README
cat > "$DEBUG_UI_DIR/dist/README.txt" << 'EOF'
Veil Transaction Debug Tool - Browser Version
=============================================

USAGE:
1. Open veil-debug.html in any web browser
2. Your keys never leave your computer
3. All operations run locally in your browser

FILES:
- veil-debug.html: The debug tool UI
- veil-wasm.bundle.js: Bundled Veil library
- veil_wasm.js: WASM glue code
- veil_wasm_bg.wasm: WebAssembly crypto module

SECURITY:
- Run this on an OFFLINE computer for maximum security
- No data is sent to any server
- All cryptographic operations happen locally
- You can inspect the source code to verify

SHARING:
To share this tool with users:
1. Zip the entire dist/ folder
2. Send to user
3. User extracts and opens veil-debug.html

OFFLINE USE:
This tool works completely offline. You can:
1. Disconnect from the internet
2. Open veil-debug.html
3. Enter your keys and debug transactions
4. Reconnect only when you want to broadcast

For support, visit: https://github.com/veil-project
EOF

echo "📄 Created README: dist/README.txt"
echo ""

echo "✅ Build complete!"
echo ""
echo "📦 Distribution files in: dist/"
echo "   - veil-debug.html (main UI file)"
echo "   - veil-wasm.bundle.js (bundled library)"
echo "   - veil_wasm.js (WASM glue code)"
echo "   - veil_wasm_bg.wasm (WASM binary)"
echo "   - test-bundle.html (testing page)"
echo "   - README.txt (instructions)"
echo ""
echo "🚀 To test locally:"
echo "   ./test-local.sh"
echo "   Then open: http://localhost:8000/veil-debug.html"
echo ""
echo "📤 To share with users:"
echo "   cd dist && zip -r veil-debug-tool.zip ."
echo ""
echo "🌐 To host on a website:"
echo "   1. Upload ALL files from dist/ to your web server"
echo "   2. Make sure all files are in the SAME directory"
echo "   3. Access via: https://yoursite.com/veil-debug.html"
echo "   4. Required files for hosting:"
echo "      • veil-debug.html"
echo "      • veil-wasm.bundle.js"
echo "      • veil_wasm.js"
echo "      • veil_wasm_bg.wasm"
echo ""
