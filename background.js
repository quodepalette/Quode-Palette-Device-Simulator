/*
 * Quode Palette Device Simulator: background service worker.
 *
 * What it does:
 *  - Opens the simulator when the toolbar icon, the keyboard shortcut or the context menu is used,
 *    and closes it again when the icon is clicked on a simulator tab.
 *  - Keeps the user inside the simulator when they click a bookmark or link on a simulator tab.
 *  - Adds a per-tab declarativeNetRequest rule that lets pages render inside the device frames
 *    (strips X-Frame-Options and CSP) and sets the User-Agent for that tab's sub-frames only.
 */

const SIM_URL = chrome.runtime.getURL('simulator/simulator.html');
const STORE_KEY = 'qpds';

const DEFAULT_DEVICES = [
  { id: 'macbook-air', land: false },
  { id: 'ipad-pro-11', land: false },
  { id: 'iphone-17-pro-max', land: false }
];
const DEFAULT_ZOOM = '50';

/* Navigation types that mean "the user wants to leave the simulator". */
const LEAVE_TYPES = new Set(['typed', 'generated', 'keyword', 'keyword_generated', 'reload', 'forward_back']);

const isWeb = (url) => /^https?:\/\//i.test(url || '');
const isSim = (url) => !!url && url.indexOf(SIM_URL) === 0;
const simTarget = (url) => SIM_URL + (url ? `?url=${encodeURIComponent(url)}` : '');

/*
 * Tabs that currently show the simulator.
 * Tab events only ever add to this set. Entries are removed in the webNavigation handler, after the
 * navigation has been classified. That way the order in which Chrome fires tabs.onUpdated and
 * webNavigation.onCommitted cannot make us forget a simulator tab too early.
 */
const simTabs = new Set();

/* Tabs we are sending back to a normal page on purpose, so the redirect logic leaves them alone. */
const leaving = new Set();

/* ---------- opening and closing ---------- */

async function resetToDefaults() {
  try {
    const stored = (await chrome.storage.local.get(STORE_KEY))[STORE_KEY] || {};
    stored.slots = DEFAULT_DEVICES.map((d) => ({ ...d }));
    stored.zoom = DEFAULT_ZOOM;
    await chrome.storage.local.set({ [STORE_KEY]: stored });
  } catch (_) { /* storage is best effort; the simulator falls back to its own defaults */ }
}

/*
 * Opens the simulator. If a tab is given and it shows a normal page, a blank page or the simulator
 * itself, the simulator takes over that tab. Otherwise a new tab is created.
 */
async function openSimulator(url, tabId, useDefaults) {
  if (useDefaults) await resetToDefaults();
  if (tabId != null) {
    try {
      const tab = await chrome.tabs.get(tabId);
      const current = tab.url || tab.pendingUrl || '';
      if (isWeb(current) || isSim(current) || current === '' || /^chrome:\/\/newtab/i.test(current)) {
        return chrome.tabs.update(tabId, { url: simTarget(url) });
      }
    } catch (_) { /* the tab is gone; fall through and open a new one */ }
  }
  return chrome.tabs.create({ url: simTarget(url) });
}

/* Sends the tab back to the page that was being previewed. */
async function closeSimulator(tabId) {
  let url = '';
  try {
    const reply = await chrome.tabs.sendMessage(tabId, { type: 'qpds-get-url' });
    url = (reply && reply.url) || '';
  } catch (_) { /* the simulator page did not answer; use the saved URL instead */ }

  if (!isWeb(url)) {
    try {
      const stored = (await chrome.storage.local.get(STORE_KEY))[STORE_KEY];
      url = (stored && stored.url) || '';
    } catch (_) { /* ignore */ }
  }
  if (!isWeb(url)) url = 'chrome://newtab/';

  leaving.add(tabId);
  simTabs.delete(tabId);
  setTimeout(() => leaving.delete(tabId), 8000);
  chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
  chrome.tabs.update(tabId, { url }).catch(() => {});
}

