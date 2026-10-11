/*
 * Quode Palette Device Simulator: in-frame emulation (runs in the page's MAIN world).
 *
 * This script is injected into every page but returns immediately unless the page is a sub-frame
 * created by the simulator. The simulator passes its device config in one of two ways:
 *   1. window.name = "qpds:<base64 json>", set on the <iframe> before it is inserted.
 *   2. A "hello" -> "cfg" postMessage handshake, used as a fallback if the name was lost.
 *
 * Once running it:
 *   - spoofs navigator, screen, devicePixelRatio and userAgentData
 *   - rewrites pointer and hover media queries for touch devices
 *   - turns mouse drags into touch events with inertial scrolling
 *   - reports navigation, scroll position, clicks and typing to the simulator for syncing
 */
(() => {
  'use strict';
  if (window === window.top) return;
  if (window.__qpdsLoaded) return;

  const readName = () => {
    try {
      if (window.name && window.name.slice(0, 5) === 'qpds:') return JSON.parse(atob(window.name.slice(5)));
    } catch (_) { /* name is missing or not ours */ }
    return null;
  };
  const fromExtensionPage = () => {
    try {
      const ao = location.ancestorOrigins;
      return !!(ao && ao.length && ao[ao.length - 1].indexOf('chrome-extension://') === 0);
    } catch (_) { return false; }
  };

  const first = readName();
  if (first) {
    start(first);
  } else if (fromExtensionPage()) {
    // Fallback: ask the simulator for the config. It arrives late, but everything except the
    // earliest spoofing still works.
    const onCfg = (e) => {
      if (e.source !== parent || !e.data || e.data.qpds !== 'cfg' || !e.data.full) return;
      removeEventListener('message', onCfg);
      clearInterval(retry);
      start(e.data.cfg);
    };
    addEventListener('message', onCfg);
    let tries = 0;
    const ask = () => { try { parent.postMessage({ qpds: 'hello' }, '*'); } catch (_) {} };
    const retry = setInterval(() => { if (++tries > 20) clearInterval(retry); else ask(); }, 400);
    ask();
  }

  function start(cfg) {
  if (window.__qpdsLoaded) return;
  window.__qpdsLoaded = true;

  const def = (obj, key, getter) => {
    try { Object.defineProperty(obj, key, { get: getter, configurable: true }); } catch (_) {}
  };

  /* ---------- identity ---------- */
  def(navigator, 'userAgent', () => cfg.ua);
  def(navigator, 'appVersion', () => cfg.ua.replace(/^Mozilla\//, ''));
  def(navigator, 'platform', () => cfg.platform);
  def(navigator, 'maxTouchPoints', () => (cfg.touch ? 5 : 0));
  def(navigator, 'vendor', () => (cfg.os === 'ios' ? 'Apple Computer, Inc.' : 'Google Inc.'));
  def(window, 'devicePixelRatio', () => cfg.dpr);

  const isLandscape = () => cfg.w > cfg.h;
  def(screen, 'width', () => cfg.w);
  def(screen, 'height', () => cfg.h);
  def(screen, 'availWidth', () => cfg.w);
  def(screen, 'availHeight', () => cfg.h);
  def(screen, 'orientation', () => ({
    type: isLandscape() ? 'landscape-primary' : 'portrait-primary',
    angle: isLandscape() ? 90 : 0,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    lock: () => Promise.resolve(),
    unlock() {}
  }));

  if (cfg.os === 'ios') {
    def(navigator, 'userAgentData', () => undefined);
  } else if ('userAgentData' in navigator) {
    const plat = { android: 'Android', mac: 'macOS', win: 'Windows' }[cfg.os] || 'Android';
    const brands = [
      { brand: 'Chromium', version: '138' },
      { brand: 'Google Chrome', version: '138' },
      { brand: 'Not)A;Brand', version: '8' }
    ];
    const uad = {
      brands,
      get mobile() { return !!cfg.mobile; },
      platform: plat,
      getHighEntropyValues: async () => ({
        brands, mobile: !!cfg.mobile, platform: plat, platformVersion: '15.0.0',
        architecture: '', model: '', uaFullVersion: '138.0.0.0'
      }),
      toJSON() { return { brands, mobile: !!cfg.mobile, platform: plat }; }
    };
    def(navigator, 'userAgentData', () => uad);
  }

  if (cfg.touch) {
    for (const n of ['ontouchstart', 'ontouchend', 'ontouchmove', 'ontouchcancel']) {
      if (!(n in window)) { try { window[n] = null; } catch (_) {} }
    }
  }

  /* ---------- media queries ---------- */
  const nativeMM = window.matchMedia.bind(window);
  window.matchMedia = (query) => {
    let q = String(query);
    if (cfg.touch) {
      q = q
        .replace(/\(\s*(any-)?pointer\s*:\s*coarse\s*\)/g, '(min-width:0px)')
        .replace(/\(\s*(any-)?pointer\s*:\s*fine\s*\)/g, '(max-width:0px)')
        .replace(/\(\s*(any-)?hover\s*:\s*hover\s*\)/g, '(max-width:0px)')
        .replace(/\(\s*(any-)?hover\s*:\s*none\s*\)/g, '(min-width:0px)');
    }
    return nativeMM(q);
  };

  /* ---------- touch cursor and hidden scrollbars ---------- */
  const cursorSvg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'><circle cx='14' cy='14' r='11' fill='rgba(124,92,255,.35)' stroke='white' stroke-width='2'/></svg>";
  const curStyle = document.createElement('style');
  curStyle.textContent =
    `html,html *{cursor:url("data:image/svg+xml,${encodeURIComponent(cursorSvg)}") 14 14,auto !important}`;
  const sbStyle = document.createElement('style');
  sbStyle.textContent = '::-webkit-scrollbar{display:none !important}html{scrollbar-width:none !important}';
  const applyStyles = () => {
    curStyle.disabled = !cfg.touch;
    sbStyle.disabled = !cfg.hideSb;
  };
  const mount = () => {
    const host = document.head || document.documentElement;
    if (!curStyle.isConnected) host.appendChild(curStyle);
    if (!sbStyle.isConnected) host.appendChild(sbStyle);
    applyStyles();
  };
  if (document.documentElement) mount();
  document.addEventListener('DOMContentLoaded', mount);

  /* ---------- mouse to touch ---------- */
  let drag = null;
  let noClickUntil = 0;
  let vx = 0, vy = 0, glideId = 0;
  const NO_DRAG = 'input,textarea,select,[contenteditable=""],[contenteditable="true"],video,audio,iframe';

  const scrollerFor = (el, dx, dy) => {
    for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      const cs = getComputedStyle(el);
      const canY = /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
      const canX = /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
      if ((canY && Math.abs(dy) >= Math.abs(dx)) || (canX && Math.abs(dx) > Math.abs(dy))) return el;
    }
    return mainScroller().el;
  };

  const fire = (type, e, target) => {
    try {
      const t = new Touch({
        identifier: 1, target, clientX: e.clientX, clientY: e.clientY,
        pageX: e.pageX, pageY: e.pageY, screenX: e.screenX, screenY: e.screenY,
        radiusX: 10, radiusY: 10, force: 0.5
      });
      const list = type === 'touchend' ? [] : [t];
      target.dispatchEvent(new TouchEvent(type, {
        bubbles: true, cancelable: true, composed: true,
        touches: list, targetTouches: list, changedTouches: [t], view: window
      }));
    } catch (_) {}
  };

  const scrollBy = (sc, dx, dy) => sc.scrollBy({ left: dx, top: dy, behavior: 'instant' });

  const glide = (sc) => {
    cancelAnimationFrame(glideId);
    const step = () => {
      if (drag || (Math.abs(vx) < 0.15 && Math.abs(vy) < 0.15)) return;
      scrollBy(sc, -vx, -vy);
      vx *= 0.94; vy *= 0.94;
      glideId = requestAnimationFrame(step);
    };
    glideId = requestAnimationFrame(step);
  };

  const swallowClick = (ev) => { ev.stopPropagation(); ev.preventDefault(); };

  window.addEventListener('mousedown', (e) => {
    if (!e.isTrusted || !cfg.touch || e.button !== 0) return;
    cancelAnimationFrame(glideId);
    if (e.target.closest && e.target.closest(NO_DRAG)) return;
    drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, target: e.target, moved: false, sc: null };
    vx = vy = 0;
    fire('touchstart', e, e.target);
    e.preventDefault(); // avoid text selection while dragging
  }, true);

  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
      drag.moved = true;
      drag.sc = scrollerFor(drag.target, e.clientX - drag.x, e.clientY - drag.y);
    }
    scrollBy(drag.sc, -dx, -dy);
    vx = dx; vy = dy;
    drag.lx = e.clientX; drag.ly = e.clientY;
    fire('touchmove', e, drag.target);
  }, true);

  const release = (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    fire('touchend', e, d.target);
    if (d.moved) {
      noClickUntil = performance.now() + 120;
      window.addEventListener('click', swallowClick, true);
      setTimeout(() => window.removeEventListener('click', swallowClick, true), 60);
      glide(d.sc);
    }
  };
  window.addEventListener('mouseup', release, true);
  document.addEventListener('mouseleave', release);

  /* ---------- navigation reporting ---------- */
  const post = () => {
    try { parent.postMessage({ qpds: 'nav', url: location.href, title: document.title }, '*'); } catch (_) {}
  };
  for (const m of ['pushState', 'replaceState']) {
    const orig = history[m];
    history[m] = function () { const r = orig.apply(this, arguments); post(); return r; };
  }
  addEventListener('popstate', post);
  addEventListener('hashchange', post);
  addEventListener('DOMContentLoaded', post);
  addEventListener('load', post);
  post();

  /* ---------- scroll sync ----------
   * Reports the scroll position of the page's main scroller and applies positions sent by the
   * simulator. The main scroller is the document or, for apps that scroll an inner element, the large
   * scrollable element in the middle of the viewport. Scroll events caused by our own writes are
   * recognised and never reported back. */
  const docScroller = () => document.scrollingElement || document.documentElement;
  const canScrollY = (el) => el.scrollHeight - el.clientHeight > 2;
  const canScrollX = (el) => el.scrollWidth - el.clientWidth > 2;
  const isScrollable = (el) => {
    try {
      const cs = getComputedStyle(el);
      return (/(auto|scroll|overlay)/.test(cs.overflowY) && canScrollY(el)) ||
             (/(auto|scroll|overlay)/.test(cs.overflowX) && canScrollX(el));
    } catch (_) { return false; }
  };
  let innerEl = null; // cached inner main scroller (when the document itself doesn't scroll)
  const findInner = () => {
    if (innerEl && innerEl.isConnected && isScrollable(innerEl)) return innerEl;
    innerEl = null;
    let el = null;
    try { el = document.elementFromPoint(innerWidth / 2, innerHeight / 2); } catch (_) {}
    for (; el && el !== document.documentElement; el = el.parentElement) {
      if (isScrollable(el)) { innerEl = el; break; }
    }
    if (!innerEl && document.body && isScrollable(document.body)) innerEl = document.body;
    return innerEl;
  };
  const mainScroller = () => {
    const se = docScroller();
    if (canScrollY(se) || canScrollX(se)) return { el: se, inner: false };
    const inner = findInner();
    return inner ? { el: inner, inner: true } : { el: se, inner: false };
  };
  const isMainTarget = (t) => {
    if (!t || t === document || t === window || t === document.documentElement || t === document.scrollingElement) return docScroller();
    if (t.nodeType === 1 && t.clientHeight >= innerHeight * 0.55 && t.clientWidth >= innerWidth * 0.55) { innerEl = t; return t; }
    return null; // small nested scroller: not synced
  };

  let scrollRaf = 0;
  let pendingEl = null;
  // The last position this script wrote on behalf of the simulator. A scroll event that lands on that
  // exact position shortly afterwards is our own echo, so it is not reported. This is what stops two
  // frames from endlessly updating each other.
  let lastRemote = null; // { x, y, el, t }
  const isEcho = (el, x, y) =>
    lastRemote && lastRemote.el === el && performance.now() - lastRemote.t < 900 &&
    Math.abs(lastRemote.y - y) < 2 && Math.abs(lastRemote.x - x) < 2;

  const readPos = (e) => {
    const isDoc = e === document.scrollingElement || e === document.documentElement || (e === document.body && e === docScroller());
    const y = Math.max(0, isDoc ? (window.scrollY || e.scrollTop || 0) : e.scrollTop);
    const x = Math.max(0, isDoc ? (window.scrollX || e.scrollLeft || 0) : e.scrollLeft);
    return { isDoc, x, y };
  };

  const reportScroll = (ev) => {
    const el = isMainTarget(ev && ev.target);
    if (!el) return;
    pendingEl = el;
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      const e = pendingEl || docScroller();
      const { isDoc, x, y } = readPos(e);
      if (isEcho(e, x, y)) return;
      const maxY = Math.max(1, e.scrollHeight - e.clientHeight);
      const maxX = Math.max(1, e.scrollWidth - e.clientWidth);
      try { parent.postMessage({ qpds: 'scroll', x, y, ratio: Math.min(1, y / maxY), ratioX: Math.min(1, x / maxX), inner: !isDoc }, '*'); } catch (_) {}
    });
  };
  addEventListener('scroll', reportScroll, { passive: true, capture: true });

  let lastActive = 0;
  const active = (e) => {
    if (e && e.isTrusted === false) return; // replayed events must never steal leadership
    const now = performance.now();
    if (now - lastActive < 120) return;
    lastActive = now;
    try { parent.postMessage({ qpds: 'active' }, '*'); } catch (_) {}
  };
  for (const ev of ['pointerdown', 'wheel', 'keydown', 'touchstart']) {
    addEventListener(ev, active, { capture: true, passive: true });
  }

  const applyRemoteScroll = (d) => {
    const main = mainScroller();
    const target = d.inner ? (findInner() || main.el) : main.el;
    const isDoc = target === docScroller() || target === document.documentElement;
    const maxY = Math.max(0, target.scrollHeight - target.clientHeight);
    const maxX = Math.max(0, target.scrollWidth - target.clientWidth);
    const px = d.mode === 'px';
    const top = Math.round(Math.min(maxY, Math.max(0, px ? d.y : (d.ratio || 0) * maxY)));
    const left = Math.round(Math.min(maxX, Math.max(0, px ? d.x : (d.ratioX || 0) * maxX)));
    const cur = readPos(target);
    if (Math.abs(cur.y - top) < 1 && Math.abs(cur.x - left) < 1) return; // already there
    const root = document.documentElement;
    const oldRoot = root.style.scrollBehavior, oldEl = target.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    target.style.scrollBehavior = 'auto';
    try {
      if (isDoc) window.scrollTo({ top, left, behavior: 'instant' });
      else target.scrollTo({ top, left, behavior: 'instant' });
    } catch (_) { target.scrollTop = top; target.scrollLeft = left; }
    // Remember where the browser actually ended up (it may clamp or round) to recognise the echo.
    const after = readPos(target);
    lastRemote = { el: target, x: after.x, y: after.y, t: performance.now() };
    root.style.scrollBehavior = oldRoot;
    target.style.scrollBehavior = oldEl;
  };


  /* ---------- click and input sync ----------
   * A real (trusted) click or text input in this frame is described by a DOM path and sent to the
   * simulator, which replays it in the other frames. Replayed events are untrusted, so they are never
   * reported again and never take over scroll leadership. */
  const INTERACTIVE = 'a,button,summary,label,[role="button"],[role="tab"],[role="menuitem"],[role="link"],[onclick],input[type="checkbox"],input[type="radio"],input[type="submit"],input[type="button"]';
  const SKIP_CLICK = 'input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]),textarea,select,video,audio,iframe';
  const cssEsc = (v) => (window.CSS && CSS.escape ? CSS.escape(v) : String(v).replace(/[^\w-]/g, '\\$&'));

  const pathOf = (el) => {
    const parts = [];
    for (; el && el.nodeType === 1 && el !== document.documentElement; el = el.parentElement) {
      if (el.id) {
        try {
          if (document.querySelectorAll('#' + cssEsc(el.id)).length === 1) { parts.unshift('#' + cssEsc(el.id)); break; }
        } catch (_) {}
      }
      const p = el.parentElement;
      if (!p) break;
      parts.unshift(el.tagName.toLowerCase() + ':nth-child(' + (Array.prototype.indexOf.call(p.children, el) + 1) + ')');
    }
    return parts.join(' > ');
  };
  const textOf = (el) => ((el.innerText || el.textContent || el.getAttribute('aria-label') || '') + '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const describe = (el) => ({ path: pathOf(el), tag: el.tagName.toLowerCase(), text: textOf(el), href: el.getAttribute && el.getAttribute('href') });

  const resolve = (d) => {
    let el = null;
    try { el = d.path ? document.querySelector(d.path) : null; } catch (_) {}
    if (el && el.tagName.toLowerCase() === d.tag) return el;
    // Layouts can differ per device, so fall back to the same tag with the same text or href.
    const cands = Array.prototype.slice.call(document.getElementsByTagName(d.tag));
    return cands.find((c) => (d.href && c.getAttribute('href') === d.href && textOf(c) === d.text)) ||
           cands.find((c) => d.text && textOf(c) === d.text) || null;
  };

  const sendSync = (msg) => { try { parent.postMessage(Object.assign({ qpds: 'sync' }, msg), '*'); } catch (_) {} };

  addEventListener('click', (e) => {
    if (!e.isTrusted || performance.now() < noClickUntil) return;
    let t = e.target;
    if (!t || t.nodeType !== 1) return;
    if (t.closest && t.closest(SKIP_CLICK)) return;
    t = (t.closest && t.closest(INTERACTIVE)) || t;
    sendSync({ kind: 'click', target: describe(t) });
  }, { capture: true, passive: true });

  addEventListener('input', (e) => {
    if (!e.isTrusted) return;
    const t = e.target;
    if (!t || !/^(INPUT|TEXTAREA)$/.test(t.tagName) || /^(file|password)$/i.test(t.type)) return;
    if (t.type === 'checkbox' || t.type === 'radio') return; // handled by the click replay
    sendSync({ kind: 'input', target: describe(t), value: t.value });
  }, { capture: true, passive: true });

  /* Replays must not open extra tabs or windows. Only the frame the user clicked opens the real one. */
  let replaying = false;
  const nativeOpen = window.open;
  try { window.open = function () { return replaying ? null : nativeOpen.apply(this, arguments); }; } catch (_) {}
  const opensElsewhere = (el) => {
    const a = el.closest && el.closest('a[href], area[href]');
    if (!a) return false;
    const target = (a.getAttribute('target') || '').toLowerCase();
    if (target && !/^_(self|top|parent)$/.test(target)) return true; // _blank, named windows
    const href = (a.getAttribute('href') || '').trim();
    return /^[a-z][a-z0-9+.-]*:/i.test(href) && !/^https?:/i.test(href); // mailto:, tel:, whatsapp:, ...
  };

  const replayClick = (d) => {
    const el = resolve(d.target);
    if (!el || opensElsewhere(el)) return;
    replaying = true;
    try { replayClickOn(el); } finally { replaying = false; }
  };
  const replayClickOn = (el) => {
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, composed: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
    try { el.dispatchEvent(new PointerEvent('pointerdown', Object.assign({ pointerType: cfg.touch ? 'touch' : 'mouse', isPrimary: true }, o))); } catch (_) {}
    el.dispatchEvent(new MouseEvent('mousedown', o));
    try { el.dispatchEvent(new PointerEvent('pointerup', Object.assign({ pointerType: cfg.touch ? 'touch' : 'mouse', isPrimary: true }, o))); } catch (_) {}
    el.dispatchEvent(new MouseEvent('mouseup', o));
    el.dispatchEvent(new MouseEvent('click', o)); // activates links, buttons, checkboxes, summaries, ...
  };
  const replayInput = (d) => {
    const el = resolve(d.target);
    if (!el || el.value === d.value) return;
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value');
    if (setter && setter.set) setter.set.call(el, d.value); else el.value = d.value; // works with React-style controlled inputs
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  addEventListener('message', (e) => {
    if (e.source !== parent) return;
    const d = e.data;
    if (!d) return;
    if (d.qpds === 'cfg') {
      Object.assign(cfg, d.cfg);
      applyStyles();
      try { window.dispatchEvent(new Event('orientationchange')); } catch (_) {}
    } else if (d.qpds === 'scrollto') {
      applyRemoteScroll(d);
    } else if (d.qpds === 'replay') {
      try { if (d.kind === 'click') replayClick(d); else if (d.kind === 'input') replayInput(d); } catch (_) {}
    }
  });
  } // start
})();
