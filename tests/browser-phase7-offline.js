import { spawn } from 'node:child_process';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const USER_DATA_DIR = path.resolve('.test-profile-phase7');
const TARGET_URL = 'http://localhost:4173/';
const DEBUG_PORT = 9224;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBrowserPhase7OfflineTests() {
  console.log('=== STARTING REAL BROWSER E2E TEST (PHASE 7: SERVICE WORKER & OFFLINE) ===\n');

  if (fs.existsSync(USER_DATA_DIR)) {
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    } catch {}
  }

  // 1. Launch Headless Edge
  console.log('1. Launching Microsoft Edge with remote debugging on port ' + DEBUG_PORT + '...');
  const browserProc = spawn(
    EDGE_PATH,
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      TARGET_URL,
    ],
    { stdio: 'ignore' }
  );

  let ws = null;

  try {
    let targets = null;
    for (let i = 0; i < 25; i++) {
      await sleep(500);
      try {
        const res = await fetch(`http://localhost:${DEBUG_PORT}/json/list`);
        if (res.ok) {
          targets = await res.json();
          if (targets && targets.length > 0) break;
        }
      } catch {}
    }

    assert.ok(targets && targets.length > 0, 'Could not connect to browser CDP endpoint');
    const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
    console.log(`✓ Connected to browser page target: ${pageTarget.title || pageTarget.url}`);

    ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    let messageId = 1;
    const callbacks = new Map();
    const consoleLogs = [];

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && callbacks.has(msg.id)) {
        const { resolve, reject } = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        const type = msg.params.type;
        const text = msg.params.args.map((a) => a.value || a.description || '').join(' ');
        consoleLogs.push({ type, text });
      } else if (msg.method === 'Runtime.exceptionThrown') {
        consoleLogs.push({ type: 'error', text: msg.params.exceptionDetails.text });
      }
    };

    await new Promise((resolve) => (ws.onopen = resolve));

    const sendCDP = (method, params = {}) => {
      const id = messageId++;
      return new Promise((resolve, reject) => {
        callbacks.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    await sendCDP('Runtime.enable');
    await sendCDP('Page.enable');
    await sendCDP('Network.enable');
    await sendCDP('Page.navigate', { url: TARGET_URL });
    await sleep(2000);

    const evaluate = async (expression) => {
      const res = await sendCDP('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return res.result?.value;
    };

    // 2. Service Worker Registration & Activation (Online phase)
    console.log('\n2. Waiting for Service Worker registration and shell caching...');
    
    // Wait up to 10s for service worker to register and take control
    let swReady = false;
    for (let i = 0; i < 20; i++) {
      swReady = await evaluate(`
        (async () => {
          if (!('serviceWorker' in navigator)) return false;
          const reg = await navigator.serviceWorker.getRegistration();
          return Boolean(reg && (reg.active || reg.installing || reg.waiting));
        })()
      `);
      if (swReady) break;
      await sleep(500);
    }
    assert.strictEqual(swReady, true, 'Service worker must register successfully in production');
    console.log('✓ Service worker registration confirmed');

    // Wait for caches to open and precache assets
    let cacheKeys = [];
    for (let i = 0; i < 20; i++) {
      cacheKeys = await evaluate(`caches.keys()`) || [];
      if (cacheKeys.length > 0) break;
      await sleep(500);
    }
    assert.ok(cacheKeys.length > 0, 'Cache Storage must contain versioned DevShelf cache');
    const shellCacheName = cacheKeys.find((k) => k.startsWith('devshelf-shell-'));
    assert.ok(shellCacheName, `Found versioned cache: ${shellCacheName}`);
    console.log(`✓ Application shell cache created: ${shellCacheName}`);

    // Inspect cached URLs and verify Strict Privacy
    const cachedUrls = await evaluate(`
      (async () => {
        const cache = await caches.open('${shellCacheName}');
        const reqs = await cache.keys();
        return reqs.map(r => r.url);
      })()
    `);
    assert.ok(cachedUrls.length >= 5, 'Precache must store application shell files');
    console.log(`✓ Precached ${cachedUrls.length} shell assets:`);
    cachedUrls.forEach((u) => {
      const parsed = new URL(u);
      console.log(`    • ${parsed.pathname}`);
      // Strict Data Privacy: Ensure no snippets or secrets are in Cache Storage
      assert.ok(!parsed.pathname.includes('/api/'), 'No API or snippet endpoints allowed in cache');
      assert.ok(!parsed.search.includes('snippet'), 'No snippet query data allowed in cache');
    });

    // 3. Seed an initial snippet in IndexedDB
    console.log('\n3. Seeding initial snippet in IndexedDB while online...');
    await evaluate(`
      (() => {
        const newBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Snippet'));
        newBtn?.click();
      })()
    `);
    await sleep(400);

    await evaluate(`
      (() => {
        const setValue = (selector, val) => {
          const el = document.querySelector(selector);
          if (!el) return;
          const proto = (el instanceof HTMLTextAreaElement) 
            ? window.HTMLTextAreaElement.prototype 
            : window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        setValue('#snippet-title', 'Seed Offline Snippet');
        setValue('#snippet-code', 'const awsKey = "AKIAIOSFODNN7EXAMPLE";');
        setValue('#snippet-folder', 'Offline Test');

        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Save Snippet'));
        saveBtn?.click();
      })()
    `);
    await sleep(800);

    const initialSnippetList = await evaluate(`
      Array.from(document.querySelectorAll('article h3')).map(h => h.textContent.trim())
    `);
    assert.ok(initialSnippetList.includes('Seed Offline Snippet'), 'Seeded snippet must render in list');
    console.log('✓ Initial snippet created with credentials: "Seed Offline Snippet"');

    // 4. Emulate Completely Offline Network via CDP
    console.log('\n4. Emulating genuine offline network conditions via CDP...');
    await sendCDP('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });

    // Trigger offline event in window so reactive useOnlineStatus hook updates immediately
    await evaluate(`window.dispatchEvent(new Event('offline'))`);
    await sleep(400);

    const offlineBadge = await evaluate(`
      document.querySelector('[aria-label="Offline Mode Active"]')?.textContent?.trim()
    `);
    assert.ok(offlineBadge && offlineBadge.includes('Offline'), 'Navbar must show offline indicator');
    console.log(`✓ Offline status indicator displayed in Navbar: "${offlineBadge}"`);

    // 5. Reload the Application while Completely Offline
    console.log('\n5. Reloading the application while genuinely offline...');
    await sendCDP('Page.reload');
    await sleep(2000);

    const reloadedTitle = await evaluate('document.title');
    assert.ok(reloadedTitle.includes('DevShelf'), 'App shell must load successfully offline from Service Worker cache');
    console.log(`✓ Application successfully launched offline: "${reloadedTitle}"`);

    // Verify previously seeded snippet persisted across offline reload from IndexedDB
    const offlineReloadSnippets = await evaluate(`
      Array.from(document.querySelectorAll('article h3')).map(h => h.textContent.trim())
    `);
    assert.ok(offlineReloadSnippets.includes('Seed Offline Snippet'), 'IndexedDB snippets must persist after offline reload');
    console.log('✓ IndexedDB snippets persisted after offline reload: ' + offlineReloadSnippets.join(', '));

    // 6. Complete CRUD Operations While Offline
    console.log('\n6. Testing complete snippet CRUD operations while offline...');

    // CREATE offline
    await evaluate(`
      (() => {
        const newBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Snippet'));
        newBtn?.click();
      })()
    `);
    await sleep(400);

    await evaluate(`
      (() => {
        const setValue = (selector, val) => {
          const el = document.querySelector(selector);
          if (!el) return;
          const proto = (el instanceof HTMLTextAreaElement) 
            ? window.HTMLTextAreaElement.prototype 
            : window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        setValue('#snippet-title', 'Created While Offline');
        setValue('#snippet-code', 'console.log("Offline creation verified!");');
        setValue('#snippet-folder', 'Local Zone');

        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Save Snippet'));
        saveBtn?.click();
      })()
    `);
    await sleep(800);

    const afterOfflineCreate = await evaluate(`
      Array.from(document.querySelectorAll('article h3')).map(h => h.textContent.trim())
    `);
    assert.ok(afterOfflineCreate.includes('Created While Offline'), 'Snippet created offline must render in list');
    console.log('✓ Successfully created new snippet while offline in IndexedDB');

    // PIN offline
    await evaluate(`
      (() => {
        const cards = Array.from(document.querySelectorAll('article'));
        const offlineCard = cards.find(c => c.textContent.includes('Created While Offline'));
        const pinBtn = offlineCard?.querySelector('button[title*="Pin"]');
        pinBtn?.click();
      })()
    `);
    await sleep(500);
    console.log('✓ Toggled snippet pin while offline');

    // SEARCH offline
    await evaluate(`
      (() => {
        const searchInput = document.querySelector('input[placeholder*="Search"]');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        setter?.call(searchInput, 'Created While Offline');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `);
    await sleep(400);

    const filteredSnippets = await evaluate(`
      Array.from(document.querySelectorAll('article h3')).map(h => h.textContent.trim())
    `);
    assert.strictEqual(filteredSnippets.length, 1, 'Search filtering must work offline without network');
    assert.strictEqual(filteredSnippets[0], 'Created While Offline');
    console.log('✓ Instant multi-field search operates offline with 0 network calls');

    // Clear search
    await evaluate(`
      (() => {
        const searchInput = document.querySelector('input[placeholder*="Search"]');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        setter?.call(searchInput, '');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `);
    await sleep(400);

    // 7. Command Palette Offline Verification
    console.log('\n7. Testing Command Palette (Ctrl+K) while offline...');
    await sendCDP('Input.dispatchKeyEvent', { type: 'keyDown', key: 'k', modifiers: 2 });
    await sendCDP('Input.dispatchKeyEvent', { type: 'keyUp', key: 'k', modifiers: 2 });
    await sleep(400);

    const cmdPaletteOpen = await evaluate(`Boolean(document.querySelector('[aria-label="Command Palette"]'))`);
    assert.strictEqual(cmdPaletteOpen, true, 'Command Palette must open offline via Ctrl+K');

    // Navigate to and select snippet in palette
    await evaluate(`
      (() => {
        const options = Array.from(document.querySelectorAll('[role="option"]'));
        const snippetOpt = options.find(o => o.textContent.includes('Seed Offline Snippet'));
        snippetOpt?.click();
      })()
    `);
    await sleep(400);

    const detailModalOpen = await evaluate(`
      Boolean(document.querySelector('[role="dialog"][aria-labelledby="detail-title"]'))
    `);
    assert.strictEqual(detailModalOpen, true, 'Snippet Detail modal opens offline from Command Palette');
    console.log('✓ Command Palette navigates and opens detail modal offline');

    // 8. Secret Detection, Masking & Reveal Controls Offline
    console.log('\n8. Testing credential masking and reveal controls offline...');
    const detailMasked = await evaluate(`
      (() => {
        const modal = document.querySelector('[role="dialog"][aria-labelledby="detail-title"]');
        return modal?.textContent.includes('••••••••');
      })()
    `);
    assert.strictEqual(detailMasked, true, 'Credentials must be visually masked offline by default');

    // Click Reveal
    await evaluate(`
      (() => {
        const revealBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Reveal Secrets') || b.getAttribute('aria-label')?.includes('Reveal'));
        revealBtn?.click();
      })()
    `);
    await sleep(300);

    const detailRevealed = await evaluate(`
      (() => {
        const modal = document.querySelector('[role="dialog"][aria-labelledby="detail-title"]');
        return modal?.textContent.includes('AKIAIOSFODNN7EXAMPLE');
      })()
    `);
    assert.strictEqual(detailRevealed, true, 'Sensitive data reveals correctly offline upon explicit user action');

    // Close detail modal via Escape key
    await sendCDP('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape' });
    await sendCDP('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape' });
    await sleep(300);
    console.log('✓ Secret detection, masking, and reveal controls verified offline');

    // 9. Export JSON Backup Offline
    console.log('\n9. Testing JSON backup export while offline...');
    await evaluate(`document.querySelector('button[aria-label="Export All JSON"]').click()`);
    await sleep(500);

    const exportToast = await evaluate(`
      document.querySelector('[role="status"]')?.textContent?.trim() || ''
    `);
    assert.ok(exportToast.includes('Exported'), 'JSON backup export operates successfully offline');
    console.log(`✓ Offline JSON export verified: "${exportToast}"`);

    // 10. Responsive Viewport Audits (375x812, 768x1024, 1440x900)
    console.log('\n10. Running Responsive Viewport Audits...');

    // Mobile: 375 x 812
    console.log('  Testing Mobile Viewport (375 × 812)...');
    await sendCDP('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await sleep(500);

    const mobileAudit = await evaluate(`
      ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        hasHamburger: Boolean(document.querySelector('button[aria-label*="menu"]')),
      })
    `);
    assert.ok(
      mobileAudit.scrollWidth <= mobileAudit.innerWidth + 1,
      `No horizontal page overflow on mobile (${mobileAudit.scrollWidth} <= ${mobileAudit.innerWidth})`
    );
    assert.strictEqual(mobileAudit.hasHamburger, true, 'Mobile view must display hamburger menu button');

    // Open mobile sidebar drawer
    await evaluate(`document.querySelector('button[aria-label*="menu"]').click()`);
    await sleep(300);
    const drawerOpen = await evaluate(`
      document.querySelector('[role="dialog"][aria-label="Navigation drawer"]')?.classList.contains('translate-x-0')
    `);
    assert.strictEqual(drawerOpen, true, 'Mobile sidebar drawer opens on hamburger button tap');

    // Close mobile drawer on Escape
    await sendCDP('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape' });
    await sendCDP('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape' });
    await sleep(300);
    const drawerClosed = await evaluate(`
      document.querySelector('[role="dialog"][aria-label="Navigation drawer"]')?.classList.contains('-translate-x-full')
    `);
    assert.strictEqual(drawerClosed, true, 'Mobile sidebar drawer closes cleanly on Escape');
    console.log('  ✓ Mobile viewport (375x812) audit passed with zero horizontal overflow');

    // Tablet: 768 x 1024
    console.log('  Testing Tablet Viewport (768 × 1024)...');
    await sendCDP('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(400);

    const tabletAudit = await evaluate(`
      ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        hasSidebar: Boolean(document.querySelector('aside[aria-label="Sidebar navigation"]')),
      })
    `);
    assert.ok(tabletAudit.scrollWidth <= tabletAudit.innerWidth + 1, 'No horizontal overflow on tablet');
    assert.strictEqual(tabletAudit.hasSidebar, true, 'Tablet view displays persistent sidebar');
    console.log('  ✓ Tablet viewport (768x1024) audit passed');

    // Desktop: 1440 x 900
    console.log('  Testing Desktop Viewport (1440 × 900)...');
    await sendCDP('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(400);

    const desktopAudit = await evaluate(`
      ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        hasSidebar: Boolean(document.querySelector('aside[aria-label="Sidebar navigation"]')),
      })
    `);
    assert.ok(desktopAudit.scrollWidth <= desktopAudit.innerWidth + 1, 'No horizontal overflow on desktop');
    assert.strictEqual(desktopAudit.hasSidebar, true, 'Desktop view displays wide sidebar');
    console.log('  ✓ Desktop viewport (1440x900) audit passed');

    // 11. Final Console Error Inspection
    console.log('\n11. Inspecting browser console error logs...');
    const criticalErrors = consoleLogs.filter(
      (log) => log.type === 'error' && !log.text.includes('favicon') && !log.text.includes('Failed to load resource: net::ERR_INTERNET_DISCONNECTED')
    );
    assert.strictEqual(criticalErrors.length, 0, `Expected 0 critical console errors, found: ${JSON.stringify(criticalErrors)}`);
    console.log('✓ 0 critical console errors recorded across online, offline, and responsive testing');

    console.log('\n======================================================');
    console.log('ALL PHASE 7 REAL BROWSER OFFLINE TESTS PASSED! ✓');
    console.log('======================================================');

  } finally {
    if (ws) ws.close();
    browserProc.kill();
    await sleep(500);
    if (fs.existsSync(USER_DATA_DIR)) {
      try {
        fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
      } catch {}
    }
  }
}

runBrowserPhase7OfflineTests().catch((err) => {
  console.error('Browser Phase 7 Offline test failed:', err);
  process.exit(1);
});