function markSimTab(tabId) {
  if (leaving.has(tabId)) return;
  simTabs.add(tabId);
  chrome.action.setBadgeText({ tabId, text: 'ON' }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#7c5cff' }).catch(() => {});
}

/*
 * Toolbar icon and Alt+Shift+M (there is no popup). On a simulator tab this closes the simulator,
 * on any other tab it opens it with the default devices.
 */
chrome.action.onClicked.addListener((tab) => {
  if (!tab || tab.id == null) return;
  if (isSim(tab.url) || simTabs.has(tab.id)) closeSimulator(tab.id);
  else openSimulator(isWeb(tab.url) ? tab.url : '', tab.id, true);
});

/* ---------- keeping navigation inside the simulator ---------- */

/* Pick up simulator tabs that were already open when the service worker started. */
chrome.tabs.query({}).then((tabs) => {
  tabs.forEach((t) => { if (isSim(t.url)) markSimTab(t.id); });
}).catch(() => {});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (isSim(info.url || tab.url)) markSimTab(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  simTabs.delete(tabId);
  leaving.delete(tabId);
  chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] }).catch(() => {});
});

/* The service worker may have been asleep, so re-check the tab that is about to navigate. */
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0 || simTabs.has(details.tabId) || !isWeb(details.url)) return;
  try {
    const tab = await chrome.tabs.get(details.tabId);
    if (isSim(tab.url)) markSimTab(details.tabId);
  } catch (_) { /* ignore */ }
});

/*
 * Bookmarks and links clicked on a simulator tab load into the simulator instead of replacing it.
 * Typed URLs, reloads and back/forward are left alone so there is always a way out.
 */
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  const tabId = details.tabId;

  if (isSim(details.url)) { markSimTab(tabId); return; }
  if (leaving.has(tabId)) { leaving.delete(tabId); simTabs.delete(tabId); return; }
  if (!simTabs.has(tabId)) return;

  const qualifiers = details.transitionQualifiers || [];
  const userLeft = !isWeb(details.url) ||
    LEAVE_TYPES.has(details.transitionType) ||
    qualifiers.includes('forward_back') ||
    qualifiers.includes('from_address_bar');
  if (userLeft) { simTabs.delete(tabId); return; }

  chrome.tabs.update(tabId, { url: simTarget(details.url) }).catch(() => {});
});

/* ---------- context menu ---------- */

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'qpds-open',
      title: 'Open in Quode Palette Simulator',
      contexts: ['page', 'link']
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'qpds-open') return;
  if (info.linkUrl) openSimulator(info.linkUrl, null, true); // links open in a new tab
  else openSimulator(info.pageUrl || (tab && tab.url), tab && tab.id, true); // pages are taken over
});

/* ---------- messages from the simulator page ---------- */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type || !sender.tab) return;

  // Fallback in case the manifest content script did not reach a frame: inject it into every
  // frame of the simulator tab. inject.js ignores a second run, so this is safe to repeat.
  if (msg.type === 'ensure') {
    chrome.scripting
      .executeScript({ target: { tabId: sender.tab.id, allFrames: true }, files: ['inject.js'], world: 'MAIN' })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === 'configure') {
    configureTab(sender.tab.id, msg.ua)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
});

/* ---------- per-tab network rule ---------- */

/*
 * Installs a session rule scoped to one simulator tab. It only touches sub-frames, so the simulator
 * page itself and every other tab are unaffected. The rule id is the tab id and the rule is removed
 * when the tab closes.
 */
async function configureTab(tabId, ua) {
  const action = {
    type: 'modifyHeaders',
    responseHeaders: [
      { header: 'x-frame-options', operation: 'remove' },
      { header: 'content-security-policy', operation: 'remove' },
      { header: 'content-security-policy-report-only', operation: 'remove' }
    ]
  };
  if (ua) {
    action.requestHeaders = [{ header: 'user-agent', operation: 'set', value: ua }];
  }

  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [tabId],
    addRules: [{
      id: tabId,
      priority: 1,
      action,
      condition: { tabIds: [tabId], resourceTypes: ['sub_frame'] }
    }]
  });
}
