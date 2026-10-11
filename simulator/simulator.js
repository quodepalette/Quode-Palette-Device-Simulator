(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const STORE = 'qpds';
  const MAX_SLOTS = 3;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const DEFAULT_SET = {
    theme: 'dark', bg: 'auto', bgColor: '#ffffff', dots: true,
    frame: true, frameColor: 'auto', labels: true,
    touch: true, showScrollbars: false,
    sync: true, syncMode: 'ratio'
  };
  const DEFAULT_SLOT = { id: 'iphone-16', land: false };

  let S = {
    slots: [{ id: 'macbook-air', land: false }, { id: 'ipad-pro-11', land: false }, { id: 'iphone-17-pro-max', land: false }], zoom: '50', url: '',
    favs: ['galaxy-s25-fe', 'iphone-14', 'iphone-5', 'macbook-air', 'ipad-pro-11'], custom: [], set: { ...DEFAULT_SET }
  };
  let sel = 0;               // slot selected in the picker
  let query = '';
  let frames = [];
  let gotNav = [];
  let watchdog = 0;
  let toastTimer = 0;
  let isFs = false;

  const all = () => [...S.custom, ...DEVICES];
  const byId = (id) => all().find((d) => d.id === id) || DEVICES.find((d) => d.id === 'iphone-16');
  const save = () => chrome.storage.local.set({ [STORE]: S });
  const dims = (slot) => {
    const d = byId(slot.id);
    return slot.land ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
  };
  const rotatable = (d) => ['phone', 'tablet', 'watch'].includes(d.type);

  /* ---------- icons ---------- */
  const svg = (d, vb = '0 0 24 24') => `<svg viewBox="${vb}">${d}</svg>`;
  const ICON = {
    rotate: svg('<rect x="7" y="2" width="10" height="16" rx="2" transform="rotate(30 12 10)"/><path d="M3 18c2 3 6 4 9 3"/>'),
    reload: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    apple: svg('<rect x="7" y="2" width="10" height="20" rx="2.500"/><path d="M10.500 5h3"/>'),
    android: svg('<path d="M6 10h12v7a1.500 1.500 0 0 1-1.500 1.500H7.500A1.500 1.500 0 0 1 6 17zM8 6.500l-1.500-2M16 6.500l1.500-2M6 10a6 6 0 0 1 12 0M9.500 8h.01M14.500 8h.01"/>'),
    tablet: svg('<rect x="4" y="3" width="16" height="18" rx="2.500"/><path d="M11 18h2"/>'),
    watch: svg('<rect x="7" y="6" width="10" height="12" rx="3"/><path d="M9 6l1-4h4l1 4M9 18l1 4h4l1-4"/>'),
    star: svg('<path d="m12 3 2.700 5.600 6.100.8-4.500 4.200 1.100 6-5.400-3-5.400 3 1.100-6L3.200 9.400l6.100-.8z"/>'),
    laptop: svg('<rect x="4" y="5" width="16" height="11" rx="1.500"/><path d="M2 19h20"/>'),
    custom: svg('<rect x="3" y="5" width="14" height="10" rx="2"/><rect x="14" y="9" width="7" height="11" rx="1.500"/>')
  };

  /* Small outline icon drawn at the device's real aspect ratio (picker tiles and slot chips). */
  function devIcon(d) {
    const kind = kindOf(d);
    const ratio = d.w / d.h;
    let w, h;
    if (ratio >= 1) { w = 40; h = Math.max(14, 40 / ratio); } else { h = 32; w = Math.max(12, 32 * ratio); }
    const x = (48 - w) / 2, y = (44 - h) / 2 - (kind === 'laptop' ? 2 : 0) - (kind === 'monitor' || kind === 'hub' || kind === 'tv' ? 2 : 0);
    const r = kind === 'watch' ? 6 : kind === 'laptop' || kind === 'monitor' || kind === 'tv' ? 1.5 : Math.min(5, w / 4);
    let extra = '';
    if (kind === 'laptop') extra = `<path d="M${x - 5} ${y + h + 3}h${w + 10}"/>`;
    else if (kind === 'monitor') extra = `<path d="M${24} ${y + h}v4M${18} ${y + h + 4}h12"/>`;
    else if (kind === 'tv') extra = `<path d="M${x + 6} ${y + h + 2}h6M${x + w - 12} ${y + h + 2}h6"/>`;
    else if (kind === 'hub') extra = `<path d="M${x + w * 0.3} ${y + h + 3}h${w * 0.4}"/>`;
    else if (kind === 'watch') extra = `<path d="M${x + 4} ${y}l1-6h${w - 10}l1 6M${x + 4} ${y + h}l1 6h${w - 10}l1-6"/>`;
    else if (kind === 'island') extra = `<path d="M${24 - 3} ${y + 3.5}h6"/>`;
    else if (kind === 'notch') extra = `<path d="M${24 - 5} ${y + 1}h10"/>`;
    return `<svg viewBox="0 0 48 44"><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${r}"/>${extra}</svg>`;
  }

  /* ---------- helpers ---------- */
  function toast(msg, ms = 3500) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  function normalize(u) {
    u = (u || '').trim();
    if (!u) return '';
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) return u;
    if (/^(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.)/i.test(u)) return 'http://' + u;
    return 'https://' + u;
  }

  /* Frame geometry.
   *   t, r, b, l : bezel around the screen, including the metal rim
   *   rad        : screen corner radius
   *   orad       : outer body corner radius
   *   rim        : width of the metal band
   *   et, eb     : extra space above and below the body (watch straps, laptop base, monitor stand) */
  function metrics(d, land) {
    const none = { t: 0, r: 0, b: 0, l: 0, rad: 0, orad: 0, rim: 0, et: 0, eb: 0 };
    if (!S.set.frame) return none;
    const U = (p, rad, orad, rim, ex = {}) => ({ t: p, r: p, b: p, l: p, rad, orad, rim, et: 0, eb: 0, ...ex });
    switch (kindOf(d)) {
      case 'island': return U(21, 52, 73, 7);
      case 'notch': return U(20, 44, 64, 6.5);
      case 'punch': return d.fold ? U(23, 27, 46, 5.5) : U(12, 38, 50, 3.5);
      case 'bar': return { t: 38, b: 38, l: 11, r: 11, rad: 6, orad: 30, rim: 3.5, et: 0, eb: 0 };
      case 'home':
        return land
          ? { t: 28, b: 28, l: 108, r: 112, rad: 3, orad: 54, rim: 6, et: 0, eb: 0 }
          : { t: 108, b: 112, l: 28, r: 28, rad: 3, orad: 54, rim: 6, et: 0, eb: 0 };
      case 'tablet': return U(34, 20, 46, 4.5);
      case 'watch': return U(17, 46, 62, 4, { et: 58, eb: 58 });
      case 'laptop': return { t: 60, l: 37, r: 37, b: 64, rad: 2, orad: 42, rim: 2, et: 0, eb: 42 };
      case 'tv': return { t: 11, l: 11, r: 11, b: 14, rad: 0, orad: 7, rim: 2.5, et: 0, eb: 15 };
      case 'hub': return { t: 16, l: 16, r: 16, b: 16, rad: 6, orad: 22, rim: 3, et: 0, eb: 46 };
      default: return { t: 16, l: 16, r: 16, b: 58, rad: 2, orad: 16, rim: 3, et: 0, eb: 80 }; // monitor
    }
  }

  function autoFrameColor(d) {
    const k = kindOf(d);
    const pro = /pro|ultra/i.test(d.name);
    if (d.fold) return 'forest';
    if (k === 'island') return d.os === 'ios' ? (pro ? 'titanium' : 'black') : 'black';
    if (k === 'laptop') return 'spacegray';
    if (k === 'tablet' || k === 'monitor') return 'silver';
    if (k === 'watch') return 'titanium';
    if (k === 'hub') return 'silver';
    return 'black';
  }

  function cfgFor(slot) {
    const d = byId(slot.id);
    const { w, h } = dims(slot);
    const touch = !!(S.set.touch && d.touch);
    return {
      ua: uaFor(d), platform: platformFor(d), os: d.os, type: d.type,
      w, h, dpr: d.dpr, touch, hideSb: touch && !S.set.showScrollbars,
      mobile: d.type === 'phone' || d.type === 'watch'
    };
  }

  const frameName = (i) => 'qpds:' + btoa(JSON.stringify(cfgFor(S.slots[i])));
  const lastCfg = [];

  /* Pushes config changes to a frame that is already loaded (its name can't change after insertion). */
  function applyCfg(i, force) {
    const f = frames[i];
    if (!f || !S.slots[i]) return;
    const cfg = cfgFor(S.slots[i]);
    const key = JSON.stringify(cfg);
    if (!force && lastCfg[i] === key) return;
    lastCfg[i] = key;
    try { f.contentWindow && f.contentWindow.postMessage({ qpds: 'cfg', cfg }, '*'); } catch (_) {}
  }

  /* ---------- settings ---------- */
  function resolveTheme() {
    const t = S.set.theme;
    return t === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t;
  }

  function applyLook() {
    document.documentElement.dataset.theme = resolveTheme();
    const stage = $('#stage');
    const { bg, bgColor, dots } = S.set;
    let color = '';
    if (bg === 'white') color = '#ffffff';
    else if (bg === 'black') color = '#000000';
    else if (bg === 'custom') color = bgColor;
    stage.style.setProperty('--stage', color || '');
    if (!color) stage.style.removeProperty('--stage');
    let dot = '';
    let light = false;
    if (color) {
      const n = parseInt(color.slice(1), 16);
      const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
      light = lum > 0.55;
      dot = light ? 'rgba(20,22,40,.12)' : 'rgba(255,255,255,.1)';
    }
    if (dot) stage.style.setProperty('--dotc', dot); else stage.style.removeProperty('--dotc');
    stage.classList.toggle('nodots', !dots);
    stage.classList.toggle('light-bg', color ? light : resolveTheme() === 'light');
    $('#app').classList.toggle('nolabels', !S.set.labels);
    $('#rowBgColor').hidden = bg !== 'custom';
  }

  function syncSettingsUI() {
    $$('[data-set]').forEach((el) => {
      const v = S.set[el.dataset.set];
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
    });
    $$('[data-tog]').forEach((b) => b.setAttribute('aria-pressed', String(!!S.set[b.dataset.tog])));
    $('#zoom').value = String(S.zoom);
  }

  function setSetting(key, val) {
    S.set[key] = val;
    save();
    syncSettingsUI();
    applyLook();
    if (['frame', 'labels', 'frameColor'].includes(key)) layout();
    if (['touch', 'showScrollbars'].includes(key)) S.slots.forEach((_, i) => applyCfg(i));
  }

  /* ---------- device picker ---------- */
  const groupOf = (d) => d.custom ? 'custom' : d.type === 'phone' ? (d.os === 'ios' ? 'ios' : 'android') : d.type === 'tablet' ? 'tablet' : 'special';
  const GROUPS = [
    ['fav', 'Favorites', ICON.star], ['android', 'Android Phones', ICON.android], ['ios', 'Apple Phones', ICON.apple],
    ['tablet', 'Tablets', ICON.tablet], ['special', 'Specials', ICON.watch], ['custom', 'My custom devices', ICON.custom]
  ];

  function tile(d) {
    const fav = S.favs.includes(d.id);
    const on = S.slots[sel] && S.slots[sel].id === d.id;
    return `<div class="tile ${on ? 'on' : ''}" role="button" tabindex="0" data-id="${esc(d.id)}" title="${esc(d.name)} · ${d.w}×${d.h}">
      <i class="star ${fav ? 'on' : ''}" data-star="${esc(d.id)}" title="${fav ? 'Remove from favorites' : 'Add to favorites'}">★</i>
            ${d.custom ? `<i class="del" data-del="${esc(d.id)}" title="Delete device"><svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></i>` : ''}
      <span class="ti">${devIcon(d)}</span><span class="tn">${esc(d.name)}</span></div>`;
  }

  function renderPicker() {
    const q = query.trim().toLowerCase();
    const match = (d) => !q || d.name.toLowerCase().includes(q);

    $('#pSlots').innerHTML = S.slots.map((s, i) =>
      `<button class="sl ${i === sel ? 'on' : ''}" data-sl="${i}" title="${esc(byId(s.id).name)}">${devIcon(byId(s.id))}${S.slots.length > 1 ? `<i class="x" data-rm="${i}" title="Remove"><svg viewBox="0 0 10 10" width="8" height="8" aria-hidden="true"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></i>` : ''}</button>`
    ).join('') +
      `<button class="sl add" data-addslot ${S.slots.length >= MAX_SLOTS ? 'disabled' : ''} title="Add a device to compare">${ICON.plus}</button>`;

    let html = '';
    for (const [key, label, icon] of GROUPS) {
      let list;
      if (key === 'fav') list = S.favs.map((id) => all().find((d) => d.id === id)).filter(Boolean).filter(match);
      else list = all().filter((d) => groupOf(d) === key && match(d));
      if (key === 'custom') {
        html += `<div class="g-h">${icon}<span>${label}</span></div><div class="grid">${list.map(tile).join('')}<div class="tile plus" role="button" tabindex="0" data-newcustom title="Add custom device">+</div></div>`;
        continue;
      }
      if (!list.length) continue;
      html += `<div class="g-h">${icon}<span>${label}</span></div><div class="grid">${list.map(tile).join('')}</div>`;
    }
    $('#pBody').innerHTML = html || '<div class="none">No devices match.</div>';
    $('#devLabel').textContent = S.slots.length > 1 ? `${S.slots.length} devices` : byId(S.slots[0].id).name;
  }

  function togglePanel(which, force) {
    const panels = { picker: ['#picker', '#btnDevices'], settings: ['#settings', '#btnSettings'] };
    for (const [k, [p, b]] of Object.entries(panels)) {
      const open = k === which ? (force === undefined ? $(p).hidden : force) : false;
      $(p).hidden = !open;
      $(b).setAttribute('aria-expanded', String(open));
    }
    if (which === 'picker' && !$('#picker').hidden) {
      sel = Math.min(sel, S.slots.length - 1);
      renderPicker();
      $('#search').focus();
    }
  }

  function assignDevice(id) {
    S.slots[sel] = { id, land: false };
    save(); renderPicker(); rebuild();
  }

  function pickerClick(e) {
    const t = e.target;
    const star = t.closest('[data-star]');
    const del = t.closest('[data-del]');
    const rm = t.closest('[data-rm]');
    if (star) {
      const id = star.dataset.star;
      S.favs = S.favs.includes(id) ? S.favs.filter((x) => x !== id) : [...S.favs, id];
      save(); renderPicker(); return;
    }
    if (del) {
      const id = del.dataset.del;
      S.custom = S.custom.filter((d) => d.id !== id);
      S.favs = S.favs.filter((x) => x !== id);
      S.slots = S.slots.filter((s) => s.id !== id);
      if (!S.slots.length) S.slots = [{ ...DEFAULT_SLOT }];
      sel = Math.min(sel, S.slots.length - 1);
      save(); renderPicker(); rebuild(); return;
    }
    if (rm) {
      const i = Number(rm.dataset.rm);
      if (S.slots.length > 1) { S.slots.splice(i, 1); sel = Math.min(sel, S.slots.length - 1); save(); renderPicker(); rebuild(); }
      return;
    }
    if (t.closest('[data-addslot]')) {
      if (S.slots.length >= MAX_SLOTS) return;
      S.slots.push({ id: S.slots[sel].id, land: false });
      sel = S.slots.length - 1;
      save(); renderPicker(); rebuild(); return;
    }
    const sl = t.closest('[data-sl]');
    if (sl) { sel = Number(sl.dataset.sl); renderPicker(); return; }
    if (t.closest('[data-newcustom]')) { $('#dlg').showModal(); return; }
    const tl = t.closest('.tile[data-id]');
    if (tl) assignDevice(tl.dataset.id);
  }

  /* ---------- stage ---------- */
  function buildSlot(i) {
    const el = document.createElement('section');
    el.className = 'slot';
    el.dataset.i = i;
    el.innerHTML = `
      <header class="slot-h">
        <div class="slot-t"><b></b><span></span></div>
        <div class="slot-a">
          <button data-a="rotate" title="Rotate" aria-label="Rotate">${ICON.rotate}</button>
          <button data-a="reload" title="Reload" aria-label="Reload">${ICON.reload}</button>
          <button data-a="remove" title="Remove" aria-label="Remove">${ICON.close}</button>
        </div>
      </header>
      <div class="holder">
        <div class="device">
          <i class="strap top"></i><i class="strap bot"></i>
          <i class="sb l1"></i><i class="sb l2"></i><i class="sb l3"></i><i class="sb r1"></i><i class="sb r2"></i>
          <i class="stand"></i><i class="hg"></i>
          <div class="bezel"></div>
          <div class="screen">
            <i class="cut"><b></b><b></b></i><i class="homebar"></i><i class="crease"></i><i class="glare"></i>
          </div>
          <i class="speaker"></i><i class="cam"></i><i class="hbtn"></i><span class="chin"></span>
          <i class="base"></i>
        </div>
      </div>`;
    return el;
  }

  function rebuild() {
    const wrap = $('#slots');
    wrap.textContent = '';
    frames = [];
    gotNav = [];
    leader = -1;
    lastCfg.length = 0;
    S.slots.forEach((_, i) => wrap.appendChild(buildSlot(i)));
    layout();
    loadFrames();
  }

  function layout() {
    const stage = $('#stage');
    const wrap = $('#slots');
    wrap.classList.toggle('framed', S.set.frame);
    wrap.classList.toggle('unframed', !S.set.frame);

    const items = S.slots.map((slot) => {
      const d = byId(slot.id);
      const { w, h } = dims(slot);
      const m = metrics(d, slot.land);
      const ow = w + m.l + m.r, oh = h + m.t + m.b;
      const es = kindOf(d) === 'laptop' && S.set.frame ? Math.round(ow * 0.113) : 0;
      return { slot, d, w, h, m, ow, oh, es, tw: ow + es * 2, th: oh + m.et + m.eb };
    });

    const showHead = S.set.labels && !isFs;
    const gap = 44, padX = isFs ? 56 : 90, padY = isFs ? 56 : 52, headH = showHead ? 52 : 0;
    let scale;
    if (S.zoom === 'fit') {
      const sumW = items.reduce((a, it) => a + it.tw, 0) + gap * (items.length - 1);
      const maxH = Math.max(...items.map((it) => it.th)) + headH;
      scale = Math.min(1, (stage.clientWidth - padX) / sumW, (stage.clientHeight - padY) / maxH);
    } else {
      scale = Number(S.zoom) / 100;
    }
    scale = Math.max(scale, 0.08);
    const pct = Math.round(scale * 100);

    $$('.slot', wrap).forEach((el, i) => {
      const { slot, d, w, h, m, ow, oh, es, tw, th } = items[i];
      const kind = kindOf(d);
      $('.slot-t b', el).textContent = d.name;
      $('.slot-t span', el).textContent = `${w} × ${h} · ${d.dpr}x · ${pct}%`;
      $('[data-a="remove"]', el).style.display = S.slots.length > 1 ? '' : 'none';
      $('[data-a="rotate"]', el).style.display = rotatable(d) ? '' : 'none';

      const holder = $('.holder', el);
      holder.style.width = tw * scale + 'px';
      holder.style.height = th * scale + 'px';

      const dev = $('.device', el);
      Object.assign(dev.style, {
        width: ow + 'px', height: oh + 'px', left: es * scale + 'px', top: m.et * scale + 'px',
        transform: `scale(${scale})`
      });
      dev.style.setProperty('--orad', m.orad + 'px');
      dev.style.setProperty('--rim', m.rim + 'px');
      dev.style.setProperty('--es', es + 'px');
      dev.style.setProperty('--eb', m.eb + 'px');
      dev.dataset.kind = kind;
      dev.dataset.land = String(!!slot.land);
      dev.dataset.fold = d.fold || '';
      dev.dataset.nw = kind === 'notch' && /^iphone-(x|xr|11|11-pro|11-pro-max)$/.test(d.id) ? 'wide' : 'std';
      dev.dataset.eb = m.eb;
      dev.dataset.fc = S.set.frameColor === 'auto' ? autoFrameColor(d) : S.set.frameColor;
      $('.chin', dev).textContent = d.chin || '';
      dev.dataset.chin = d.chin ? '1' : '';

      Object.assign($('.screen', el).style, {
        left: m.l + 'px', top: m.t + 'px', width: w + 'px', height: h + 'px', borderRadius: m.rad + 'px'
      });
      applyCfg(i);
    });
  }

  /* Creates (or recreates) the iframe for slot i. The emulation config travels in the iframe name, which
   * has to be set before the iframe is inserted because Chrome ignores later changes to it. */
  function mountFrame(i, src) {
    const screen = $(`.slot[data-i="${i}"] .screen`, $('#slots'));
    if (!screen) return;
    const f = document.createElement('iframe');
    f.title = 'Device preview';
    f.setAttribute('allow', 'clipboard-write; fullscreen; geolocation; camera; microphone; autoplay');
    f.name = frameName(i);
    f.addEventListener('load', () => onFrameLoad(i, f));
    if (frames[i] && frames[i].isConnected) frames[i].replaceWith(f); else screen.prepend(f);
    frames[i] = f;
    lastCfg[i] = JSON.stringify(cfgFor(S.slots[i]));
    f.src = src;
  }

  const loadedAt = [], seenAt = [];
  let ensureTimer = 0;
  function onFrameLoad(i, f) {
    if (frames[i] !== f) return;
    loadedAt[i] = performance.now();
    // Fallback: if the in-frame script never reported in, ask the background worker to inject it.
    clearTimeout(ensureTimer);
    ensureTimer = setTimeout(() => {
      if (frames.some((fr, k) => fr && (seenAt[k] || 0) < (loadedAt[k] || 0))) {
        try { chrome.runtime.sendMessage({ type: 'ensure' }); } catch (_) {}
      }
    }, 900);
  }

  async function loadFrames() {
    const empty = $('#empty');
    if (!S.url) { empty.hidden = false; return; }
    empty.hidden = true;
    try {
      await chrome.runtime.sendMessage({ type: 'configure', ua: uaFor(byId(S.slots[0].id)) });
    } catch (e) {
      toast('Could not configure the simulator. Try reloading the extension.');
    }
    gotNav = [];
    leader = -1; queued = null;
    S.slots.forEach((_, i) => mountFrame(i, S.url));
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      if (!gotNav.some(Boolean)) {
        toast('This page isn\'t responding inside the frame. It may block embedding, or it may not be a regular http(s) page.', 7000);
      }
    }, 12000);
  }

  function go(raw) {
    const url = normalize(raw);
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) return toast('Only http(s) pages can be simulated.');
    try { new URL(url); } catch (_) { return toast('That doesn\'t look like a valid URL.'); }
    S.url = url;
    $('#url').value = url;
    save();
    loadFrames();
  }

  function rotateAll() {
    const first = S.slots.findIndex((s) => rotatable(byId(s.id)));
    if (first < 0) return;
    const to = !S.slots[first].land;
    S.slots.forEach((s) => { if (rotatable(byId(s.id))) s.land = to; });
    save(); layout();
  }

  /* ---------- fullscreen ---------- */
  async function setFs(on) {
    if (on === isFs) return;
    isFs = on;
    $('#app').classList.toggle('fs', on);
    togglePanel('picker', false); togglePanel('settings', false);
    try {
      if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen();
      if (!on && document.fullscreenElement) await document.exitFullscreen();
    } catch (_) { /* the immersive layout still works without the browser fullscreen API */ }
    layout();
  }

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && isFs) { isFs = false; $('#app').classList.remove('fs'); layout(); }
  });

  /* ---------- synchronized scrolling ----------
   * Leader and follower model:
   *  - The frame the user interacts with (pointer, wheel, keys, touch) becomes the only leader.
   *  - Scroll reports from any other frame are dropped, since they are echoes or page-driven noise.
   *  - The leader's position is sent to the followers at most once per animation frame.
   *  - When the leader stops, its final position is sent once more so followers whose content grew
   *    in the meantime (lazy images, reveal animations) settle on the matching position. */
  let leader = -1;
  let queued = null, syncRaf = 0, settleTimer = 0;

  function pushScroll(i, d) {
    frames.forEach((f, j) => {
      if (j === i || !f || !f.contentWindow) return;
      try {
        f.contentWindow.postMessage({ qpds: 'scrollto', ratio: d.ratio, ratioX: d.ratioX || 0, x: d.x, y: d.y, inner: d.inner, mode: S.set.syncMode }, '*');
      } catch (_) {}
    });
  }

  function setLeader(i) {
    if (leader === i) return;
    leader = i;
    queued = null;
    cancelAnimationFrame(syncRaf); syncRaf = 0;
    clearTimeout(settleTimer);
  }

  function onFrameScroll(i, d) {
    if (!S.set.sync || S.slots.length < 2) return;
    if (leader >= 0 && leader !== i) return; // only the frame the user is driving may lead
    leader = i;
    queued = { i, d };
    if (!syncRaf) {
      syncRaf = requestAnimationFrame(() => {
        syncRaf = 0;
        if (queued) pushScroll(queued.i, queued.d);
      });
    }
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { if (queued) pushScroll(queued.i, queued.d); }, 200);
  }

  /* Clicks and typing in one frame are replayed in all the others. */
  function onFrameSync(i, d) {
    if (!S.set.sync || S.slots.length < 2) return;
    setLeader(i);
    frames.forEach((f, j) => {
      if (j === i || !f || !f.contentWindow) return;
      try { f.contentWindow.postMessage({ qpds: 'replay', kind: d.kind, target: d.target, value: d.value }, '*'); } catch (_) {}
    });
  }

  /* ---------- events ---------- */
  function bind() {
    $('#urlForm').addEventListener('submit', (e) => { e.preventDefault(); go($('#url').value); });
    $('#btnReload').addEventListener('click', () => { if (S.url) loadFrames(); });
    $('#btnRotate').addEventListener('click', rotateAll);
    $('#btnFs').addEventListener('click', () => setFs(true));
    $('#fsExit').addEventListener('click', () => setFs(false));
    $('#btnDevices').addEventListener('click', () => togglePanel('picker'));
    $('#btnSettings').addEventListener('click', () => togglePanel('settings'));
    $('#setClose').addEventListener('click', () => togglePanel('settings', false));
    $('#lnkCustom').addEventListener('click', (e) => { e.preventDefault(); $('#dlg').showModal(); });

    $('#zoom').addEventListener('change', (e) => { S.zoom = e.target.value; save(); layout(); });
    $$('[data-tog]').forEach((b) => b.addEventListener('click', () => setSetting(b.dataset.tog, !S.set[b.dataset.tog])));
    $$('[data-set]').forEach((el) => el.addEventListener('input', () => setSetting(el.dataset.set, el.type === 'checkbox' ? el.checked : el.value)));
    $('#setReset').addEventListener('click', () => {
      S.set = { ...DEFAULT_SET };
      save(); syncSettingsUI(); applyLook(); layout(); S.slots.forEach((_, i) => applyCfg(i));
      toast('Settings reset.');
    });
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyLook);

    $('#search').addEventListener('input', (e) => { query = e.target.value; renderPicker(); });
    const pk = $('#picker');
    pk.addEventListener('click', pickerClick);
    pk.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.tile')) { e.preventDefault(); e.target.click(); }
    });

    document.addEventListener('mousedown', (e) => {
      if (e.target.closest('#picker, #settings, #btnDevices, #btnSettings, dialog')) return;
      togglePanel('picker', false); togglePanel('settings', false);
    });

    $('#slots').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-a]');
      if (!btn) return;
      const i = Number(btn.closest('.slot').dataset.i);
      if (btn.dataset.a === 'rotate') { S.slots[i].land = !S.slots[i].land; save(); layout(); }
      if (btn.dataset.a === 'reload' && S.url) { mountFrame(i, gotNav[i] || S.url); }
      if (btn.dataset.a === 'remove' && S.slots.length > 1) { S.slots.splice(i, 1); sel = Math.min(sel, S.slots.length - 1); save(); renderPicker(); rebuild(); }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isFs) setFs(false);
        else { togglePanel('picker', false); togglePanel('settings', false); }
        return;
      }
      if (/^(input|textarea|select)$/i.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'r' || e.key === 'R') rotateAll();
      if (e.key === 'f' || e.key === 'F') setFs(!isFs);
    });

    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || !d.qpds) return;
      const i = frames.findIndex((f) => f && f.contentWindow === e.source);
      if (i < 0) return;
      seenAt[i] = performance.now();
      if (d.qpds === 'hello') {
        try { e.source.postMessage({ qpds: 'cfg', cfg: cfgFor(S.slots[i]), full: true }, '*'); } catch (_) {}
      } else if (d.qpds === 'nav') {
        gotNav[i] = d.url;
        if (i === 0 && document.activeElement !== $('#url')) $('#url').value = d.url;
        if (d.title && i === 0) document.title = `${d.title} · Quode Palette`;
      } else if (d.qpds === 'active') {
        setLeader(i);
      } else if (d.qpds === 'scroll') {
        onFrameScroll(i, d);
      } else if (d.qpds === 'sync') {
        onFrameSync(i, d);
      }
    });

    new ResizeObserver(() => layout()).observe($('#stage'));

    /* custom device dialog */
    const dlg = $('#dlg');
    $('#cCancel').addEventListener('click', () => dlg.close());
    $('#dlgForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const type = $('#cType').value;
      const dev = {
        id: 'custom-' + Date.now(), custom: true, name: $('#cName').value.trim() || 'Custom device', type,
        w: Math.round(+$('#cW').value), h: Math.round(+$('#cH').value), dpr: +$('#cDpr').value || 1,
        os: $('#cOs').value, notch: type === 'phone' ? 'punch' : 'none', touch: type !== 'desktop'
      };
      S.custom.push(dev);
      dlg.close();
      query = ''; $('#search').value = '';
      assignDevice(dev.id);
      toast(`Added “${dev.name}”.`);
    });
  }

  /* When the toolbar icon closes the simulator, the background worker asks which page to return to. */
  chrome.runtime.onMessage.addListener((msg, _s, send) => {
    if (msg && msg.type === 'qpds-get-url') { send({ url: gotNav[0] || S.url || '' }); }
  });

  /* ---------- init ---------- */
  async function init() {
    const stored = (await chrome.storage.local.get(STORE))[STORE];
    if (stored) S = Object.assign(S, stored, { set: { ...DEFAULT_SET, ...(stored.set || {}) } });
    const oldDefaults = ['iphone-16', 'ipad-pro-11', 'macbook-air'];
    const requestedDefaults = ['galaxy-s25-fe', 'iphone-14', 'iphone-5', 'macbook-air', 'ipad-pro-11'];
    if (!stored || !Array.isArray(stored.favs) || (stored.favs.length === oldDefaults.length && oldDefaults.every((id) => stored.favs.includes(id)))) S.favs = requestedDefaults;
    S.favs = Array.isArray(S.favs) ? S.favs : [];
    S.slots = (S.slots || []).filter((s) => all().some((d) => d.id === s.id)).slice(0, MAX_SLOTS);
    if (!S.slots.length) S.slots = [{ ...DEFAULT_SLOT }];

    const param = new URLSearchParams(location.search).get('url');
    if (param) S.url = normalize(param);
    if (S.url && !/^https?:\/\//i.test(S.url)) S.url = '';
    $('#url').value = S.url || '';

    bind();
    syncSettingsUI();
    applyLook();
    renderPicker();
    rebuild();
    if (!S.url) $('#url').focus();
  }

  init();
})();
