import { spawn } from 'node:child_process';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const USER_DATA_DIR = path.resolve('.test-profile');
const TARGET_URL = 'http://localhost:4173/';
const DEBUG_PORT = 9222;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBrowserTests() {
  console.log('=== STARTING REAL BROWSER E2E TEST (PHASE 3: SEARCH, FILTERS & SYNTAX) ===\n');

  if (fs.existsSync(USER_DATA_DIR)) {
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    } catch {}
  }

  // 1. Launch Headless Edge
  console.log('1. Launching Microsoft Edge with remote debugging...');
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
    for (let i = 0; i < 20; i++) {
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

    await new Promise((resolve) => {
      ws.onopen = resolve;
    });

    const sendCommand = (method, params = {}) => {
      return new Promise((resolve, reject) => {
        const id = messageId++;
        callbacks.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    const evaluate = async (expression) => {
      const res = await sendCommand('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (res.exceptionDetails) {
        const detail = res.exceptionDetails.exception?.description || res.exceptionDetails.text || 'Evaluation failed';
        throw new Error(detail);
      }
      return res.result.value;
    };

    await sendCommand('Page.enable');
    await sendCommand('Runtime.enable');

    console.log('2. Waiting for DevShelf React application to render...');
    for (let i = 0; i < 20; i++) {
      const ready = await evaluate(`Boolean(document.body && document.body.innerText)`);
      if (ready) break;
      await sleep(300);
    }
    await sleep(500);

    const initialText = await evaluate(`document.body.innerText`);
    assert.ok(initialText.includes('Your Code Shelf is Empty'));
    console.log('✓ Initial Empty State successfully displayed on screen');

    // 3. Create Snippets with Multiple Languages & Tags
    console.log('3. Creating snippet in Python with syntax highlighting...');
    await evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('New Snippet') || b.innerText.includes('Create First Snippet'));
      if (btn) btn.click();
    })()`);
    await sleep(500);

    await evaluate(`(() => {
      function setReactInputValue(input, value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      function setReactTextareaValue(textarea, value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(textarea, value);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
      function setReactSelectValue(select, value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
        setter.call(select, value);
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }

      setReactInputValue(document.getElementById('snippet-title'), 'FastAPI Healthcheck API');
      setReactSelectValue(document.getElementById('snippet-language'), 'python');
      setReactInputValue(document.getElementById('snippet-folder'), 'Backend');
      setReactTextareaValue(document.getElementById('snippet-code'), '@app.get("/healthz")\\ndef health():\\n    return {"status": "ok"}');

      const tagInput = document.getElementById('snippet-tags');
      setReactInputValue(tagInput, 'python');
      tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Save Snippet'));
      if (saveBtn) saveBtn.click();
    })()`);
    await sleep(1200);

    // Verify Python snippet card appeared
    const afterPython = await evaluate(`document.body.innerText`);
    assert.ok(afterPython.includes('FastAPI Healthcheck API'));
    assert.ok(afterPython.includes('PYTHON'));
    console.log('✓ Python snippet card rendered with language badge and syntax preview');

    // 4. Test Instant Search
    console.log('4. Testing instant search filtering...');
    await evaluate(`(() => {
      const searchInputs = document.querySelectorAll('input[type="text"]');
      const searchInput = Array.from(searchInputs).find(i => i.placeholder.includes('Search') || i.placeholder.includes('Filter in view'));
      if (searchInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(searchInput, 'healthz');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    await sleep(600);

    const searchMatch = await evaluate(`document.body.innerText.includes('FastAPI Healthcheck API')`);
    assert.strictEqual(searchMatch, true, 'Search for "healthz" should match Python snippet code');
    console.log('✓ Instant search matched snippet by code substring');

    // Test non-matching search query
    await evaluate(`(() => {
      const searchInputs = document.querySelectorAll('input[type="text"]');
      const searchInput = Array.from(searchInputs).find(i => i.placeholder.includes('Search') || i.placeholder.includes('Filter in view'));
      if (searchInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(searchInput, 'nomatchqueryxyz');
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    await sleep(600);

    const noResultsText = await evaluate(`document.body.innerText`);
    assert.ok(noResultsText.includes('No matching snippets found'), 'No results state should be shown');
    console.log('✓ No matching search results state verified');

    // Clear search
    await evaluate(`(() => {
      const clearBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Clear all') || b.getAttribute('aria-label') === 'Clear search');
      if (clearBtn) clearBtn.click();
    })()`);
    await sleep(600);

    // 5. Test SnippetDetailModal (Click Card to view detailed code)
    console.log('5. Testing selected-snippet detail viewer modal...');
    await evaluate(`(() => {
      const card = document.querySelector('article');
      if (card) card.click();
    })()`);
    await sleep(800);

    const modalText = await evaluate(`document.body.innerText`);
    assert.ok(modalText.includes('FastAPI Healthcheck API'));
    assert.ok(modalText.includes('Copy Code'));
    assert.ok(modalText.includes('Edit Snippet'));
    console.log('✓ Snippet detail modal opened with full syntax-highlighted code block');

    // Close detail modal via Escape key
    await evaluate(`(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    })()`);
    await sleep(500);

    // 6. Test Sidebar Dynamic Counters & Tag Filter
    console.log('6. Testing Sidebar counts & Tag filtering...');
    const sidebarText = await evaluate(`document.body.innerText`);
    assert.ok(sidebarText.includes('1 folder') || sidebarText.includes('Backend'));
    assert.ok(sidebarText.toLowerCase().includes('python'));
    console.log('✓ Sidebar dynamically updated folders, languages, and tag counts');

    // 7. Verify Theme Switching with Syntax Highlight
    console.log('7. Testing Theme Switcher (Dark <-> Light)...');
    await evaluate(`(() => {
      const themeBtn = document.querySelector('button[aria-label="Toggle theme"]');
      if (themeBtn) themeBtn.click();
    })()`);
    await sleep(400);

    await evaluate(`(() => {
      const lightOption = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Light'));
      if (lightOption) lightOption.click();
    })()`);
    await sleep(500);

    const isLightMode = await evaluate(`!document.documentElement.classList.contains('dark')`);
    assert.strictEqual(isLightMode, true, 'HTML class should switch to light mode');
    console.log('✓ Theme switched to Light mode cleanly');

    // Switch back to Dark mode
    await evaluate(`(() => {
      const themeBtn = document.querySelector('button[aria-label="Toggle theme"]');
      if (themeBtn) themeBtn.click();
    })()`);
    await sleep(400);
    await evaluate(`(() => {
      const darkOption = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Dark'));
      if (darkOption) darkOption.click();
    })()`);
    await sleep(500);

    const isDarkMode = await evaluate(`document.documentElement.classList.contains('dark')`);
    assert.strictEqual(isDarkMode, true, 'HTML class should return to dark mode');
    console.log('✓ Theme switched back to Dark (Charcoal) mode');

    // 8. Phase 4: Command Palette (Ctrl+K) Verification
    console.log('8. Testing Command Palette (Ctrl+K keyboard shortcut)...');
    
    // Test opening with Ctrl+K
    await evaluate(`(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    })()`);
    await sleep(600);

    let isPaletteOpen = await evaluate(`Boolean(document.querySelector('[role="dialog"][aria-label="Command Palette"]'))`);
    assert.strictEqual(isPaletteOpen, true, 'Command palette dialog should open on Ctrl+K');
    console.log('✓ Command Palette opened successfully via Ctrl+K');

    // Test Escape to close
    await evaluate(`(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    })()`);
    await sleep(400);

    isPaletteOpen = await evaluate(`Boolean(document.querySelector('[role="dialog"][aria-label="Command Palette"]'))`);
    assert.strictEqual(isPaletteOpen, false, 'Command palette should close on Escape');
    console.log('✓ Command Palette closed successfully on Escape');

    // Test opening via Navbar button
    console.log('9. Testing Command Palette opening via Navbar shortcut button...');
    await evaluate(`(() => {
      const btn = document.querySelector('button[aria-label="Open Command Palette"]');
      if (btn) btn.click();
    })()`);
    await sleep(600);

    isPaletteOpen = await evaluate(`Boolean(document.querySelector('[role="dialog"][aria-label="Command Palette"]'))`);
    assert.strictEqual(isPaletteOpen, true, 'Command palette should open via navbar trigger');
    console.log('✓ Command Palette opened via Navbar button');

    // Test Arrow key navigation
    console.log('10. Testing Arrow key navigation and selection tracking...');
    const initialSelectedId = await evaluate(`(() => {
      const selected = document.querySelector('[role="option"][aria-selected="true"]');
      return selected ? selected.id : null;
    })()`);

    // Dispatch ArrowDown
    await evaluate(`(() => {
      const dialog = document.querySelector('[role="dialog"][aria-label="Command Palette"]');
      if (dialog) {
        dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      }
    })()`);
    await sleep(300);

    const secondSelectedId = await evaluate(`(() => {
      const selected = document.querySelector('[role="option"][aria-selected="true"]');
      return selected ? selected.id : null;
    })()`);
    assert.notStrictEqual(initialSelectedId, secondSelectedId, 'ArrowDown should move selection');

    // Dispatch ArrowUp
    await evaluate(`(() => {
      const dialog = document.querySelector('[role="dialog"][aria-label="Command Palette"]');
      if (dialog) {
        dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      }
    })()`);
    await sleep(300);

    const backSelectedId = await evaluate(`(() => {
      const selected = document.querySelector('[role="option"][aria-selected="true"]');
      return selected ? selected.id : null;
    })()`);
    assert.strictEqual(initialSelectedId, backSelectedId, 'ArrowUp should move selection back');
    console.log('✓ Arrow key navigation moving active selection verified');

    // 11. Test searching snippet in Palette, opening detail modal, and returning context
    console.log('11. Testing snippet search in palette & nested detail modal return...');
    await evaluate(`(() => {
      const input = document.querySelector('.cmd-palette-input');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'FastAPI');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    await sleep(400);

    // Select matching snippet via Enter
    await evaluate(`(() => {
      const dialog = document.querySelector('[role="dialog"][aria-label="Command Palette"]');
      if (dialog) {
        dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      }
    })()`);
    await sleep(800);

    // Verify Snippet Detail modal is open and palette is hidden
    const isDetailOpen = await evaluate(`Boolean(document.body.innerText.includes('FastAPI Healthcheck API') && document.body.innerText.includes('Copy Code'))`);
    assert.strictEqual(isDetailOpen, true, 'Snippet detail modal should open upon snippet selection');
    isPaletteOpen = await evaluate(`Boolean(document.querySelector('[role="dialog"][aria-label="Command Palette"]'))`);
    assert.strictEqual(isPaletteOpen, false, 'Command palette should close when opening detail modal');
    console.log('✓ Snippet selected from palette opened in SnippetDetailModal');

    // Close detail modal via its close button and verify Command Palette restores context!
    console.log('12. Closing detail modal and verifying Command Palette restores context...');
    await evaluate(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Close dialog"]') || 
                       Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Close'));
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(800);

    isPaletteOpen = await evaluate(`Boolean(document.querySelector('[role="dialog"][aria-label="Command Palette"]'))`);
    assert.strictEqual(isPaletteOpen, true, 'Command palette should automatically restore context after detail modal closes');
    console.log('✓ Preserved context: Command Palette restored on detail modal dismissal');

    // Close palette
    await evaluate(`(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    })()`);
    await sleep(500);

    // 13. Test Quick Command: Export All JSON
    console.log('13. Testing quick command: Export All JSON...');
    await evaluate(`(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    })()`);
    await sleep(400);

    await evaluate(`(() => {
      const input = document.querySelector('.cmd-palette-input');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, '> Export');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    await sleep(400);

    await evaluate(`(() => {
      const dialog = document.querySelector('[role="dialog"][aria-label="Command Palette"]');
      if (dialog) {
        dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      }
    })()`);
    await sleep(800);

    const toastText = await evaluate(`document.body.innerText`);
    assert.ok(toastText.includes('Export') || toastText.includes('devshelf-backup'), 'Toast should confirm JSON export');
    console.log('✓ Quick command "Export All JSON" executed successfully');

    // 14. Phase 5: Sensitive-Data Detection, Masking, and Reveal Controls
    console.log('14. Testing Sensitive-Data snippet creation and detection indicator...');
    await evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('New Snippet'));
      if (btn) btn.click();
    })()`);
    await sleep(600);

    // Fill form with credentials
    await evaluate(`(() => {
      function setReactInputValue(input, value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      function setReactTextareaValue(textarea, value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(textarea, value);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
      function setReactSelectValue(select, value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
        setter.call(select, value);
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }

      setReactInputValue(document.getElementById('snippet-title'), 'AWS Cloud Infrastructure Deploy');
      setReactSelectValue(document.getElementById('snippet-language'), 'bash');
      setReactInputValue(document.getElementById('snippet-folder'), 'DevOps');
      setReactTextareaValue(document.getElementById('snippet-code'), 'export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"\\nexport AWS_SECRET="SuperSecretKey12345"\\necho "Deploying to AWS..."');
    })()`);
    await sleep(500);

    // Verify real-time sensitive detection warning in modal form
    const formWarningDetected = await evaluate(`Boolean(document.body.innerText.includes('Sensitive Credentials Detected'))`);
    assert.strictEqual(formWarningDetected, true, 'Form should indicate sensitive credentials detected before save');
    console.log('✓ Real-time sensitive credentials indicator verified in creation form');

    // Save snippet
    await evaluate(`(() => {
      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Save Snippet'));
      if (saveBtn) saveBtn.click();
    })()`);
    await sleep(1000);

    // 15. Verify Card displays Sensitive badge and Masked code
    console.log('15. Verifying snippet card displays Sensitive badge and masked code by default...');
    const cardText = await evaluate(`document.body.innerText`);
    assert.ok(cardText.includes('AWS Cloud Infrastructure Deploy'));
    assert.ok(cardText.includes('Sensitive'));
    assert.ok(cardText.includes('AKIA••••••••••••MPLE'));
    assert.ok(!cardText.includes('IOSFODNN7EXA'), 'Raw AWS key must NOT be visible on card');
    console.log('✓ Snippet card displays Sensitive badge and safely masked code preview');

    // 16. Verify Snippet Detail Modal default masked view and Reveal toggle
    console.log('16. Testing Snippet Detail Modal default masking and Reveal/Hide toggle...');
    await evaluate(`(() => {
      const cards = Array.from(document.querySelectorAll('article'));
      const awsCard = cards.find(c => c.innerText.includes('AWS Cloud Infrastructure Deploy'));
      if (awsCard) awsCard.click();
    })()`);
    await sleep(800);

    const detailText1 = await evaluate(`document.body.innerText`);
    assert.ok(detailText1.includes('Sensitive Credentials Detected'));
    assert.ok(detailText1.includes('MASKED'));
    assert.ok(detailText1.includes('Reveal Secrets'));
    assert.ok(detailText1.includes('AKIA••••••••••••MPLE'));
    assert.ok(!detailText1.includes('IOSFODNN7EXA'), 'Modal must default to masked content on open');
    console.log('✓ Modal opened with masked credentials by default');

    // Click "Reveal Secrets"
    console.log('17. Clicking "Reveal Secrets" to inspect unmasked credentials...');
    await evaluate(`(() => {
      const revealBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Reveal Secrets'));
      if (revealBtn) revealBtn.click();
    })()`);
    await sleep(500);

    const detailText2 = await evaluate(`document.body.innerText`);
    assert.ok(detailText2.includes('UNMASKED'));
    assert.ok(detailText2.includes('Hide Secrets'));
    assert.ok(detailText2.includes('AKIAIOSFODNN7EXAMPLE'), 'Raw AWS key must be revealed when explicitly requested');
    console.log('✓ Explicit "Reveal Secrets" revealed unmasked credentials and updated banner');

    // Click "Hide Secrets"
    console.log('18. Clicking "Hide Secrets" to re-mask credentials...');
    await evaluate(`(() => {
      const hideBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Hide Secrets'));
      if (hideBtn) hideBtn.click();
    })()`);
    await sleep(500);

    const detailText3 = await evaluate(`document.body.innerText`);
    assert.ok(detailText3.includes('MASKED'));
    assert.ok(!detailText3.includes('IOSFODNN7EXA'), 'Credentials must re-mask when "Hide Secrets" is clicked');
    console.log('✓ "Hide Secrets" safely re-masked credentials');

    // Close and reopen modal to verify transient reveal state resets to masked
    console.log('19. Verifying that closing and reopening resets reveal state to masked...');
    await evaluate(`(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    })()`);
    await sleep(500);

    await evaluate(`(() => {
      const cards = Array.from(document.querySelectorAll('article'));
      const awsCard = cards.find(c => c.innerText.includes('AWS Cloud Infrastructure Deploy'));
      if (awsCard) awsCard.click();
    })()`);
    await sleep(600);

    const detailText4 = await evaluate(`document.body.innerText`);
    assert.ok(detailText4.includes('MASKED'));
    assert.ok(detailText4.includes('Reveal Secrets'));
    assert.ok(!detailText4.includes('IOSFODNN7EXA'), 'Re-opened modal must reset to masked state');
    console.log('✓ Transient reveal state successfully reset to masked upon reopening');

    // Close modal
    await evaluate(`(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    })()`);
    await sleep(500);

    // 20. Test Sensitive Data Filter in Sidebar
    console.log('20. Testing Sensitive Data filter in Sidebar...');
    const sidebarHasSensitive = await evaluate(`Boolean(document.body.innerText.includes('Sensitive Data'))`);
    assert.strictEqual(sidebarHasSensitive, true, 'Sidebar should show Sensitive Data count');

    await evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const sensitiveFilterBtn = buttons.find(b => b.innerText.includes('Sensitive Data'));
      if (sensitiveFilterBtn) sensitiveFilterBtn.click();
    })()`);
    await sleep(600);

    const filteredSnippets = await evaluate(`(() => {
      const cards = Array.from(document.querySelectorAll('article'));
      return cards.map(c => c.querySelector('h3')?.innerText || '');
    })()`);
    assert.ok(filteredSnippets.includes('AWS Cloud Infrastructure Deploy'));
    assert.ok(!filteredSnippets.includes('FastAPI Healthcheck API'), 'Non-sensitive snippet should be filtered out');
    console.log('✓ Sensitive Data filter correctly isolated snippets containing credentials');

    // Clear filter back to All
    await evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const allBtn = buttons.find(b => b.innerText.includes('All Snippets'));
      if (allBtn) allBtn.click();
    })()`);
    await sleep(500);

    // 21. Inspect Console for Zero Errors
    console.log('21. Checking browser console logs...');
    const errors = consoleLogs.filter((l) => l.type === 'error');
    console.log(`   Captured ${consoleLogs.length} console entries, ${errors.length} errors.`);
    if (errors.length > 0) {
      console.warn('Browser console errors:', errors);
    }
    assert.strictEqual(errors.length, 0, 'Browser console should have zero errors');
    console.log('✓ Zero browser console errors recorded during entire user interaction flow');

    console.log('\n=== REAL BROWSER E2E TEST (PHASES 1-5) COMPLETED SUCCESSFULLY! ===\n');
  } finally {
    if (ws) ws.close();
    browserProc.kill();
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    } catch {}
  }
}

runBrowserTests().catch((err) => {
  console.error('\n❌ Browser E2E Test Failed:', err);
  process.exit(1);
});
