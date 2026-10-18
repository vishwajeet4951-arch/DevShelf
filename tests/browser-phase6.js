import { spawn } from 'node:child_process';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const USER_DATA_DIR = path.resolve('.test-profile-phase6');
const TARGET_URL = 'http://localhost:4173/';
const DEBUG_PORT = 9223;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBrowserPhase6Tests() {
  console.log('=== STARTING REAL BROWSER E2E TEST (PHASE 6: JSON IMPORT/EXPORT & RECOVERY) ===\n');

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
    await sendCDP('Page.navigate', { url: TARGET_URL });
    await sleep(1500);

    const evaluate = async (expression) => {
      const res = await sendCDP('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return res.result?.value;
    };

    // 2. Initial Page Verification
    console.log('\n2. Verifying page load and Navbar import/export triggers...');
    const pageTitle = await evaluate('document.title');
    assert.ok(pageTitle.includes('DevShelf'), 'Page title should contain DevShelf');

    const navbarButtons = await evaluate(`
      ({
        hasImportBtn: Boolean(document.querySelector('button[aria-label="Import JSON Backup"]')),
        hasExportBtn: Boolean(document.querySelector('button[aria-label="Export All JSON"]')),
      })
    `);

    assert.strictEqual(navbarButtons.hasImportBtn, true, 'Navbar must have Import JSON button');
    assert.strictEqual(navbarButtons.hasExportBtn, true, 'Navbar must have Export All JSON button');
    console.log('✓ Navbar contains functional Import and Export trigger buttons');

    // 3. Testing Import Modal Opening and Closing via Navbar
    console.log('\n3. Testing Import Modal opening via Navbar button...');
    await evaluate(`document.querySelector('button[aria-label="Import JSON Backup"]').click()`);
    await sleep(300);

    const modalState = await evaluate(`
      ({
        isOpen: Boolean(document.querySelector('[aria-labelledby="import-dialog-title"]')),
        hasDropzone: Boolean(document.querySelector('input[type="file"][accept*=".json"]')),
        titleText: document.querySelector('#import-dialog-title')?.textContent?.trim(),
      })
    `);

    assert.strictEqual(modalState.isOpen, true, 'Import modal dialog must be visible');
    assert.strictEqual(modalState.hasDropzone, true, 'File dropzone input must be present');
    assert.strictEqual(modalState.titleText, 'Import JSON Backup');
    console.log('✓ Import Modal opens with file dropzone and accessible dialog structure');

    // Close via Cancel button
    await evaluate(`
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
      cancelBtn?.click();
    `);
    await sleep(300);

    const isClosed = await evaluate(`!document.querySelector('[aria-labelledby="import-dialog-title"]')`);
    assert.strictEqual(isClosed, true, 'Import modal should be closed after clicking Cancel');
    console.log('✓ Import Modal closes cleanly on Cancel');

    // 4. Testing Command Palette Integration for Import
    console.log('\n4. Testing Command Palette (> Import JSON Backup)...');
    // Open palette
    await sendCDP('Input.dispatchKeyEvent', { type: 'keyDown', key: 'k', modifiers: 2 }); // Ctrl+K
    await sendCDP('Input.dispatchKeyEvent', { type: 'keyUp', key: 'k', modifiers: 2 });
    await sleep(400);

    const paletteOpen = await evaluate(`Boolean(document.querySelector('[aria-label="Command Palette"]'))`);
    assert.strictEqual(paletteOpen, true, 'Command Palette should open on Ctrl+K');

    // Type "> import"
    await evaluate(`
      (() => {
        const input = document.querySelector('.cmd-palette-input');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, '> import');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `);
    await sleep(300);

    const commandFound = await evaluate(`
      (() => {
        const options = Array.from(document.querySelectorAll('[role="option"]'));
        const importCmd = options.find(o => o.textContent.includes('Import JSON Backup'));
        if (importCmd) {
          importCmd.click();
          return true;
        }
        return false;
      })()
    `);

    assert.strictEqual(commandFound, true, 'Command Palette must list and trigger "Import JSON Backup" command');
    await sleep(400);

    const modalReopened = await evaluate(`Boolean(document.querySelector('[aria-labelledby="import-dialog-title"]'))`);
    assert.strictEqual(modalReopened, true, 'Import modal should open directly from Command Palette');
    console.log('✓ Command Palette triggers Import Modal smoothly');

    // 5. Testing Simulated File Upload & Validation
    console.log('\n5. Testing file selection, validation UI, and merge/replace workflow...');

    const sampleBackupPayload = {
      app: 'DevShelf',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      snippets: [
        {
          id: 'test-uuid-1111-2222-3333-444444444444',
          title: 'Imported E2E Helper Function',
          code: 'export function e2eHelper() { return "DevShelf E2E"; }',
          language: 'javascript',
          folder: 'Testing',
          tags: ['e2e', 'automation'],
          isPinned: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'test-uuid-5555-6666-7777-888888888888',
          title: 'Imported Secret Config',
          code: 'const token = "AKIAIOSFODNN7EXAMPLE";',
          language: 'javascript',
          folder: 'Config',
          tags: ['security'],
          isPinned: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      ],
    };

    // Inject file into input element and trigger change event
    await evaluate(`
      (() => {
        const fileContent = ${JSON.stringify(JSON.stringify(sampleBackupPayload))};
        const blob = new Blob([fileContent], { type: 'application/json' });
        const file = new File([blob], 'devshelf-test-backup.json', { type: 'application/json' });
        
        const fileInput = document.querySelector('input[type="file"]');
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `);
    await sleep(600);

    const validationCards = await evaluate(`
      ({
        fileName: document.querySelector('.truncate')?.textContent?.trim(),
        hasValidSnippets: document.body.textContent.includes('Valid Snippets'),
        hasSensitiveAlert: document.body.textContent.includes('sensitive credentials'),
        importBtnText: Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Import Snippets'))?.textContent?.trim(),
      })
    `);

    assert.ok(validationCards.hasValidSnippets, 'Validation summary must display valid snippets count');
    assert.ok(validationCards.hasSensitiveAlert, 'Validation must detect sensitive AWS credential and show alert');
    console.log('✓ Validation summary displays valid counts and detects sensitive data in backup');

    // 6. Test Atomic Replace Mode & Mandatory Confirmation Checkbox
    console.log('\n6. Testing Atomic Replace mode and mandatory confirmation...');
    await evaluate(`
      const replaceBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Atomic Replace'));
      replaceBtn?.click();
    `);
    await sleep(300);

    const replaceStateBeforeCheck = await evaluate(`
      ({
        hasWarning: document.body.textContent.includes('Destructive Action'),
        isSubmitDisabled: Boolean(Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Replace All Snippets'))?.disabled),
      })
    `);

    assert.strictEqual(replaceStateBeforeCheck.hasWarning, true, 'Atomic Replace warning must be visible');
    assert.strictEqual(replaceStateBeforeCheck.isSubmitDisabled, true, 'Submit button must be disabled before confirmation');
    console.log('✓ Replace button is safely disabled until confirmation checkbox is toggled');

    // Check confirmation checkbox
    await evaluate(`
      const checkbox = document.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.click();
      }
    `);
    await sleep(300);

    const isSubmitEnabled = await evaluate(`
      !Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Replace All Snippets'))?.disabled
    `);
    assert.strictEqual(isSubmitEnabled, true, 'Submit button must become enabled after confirmation');
    console.log('✓ Submit button enables after checking confirmation checkbox');

    // 7. Execute Import and verify snippets appear in workspace
    console.log('\n7. Executing Atomic Replace import and verifying workspace update...');
    await evaluate(`
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Replace All Snippets'));
      submitBtn?.click();
    `);
    await sleep(1000);

    const workspaceSnippets = await evaluate(`
      Array.from(document.querySelectorAll('article h3')).map(h => h.textContent.trim())
    `);

    assert.ok(workspaceSnippets.includes('Imported E2E Helper Function'), 'Imported snippet must render in workspace');
    assert.ok(workspaceSnippets.includes('Imported Secret Config'), 'Imported sensitive snippet must render in workspace');
    console.log('✓ Restored snippets rendered successfully in workspace: ' + workspaceSnippets.join(', '));

    // 8. Test Export JSON button
    console.log('\n8. Testing Export All JSON trigger...');
    await evaluate(`document.querySelector('button[aria-label="Export All JSON"]').click()`);
    await sleep(600);

    const toastMessage = await evaluate(`
      document.querySelector('[role="status"]')?.textContent?.trim() || ''
    `);
    assert.ok(toastMessage.includes('Exported') || toastMessage.includes('Export'), 'Export toast should be displayed');
    console.log('✓ Export triggers cleanly with toast feedback: ' + toastMessage);

    console.log('\n======================================================');
    console.log('ALL PHASE 6 REAL BROWSER E2E TESTS PASSED SUCCESSFULLY! ✓');
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

runBrowserPhase6Tests().catch((err) => {
  console.error('Browser E2E test failed:', err);
  process.exit(1);
});
