(async () => {
  const STORE = 'qpds';
  const $ = (s) => document.querySelector(s);
  const stored = (await chrome.storage.local.get(STORE))[STORE] || {};
  const custom = stored.custom || [];
  const devices = [...custom, ...DEVICES];
  const select = $('#device');

  const groups = [['custom', 'Custom'], ['phone', 'Phones'], ['tablet', 'Tablets'], ['watch', 'Watches'], ['desktop', 'Desktop & displays']];
  for (const [key, label] of groups) {
    const rows = devices.filter((d) => (key === 'custom' ? d.custom : !d.custom && d.type === key));
    if (!rows.length) continue;
    const og = document.createElement('optgroup');
    og.label = label;
    for (const d of rows) {
      const o = document.createElement('option');
      o.value = d.id;
      o.textContent = `${d.name} (${d.w}×${d.h})`;
      og.appendChild(o);
    }
    select.appendChild(og);
  }
  const current = stored.slots && stored.slots[0] && stored.slots[0].id;
  select.value = devices.some((d) => d.id === current) ? current : 'iphone-16';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && /^https?:\/\//i.test(tab.url || '')) $('#url').value = tab.url;

  const open = async () => {
    let url = $('#url').value.trim();
    if (url && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = (/^(localhost|127\.|192\.168\.|10\.)/i.test(url) ? 'http://' : 'https://') + url;
    stored.slots = [{ id: select.value, land: false }];
    await chrome.storage.local.set({ [STORE]: stored });
    await chrome.runtime.sendMessage({ type: 'open', url, tabId: tab && tab.id });
    window.close();
  };
  $('#open').addEventListener('click', open);
  $('#url').addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
})();
