#!/bin/bash

# Setup GitHub Pages hosting for Veil Debug UI
# Can be run from anywhere: repo root, debug-ui/, or scripts/

set -e

echo "🌐 Setting up GitHub Pages"
echo "=========================="
echo ""

# Determine paths based on script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEBUG_UI_DIR="$REPO_ROOT/debug-ui"
DOCS_DIR="$REPO_ROOT/docs"

# Step 1: Build the distribution
echo "📦 Step 1: Building distribution..."
"$SCRIPT_DIR/build-debug-ui.sh"
echo ""

# Step 2: Create/update docs folder for GitHub Pages
echo "📁 Step 2: Preparing GitHub Pages folder..."
mkdir -p "$DOCS_DIR"

# Copy all necessary files to docs/
cp "$DEBUG_UI_DIR/dist/veil-debug.html" "$DOCS_DIR/index.html"  # Rename to index.html for clean URL
cp "$DEBUG_UI_DIR/dist/veil-wasm.bundle.js" "$DOCS_DIR/"
cp "$DEBUG_UI_DIR/dist/veil_wasm.js" "$DOCS_DIR/"
cp "$DEBUG_UI_DIR/dist/veil_wasm_bg.wasm" "$DOCS_DIR/"
cp "$DEBUG_UI_DIR/test-bundle.html" "$DOCS_DIR/" 2>/dev/null || true  # Optional

echo "✅ Files copied to docs/ folder"
echo ""

# Step 3: Create .nojekyll file (tells GitHub Pages not to use Jekyll)
touch "$DOCS_DIR/.nojekyll"
echo "✅ Created .nojekyll file"
echo ""

# Step 4: Create a simple README for GitHub Pages
cat > "$DOCS_DIR/README.md" << 'EOF'
# Veil Transaction Debug Tool

This is a browser-based tool for debugging Veil transactions.

## Access the Tool

[Launch Veil Debug Tool](./index.html)

## Features

- ✅ Auto WIF-to-hex conversion
- ✅ Auto-compute spend public key
- ✅ Fetch real UTXOs from blockchain
- ✅ Build and sign transactions
- ✅ Detailed error diagnostics
- ✅ 100% client-side (keys never leave your browser)

## Privacy & Security

- Your private keys stay in your browser
- Nothing is sent to any server except public RPC calls
- All cryptography runs locally via WebAssembly
- Open source and auditable

## For Developers

Source code: [veil-wasm-wrapper](../)
EOF

echo "✅ Created docs/README.md"
echo ""

# Step 5: Show git status
echo "📋 Step 3: Git status..."
echo ""
cd "$REPO_ROOT"
git status docs/ 2>/dev/null || echo "Git not initialized or docs/ not tracked yet"
echo ""

# Step 6: Instructions
echo "═══════════════════════════════════════════════════════════"
echo "✅ GitHub Pages Setup Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📁 Files ready in: docs/"
echo "   • index.html (renamed from veil-debug.html)"
echo "   • veil-wasm.bundle.js"
echo "   • veil_wasm.js"
echo "   • veil_wasm_bg.wasm"
echo ""
echo "🚀 Next Steps:"
echo ""
echo "1️⃣  Commit the docs folder:"
echo "   git add docs/"
echo "   git commit -m \"Add Veil Debug UI for GitHub Pages\""
echo ""
echo "2️⃣  Push to GitHub:"
echo "   git push origin master"
echo "   (or 'main' if that's your default branch)"
echo ""
echo "3️⃣  Enable GitHub Pages:"
echo "   • Go to: https://github.com/YOUR-USERNAME/YOUR-REPO/settings/pages"
echo "   • Source: Deploy from a branch"
echo "   • Branch: master (or main)"
echo "   • Folder: /docs"
echo "   • Click Save"
echo ""
echo "4️⃣  Access your tool at:"
echo "   https://YOUR-USERNAME.github.io/YOUR-REPO/"
echo ""
echo "⏱️  Note: GitHub Pages may take 1-2 minutes to deploy"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
