import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

function runPwaTests() {
  console.log('--- Starting Phase 7 PWA, Manifest & Service Worker Tests ---');

  // 1. Manifest Validation
  console.log('\n[1. Web App Manifest Validation]');
  const manifestPath = path.resolve('public/manifest.webmanifest');
  assert.ok(fs.existsSync(manifestPath), 'public/manifest.webmanifest must exist');

  const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
  let manifest;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch (err) {
    assert.fail(`manifest.webmanifest is not valid JSON: ${err.message}`);
  }

  assert.strictEqual(manifest.name, 'DevShelf', 'Manifest name must be "DevShelf"');
  assert.strictEqual(manifest.short_name, 'DevShelf', 'Manifest short_name must be "DevShelf"');
  assert.strictEqual(manifest.start_url, '/', 'start_url must be "/"');
  assert.strictEqual(manifest.scope, '/', 'scope must be "/"');
  assert.strictEqual(manifest.display, 'standalone', 'display must be "standalone"');
  assert.strictEqual(manifest.background_color, '#0f1219', 'background_color must match dark charcoal theme');
  assert.strictEqual(manifest.theme_color, '#0f1219', 'theme_color must match dark charcoal theme');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3, 'Must define multiple icons');
  console.log('✓ manifest.webmanifest structure, name, scope, display, and theme colors verified');

  // 2. Icon Files Verification
  console.log('\n[2. Icon Assets Verification]');
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  manifest.icons.forEach((iconDef) => {
    // Strip leading slash to locate in public directory
    const relPath = iconDef.src.startsWith('/') ? iconDef.src.slice(1) : iconDef.src;
    const fullPath = path.resolve('public', relPath);

    assert.ok(fs.existsSync(fullPath), `Icon referenced in manifest does not exist: ${iconDef.src}`);
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 0, `Icon file is empty: ${iconDef.src}`);

    if (iconDef.type === 'image/png') {
      const buf = fs.readFileSync(fullPath);
      assert.strictEqual(
        buf.subarray(0, 8).equals(pngSignature),
        true,
        `Icon ${iconDef.src} must have valid PNG signature`
      );
    }
    console.log(`  ✓ Icon verified: ${iconDef.src} (${stat.size} bytes)`);
  });

  const appleTouchPath = path.resolve('public/apple-touch-icon.png');
  assert.ok(fs.existsSync(appleTouchPath), 'apple-touch-icon.png must exist');
  console.log('✓ Apple touch icon exists and is valid');

  // 3. HTML Links Verification
  console.log('\n[3. index.html PWA Metadata Verification]');
  const htmlContent = fs.readFileSync(path.resolve('index.html'), 'utf8');
  assert.ok(htmlContent.includes('rel="manifest"'), 'index.html must link to manifest');
  assert.ok(htmlContent.includes('/manifest.webmanifest'), 'index.html manifest href must be /manifest.webmanifest');
  assert.ok(htmlContent.includes('name="theme-color"'), 'index.html must include theme-color meta tag');
  assert.ok(htmlContent.includes('rel="apple-touch-icon"'), 'index.html must link to apple-touch-icon');
  console.log('✓ index.html links to manifest, theme-color, and apple-touch-icon');

  // 4. Production Service Worker (dist/sw.js) Verification
  console.log('\n[4. Generated dist/sw.js Verification]');
  const distSwPath = path.resolve('dist/sw.js');
  assert.ok(fs.existsSync(distSwPath), 'dist/sw.js must be generated after npm run build');

  const swContent = fs.readFileSync(distSwPath, 'utf8');
  assert.ok(swContent.includes('CACHE_NAME = "devshelf-shell-'), 'Service worker must define versioned CACHE_NAME');
  assert.ok(swContent.includes('PRECACHE_ASSETS = ['), 'Service worker must define PRECACHE_ASSETS array');
  assert.ok(swContent.includes('"/index.html"'), 'Precache must include /index.html');
  assert.ok(swContent.includes('"/manifest.webmanifest"'), 'Precache must include manifest');
  assert.ok(swContent.includes('"/assets/index-'), 'Precache must include hashed JS/CSS production chunks');
  assert.ok(swContent.includes('caches.delete(name)'), 'Service worker activate must delete obsolete caches');
  assert.ok(swContent.includes('request.method !== \'GET\''), 'Service worker must ignore non-GET requests');
  assert.ok(swContent.includes('request.mode === \'navigate\''), 'Service worker must handle SPA navigate requests');
  assert.ok(swContent.includes('Offline navigation fallback'), 'Service worker must provide offline index.html fallback');
  console.log('✓ Generated dist/sw.js implements versioned caching, precaching, cache cleanup, and navigation fallback');

  // 5. Registration Guard Verification (src/registerSW.js)
  console.log('\n[5. Service Worker Registration Guard Verification]');
  const regSwContent = fs.readFileSync(path.resolve('src/registerSW.js'), 'utf8');
  assert.ok(
    regSwContent.includes('import.meta.env.PROD'),
    'registerServiceWorker must strictly guard execution with import.meta.env.PROD'
  );
  assert.ok(
    regSwContent.includes("'serviceWorker' in navigator"),
    'registerServiceWorker must check for browser serviceWorker support'
  );
  console.log('✓ Service worker registration is strictly production-only to prevent dev server interference');

  console.log('\n=============================================');
  console.log('ALL PHASE 7 PWA UNIT & CONTRACT TESTS PASSED! ✓');
  console.log('=============================================');
}

runPwaTests();
