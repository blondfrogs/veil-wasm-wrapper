# Hosting the Veil Debug UI

## Quick Start - Hosting on a Website

### Step 1: Build the Distribution

```bash
./build-debug-ui.sh
```

This creates all necessary files in the `dist/` folder.

### Step 2: Upload to Your Web Server

Upload **ALL** these files to the same directory on your web server:

```
✅ REQUIRED FILES:
├── veil-debug.html         (main UI)
├── veil-wasm.bundle.js     (bundled library)
├── veil_wasm.js            (WASM glue code)
└── veil_wasm_bg.wasm       (WASM binary)

📝 OPTIONAL FILES:
├── test-bundle.html        (for testing)
└── README.txt              (user instructions)
```

### Step 3: Access the Tool

```
https://yourwebsite.com/veil-debug.html
```

## Important Requirements

### ✅ All Files in Same Directory

The files MUST be in the same directory because:
- `veil-debug.html` loads `veil-wasm.bundle.js`
- `veil-wasm.bundle.js` imports `veil_wasm.js`
- `veil_wasm.js` fetches `veil_wasm_bg.wasm`

```
❌ WRONG (files in different dirs):
/public/
  veil-debug.html
  /js/
    veil-wasm.bundle.js
  /wasm/
    veil_wasm.js
    veil_wasm_bg.wasm

✅ CORRECT (all in same dir):
/public/
  veil-debug.html
  veil-wasm.bundle.js
  veil_wasm.js
  veil_wasm_bg.wasm
```

### ✅ HTTPS Recommended

Modern browsers require HTTPS for:
- WebAssembly in some contexts
- Crypto APIs (for random number generation)

Use HTTPS for production hosting.

### ✅ Correct MIME Types

Your web server should serve these MIME types:

```
.html  →  text/html
.js    →  application/javascript (or text/javascript)
.wasm  →  application/wasm
```

Most web servers set these correctly by default.

## Hosting Platforms

### GitHub Pages

```bash
# 1. Create a gh-pages branch
git checkout -b gh-pages

# 2. Copy dist files to root
cp dist/* .

# 3. Commit and push
git add veil-debug.html veil-wasm.bundle.js veil_wasm.js veil_wasm_bg.wasm
git commit -m "Add Veil Debug UI"
git push origin gh-pages

# 4. Enable GitHub Pages in repo settings
# Settings → Pages → Source: gh-pages branch

# 5. Access at:
# https://yourusername.github.io/yourrepo/veil-debug.html
```

### Netlify

```bash
# 1. Create a netlify.toml
cat > netlify.toml << 'EOF'
[[headers]]
  for = "/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"

[[headers]]
  for = "/*.wasm"
  [headers.values]
    Content-Type = "application/wasm"
EOF

# 2. Deploy dist folder
npx netlify deploy --dir=dist --prod
```

### Vercel

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy dist folder
cd dist
vercel --prod
```

### AWS S3 + CloudFront

```bash
# 1. Upload to S3
aws s3 sync dist/ s3://your-bucket/veil-debug/ \
  --acl public-read \
  --content-type "application/wasm" \
  --exclude "*" \
  --include "*.wasm"

aws s3 sync dist/ s3://your-bucket/veil-debug/ \
  --acl public-read \
  --exclude "*.wasm"

# 2. Configure CloudFront for HTTPS
# 3. Access at:
# https://your-cloudfront-url/veil-debug.html
```

### Simple HTTP Server (Testing Only)

```bash
# For local testing, not production
cd dist
python3 -m http.server 8000

# Access at: http://localhost:8000/veil-debug.html
```

## Verifying the Hosted Version

### Test Checklist

Visit your hosted URL and check:

1. **Page loads** - No 404 errors
2. **WASM loads** - Check browser console (F12)
   ```
   ✅ Should see: "VeilWasm is available"
   ❌ Should NOT see: "Failed to fetch WASM module"
   ```
3. **WIF conversion works** - Paste a WIF key, should auto-convert
4. **RPC connection works** - Click "Fetch UTXOs", should connect to API
5. **No CORS errors** - Check browser console for errors

### Common Issues

**Issue: "Failed to fetch WASM module"**
```
Cause: WASM files not uploaded or wrong path
Fix: Ensure all 4 files are in same directory
```

**Issue: "CORS policy blocked"**
```
Cause: Cross-origin restrictions
Fix: Ensure all files served from same origin
     Or configure CORS headers on server
