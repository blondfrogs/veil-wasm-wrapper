# Veil Browser Debug UI

Browser-based transaction debugging tool for Veil cryptocurrency.

## Features

- Auto WIF-to-hex conversion
- Auto-compute spend public key
- Fetch real UTXOs from blockchain
- Check spent status
- Build and sign transactions
- Broadcast to network
- 100% client-side (keys never leave browser)

## Quick Start

**Note:** All scripts can be run from anywhere (repo root, debug-ui/, or scripts/)

### Test Locally

```bash
# From repo root
debug-ui/scripts/test-local.sh

# Or from debug-ui/
./scripts/test-local.sh

# Or from scripts/
./test-local.sh
```

Then open: `http://localhost:8000/veil-debug.html`

### Build for Distribution

```bash
# Can be run from anywhere
debug-ui/scripts/build-debug-ui.sh
```

Output: `debug-ui/dist/` folder with all files

### Deploy to GitHub Pages

```bash
# Can be run from anywhere
debug-ui/scripts/setup-github-pages.sh
```

Then follow the on-screen instructions to commit and push.

## File Structure

```
debug-ui/
├── src/
│   └── browser.ts          # Browser entry point
├── scripts/
│   ├── build-debug-ui.sh        # Build script
│   ├── setup-github-pages.sh    # GitHub Pages setup
│   └── test-local.sh            # Local test server
├── debug-ui.html            # Main UI template
├── test-bundle.html         # Quick test page
└── docs/                    # Documentation
    ├── HOSTING.md
    ├── BROWSER-UI-FEATURES.md
    └── BROWSER-DEBUG-GUIDE.md
```

## Distribution Files

After building, `dist/` contains:
- `veil-debug.html` - Main UI
- `veil-wasm.bundle.js` - Bundled library
- `veil_wasm.js` - WASM glue code
- `veil_wasm_bg.wasm` - WASM binary

## Documentation

- [HOSTING.md](docs/HOSTING.md) - Deployment guide
- [BROWSER-UI-FEATURES.md](docs/BROWSER-UI-FEATURES.md) - Feature list
- [BROWSER-DEBUG-GUIDE.md](docs/BROWSER-DEBUG-GUIDE.md) - User guide
