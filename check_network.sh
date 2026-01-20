#!/bin/bash

# Load environment variables from .env if present
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Use VEIL_NODE_URL from environment or default to public API
VEIL_NODE_URL="${VEIL_NODE_URL:-https://api.veil.zelcore.io}"

echo ""
echo "==============================================================="
echo "Checking Network Configuration"
echo "==============================================================="
echo ""

echo "1. Configured API Network:"
echo "   URL: $VEIL_NODE_URL"
echo ""
curl -s -X POST "$VEIL_NODE_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getblockchaininfo","params":[]}' | \
  jq '.result | {chain, blocks}'

echo ""
echo "2. Local Veil Node Network (if running):"
echo ""

# Try to find veil-cli in common locations
if command -v veil-cli &> /dev/null; then
  veil-cli getblockchaininfo | jq '{chain, blocks}'
elif [ -f "$HOME/.local/bin/veil-cli" ]; then
  "$HOME/.local/bin/veil-cli" getblockchaininfo | jq '{chain, blocks}'
elif [ -f "/usr/local/bin/veil-cli" ]; then
  /usr/local/bin/veil-cli getblockchaininfo | jq '{chain, blocks}'
else
  echo "   veil-cli not found in PATH or common locations"
  echo "   Set VEIL_CLI environment variable to specify location"
  echo "   Example: export VEIL_CLI=/path/to/veil-cli"
fi

echo ""
echo "==============================================================="
echo ""

echo "If 'chain' values don't match, that's the problem!"
echo ""
echo "Expected: both should be 'main' for mainnet"
echo "If local node shows 'test' or 'regtest', you're on the wrong network!"
echo ""