```

**Issue: "WASM validation error"**
```
Cause: WASM file corrupted during upload
Fix: Re-upload the .wasm file in binary mode
```

**Issue: "Module not found"**
```
Cause: .js file missing or wrong path
Fix: Upload veil_wasm.js to same directory
```

## Custom Domain

If hosting on a custom domain:

```bash
# 1. Upload files to your domain
https://veil-debug.yourdomain.com/

# 2. Ensure HTTPS is enabled

# 3. Test the deployment
curl -I https://veil-debug.yourdomain.com/veil_wasm_bg.wasm
# Should return: Content-Type: application/wasm

# 4. Test in browser
# Open: https://veil-debug.yourdomain.com/veil-debug.html
```

## Security Considerations

### For Users

- ✅ **Keys stay local** - Never sent to your server
- ✅ **Open source** - Users can audit the code
- ✅ **HTTPS required** - Ensures secure connection

### For Hosting

- ✅ **Static files only** - No server-side processing
- ✅ **No key logging** - You never see user keys
- ✅ **No database needed** - Everything runs client-side

### Recommended Setup

```
✅ Use HTTPS (required)
✅ Add Content Security Policy headers
✅ Enable CORS if needed for RPC calls
✅ Set proper cache headers for static assets
✅ Monitor server logs for errors (not user data)
```

### Example CSP Header

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-eval';
  connect-src 'self' https://api.veil.zelcore.io;
  style-src 'self' 'unsafe-inline';
```

## Updating the Hosted Version

```bash
# 1. Make changes to debug-ui.html or code

# 2. Rebuild
./build-debug-ui.sh

# 3. Re-upload ONLY the changed files
# Usually just veil-debug.html or veil-wasm.bundle.js

# 4. Clear browser cache or force refresh (Ctrl+F5)
```

## Troubleshooting Hosted Deployments

### Enable Detailed Logging

Add to your `debug-ui.html` (temporary, for debugging):

```javascript
// In browser console
localStorage.setItem('debug', 'true');

// Then refresh page and check console for detailed logs
```

### Check File Sizes

```bash
# Expected sizes (approximate):
veil-debug.html:       ~30-40 KB
veil-wasm.bundle.js:   ~500 KB
veil_wasm.js:          ~50 KB
veil_wasm_bg.wasm:     ~150-200 KB
```

If files are much smaller, they may be corrupted.

### Test with curl

```bash
# Test that all files are accessible
curl -I https://yoursite.com/veil-debug.html
curl -I https://yoursite.com/veil-wasm.bundle.js
curl -I https://yoursite.com/veil_wasm.js
curl -I https://yoursite.com/veil_wasm_bg.wasm

# All should return: HTTP/1.1 200 OK
```

## Support

If users report issues with your hosted version:

1. **Check browser console** (F12 → Console tab)
2. **Check network tab** (F12 → Network tab)
3. **Verify all 4 files** are accessible
4. **Test in different browser** (Chrome, Firefox, Safari)
5. **Check HTTPS** is enabled
6. **Review server logs** for 404s or 500s

## Summary

### Minimum Requirements for Hosting

✅ HTTPS enabled
✅ All 4 required files in same directory
✅ Correct MIME types served
✅ No CORS issues for RPC API calls

### Files to Upload

```
veil-debug.html        (30 KB)
veil-wasm.bundle.js    (500 KB)
veil_wasm.js           (50 KB)
veil_wasm_bg.wasm      (200 KB)
```

### What Users See

```
https://yoursite.com/veil-debug.html
→ Loads UI
→ Initializes WASM
→ Connects to Veil RPC API
→ All crypto happens client-side
→ Keys never sent to your server
```

That's it! Your users can now debug Veil transactions without sharing their private keys with you.
