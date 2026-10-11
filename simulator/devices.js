/* Device library. Sizes are CSS pixel viewports in portrait.
 *   notch : island | notch | home | punch | none (bar)
 *   kind  : laptop | monitor | tv | hub (desktop types only) */
const DEVICES = [];
const add = (type, id, name, w, h, dpr, os, notch, extra) =>
  DEVICES.push(Object.assign({ id, name, type, w, h, dpr, os, notch, touch: type !== 'desktop' }, extra || {}));

/* ---- Apple phones ---- */
add('phone', 'iphone-5', 'iPhone 5', 320, 568, 2, 'ios', 'home');
add('phone', 'iphone-se-2016', 'iPhone SE 2016', 320, 568, 2, 'ios', 'home');
add('phone', 'iphone-se', 'iPhone SE (3rd gen)', 375, 667, 2, 'ios', 'home');
add('phone', 'iphone-x', 'iPhone X', 375, 812, 3, 'ios', 'notch');
add('phone', 'iphone-xr', 'iPhone XR', 414, 896, 2, 'ios', 'notch');
add('phone', 'iphone-11', 'iPhone 11', 414, 896, 2, 'ios', 'notch');
add('phone', 'iphone-11-pro', 'iPhone 11 PRO', 375, 812, 3, 'ios', 'notch');
add('phone', 'iphone-11-pro-max', 'iPhone 11 PRO MAX', 414, 896, 3, 'ios', 'notch');
add('phone', 'iphone-12-mini', 'iPhone 12 Mini', 375, 812, 3, 'ios', 'notch');
add('phone', 'iphone-12', 'iPhone 12', 390, 844, 3, 'ios', 'notch');
add('phone', 'iphone-12-pro', 'iPhone 12 PRO', 390, 844, 3, 'ios', 'notch');
add('phone', 'iphone-12-pro-max', 'iPhone 12 PRO MAX', 428, 926, 3, 'ios', 'notch');
add('phone', 'iphone-13-mini', 'iPhone 13 Mini', 375, 812, 3, 'ios', 'notch');
add('phone', 'iphone-13', 'iPhone 13', 390, 844, 3, 'ios', 'notch');
add('phone', 'iphone-13-pro', 'iPhone 13 PRO', 390, 844, 3, 'ios', 'notch');
add('phone', 'iphone-13-pro-max', 'iPhone 13 PRO MAX', 428, 926, 3, 'ios', 'notch');
add('phone', 'iphone-14', 'iPhone 14', 390, 844, 3, 'ios', 'notch');
add('phone', 'iphone-14-plus', 'iPhone 14 Plus', 428, 926, 3, 'ios', 'notch');
add('phone', 'iphone-14-pro', 'iPhone 14 PRO', 393, 852, 3, 'ios', 'island');
add('phone', 'iphone-14-pro-max', 'iPhone 14 PRO MAX', 430, 932, 3, 'ios', 'island');
add('phone', 'iphone-15', 'iPhone 15', 393, 852, 3, 'ios', 'island');
add('phone', 'iphone-15-plus', 'iPhone 15 Plus', 430, 932, 3, 'ios', 'island');
add('phone', 'iphone-15-pro', 'iPhone 15 PRO', 393, 852, 3, 'ios', 'island');
add('phone', 'iphone-15-pro-max', 'iPhone 15 PRO MAX', 430, 932, 3, 'ios', 'island');
add('phone', 'iphone-16', 'iPhone 16', 393, 852, 3, 'ios', 'island');
add('phone', 'iphone-16-plus', 'iPhone 16 Plus', 430, 932, 3, 'ios', 'island');
add('phone', 'iphone-16-pro', 'iPhone 16 PRO', 402, 874, 3, 'ios', 'island');
add('phone', 'iphone-16-pro-max', 'iPhone 16 PRO MAX', 440, 956, 3, 'ios', 'island');
add('phone', 'iphone-17', 'iPhone 17', 402, 874, 3, 'ios', 'island', { isNew: true });
add('phone', 'iphone-air', 'iPhone Air', 420, 912, 3, 'ios', 'island', { isNew: true });
add('phone', 'iphone-17-pro', 'iPhone 17 PRO', 402, 874, 3, 'ios', 'island', { isNew: true });
add('phone', 'iphone-17-pro-max', 'iPhone 17 PRO MAX', 440, 956, 3, 'ios', 'island', { isNew: true });

/* ---- Android phones ---- */
add('phone', 'galaxy-s20', 'Samsung Galaxy S20', 360, 800, 4, 'android', 'punch');
add('phone', 'galaxy-s21-ultra', 'Galaxy S21 Ultra', 384, 854, 3.75, 'android', 'punch');
add('phone', 'galaxy-s22', 'Galaxy S22', 360, 780, 3, 'android', 'punch');
add('phone', 'galaxy-s22-plus', 'Galaxy S22+', 384, 832, 2.8125, 'android', 'punch');
add('phone', 'galaxy-s22-ultra', 'Galaxy S22 ULTRA', 384, 824, 3.75, 'android', 'punch');
add('phone', 'galaxy-s23', 'Galaxy S23', 360, 780, 3, 'android', 'punch');
add('phone', 'galaxy-s24', 'Samsung Galaxy S24', 360, 780, 3, 'android', 'punch');
add('phone', 'galaxy-s24-ultra', 'Galaxy S24 ULTRA', 384, 824, 3.75, 'android', 'punch');
add('phone', 'galaxy-s25', 'Galaxy S25', 360, 780, 3, 'android', 'punch', { isNew: true });
add('phone', 'galaxy-s25-fe', 'Samsung Galaxy S25 FE', 384, 854, 3, 'android', 'punch', { isNew: true });
add('phone', 'galaxy-s25-ultra', 'Galaxy S25 ULTRA', 384, 824, 3.75, 'android', 'punch', { isNew: true });
add('phone', 'galaxy-note20-ultra', 'Galaxy Note20 Ultra', 412, 915, 3.5, 'android', 'punch');
add('phone', 'galaxy-a12', 'Galaxy A12', 360, 800, 2, 'android', 'punch');
add('phone', 'galaxy-a54', 'Galaxy A54', 412, 915, 2.625, 'android', 'punch');
add('phone', 'galaxy-a72', 'Samsung Galaxy A72', 412, 915, 2.625, 'android', 'punch');
add('phone', 'galaxy-z-flip3', 'Galaxy Z Flip3', 360, 880, 3, 'android', 'punch', { fold: 'h' });
add('phone', 'galaxy-z-flip5', 'Galaxy Z Flip5', 412, 914, 2.625, 'android', 'punch', { fold: 'h' });
add('phone', 'galaxy-z-fold-cover', 'Galaxy Z Fold5 (cover)', 344, 882, 3, 'android', 'punch');
add('phone', 'galaxy-z-fold-open', 'Galaxy Z Fold5 (open)', 673, 841, 2.625, 'android', 'punch', { fold: 'v' });
add('phone', 'pixel-5', 'Google Pixel 5', 393, 851, 2.75, 'android', 'punch');
add('phone', 'pixel-6-pro', 'Google Pixel 6 PRO', 412, 892, 3.5, 'android', 'punch');
add('phone', 'pixel-7', 'Google Pixel 7', 412, 915, 2.625, 'android', 'punch');
add('phone', 'pixel-8', 'Google Pixel 8', 412, 915, 2.625, 'android', 'punch');
add('phone', 'pixel-9', 'Google Pixel 9', 412, 915, 2.625, 'android', 'punch', { isNew: true });
add('phone', 'pixel-9-pro-xl', 'Pixel 9 PRO XL', 448, 998, 2.75, 'android', 'punch', { isNew: true });
add('phone', 'oneplus-nord-2', 'Oneplus Nord 2', 412, 915, 2.625, 'android', 'punch');
add('phone', 'oneplus-12', 'OnePlus 12', 412, 915, 3.5, 'android', 'punch');
add('phone', 'oppo-find-x3-pro', 'OPPO Find X3 PRO', 360, 800, 4, 'android', 'punch');
add('phone', 'xiaomi-12', 'Xiaomi 12', 393, 873, 2.75, 'android', 'punch');
add('phone', 'xiaomi-mi-11i', 'Xiaomi Mi 11i', 393, 873, 2.75, 'android', 'punch');
add('phone', 'huawei-p30-pro', 'Huawei P30 PRO', 360, 780, 3, 'android', 'punch');
add('phone', 'galaxy-s8', 'Galaxy S8', 360, 740, 4, 'android', 'none');

/* ---- Tablets ---- */
add('tablet', 'ipad-mini', 'iPad Mini', 744, 1133, 2, 'ios', 'none');
add('tablet', 'ipad-air-4', 'iPad Air 4', 820, 1180, 2, 'ios', 'none');
add('tablet', 'ipad', 'iPad (10th gen)', 820, 1180, 2, 'ios', 'none');
add('tablet', 'ipad-pro-11', 'iPad PRO 11', 834, 1194, 2, 'ios', 'none');
add('tablet', 'ipad-pro-12', 'iPad PRO 12.9', 1024, 1366, 2, 'ios', 'none');
add('tablet', 'ipad-pro-13', 'iPad PRO 13 (M4)', 1032, 1376, 2, 'ios', 'none', { isNew: true });
add('tablet', 'galaxy-tab-s7', 'Galaxy Tab S7', 800, 1280, 2, 'android', 'none');
add('tablet', 'galaxy-tab-s9', 'Galaxy Tab S9', 800, 1280, 2, 'android', 'none');
add('tablet', 'surface-pro', 'Surface Pro 7', 912, 1368, 2, 'win', 'none', { touch: true });

/* ---- Specials: watches, laptops, monitors, displays ---- */
add('watch', 'apple-watch-6', 'Apple Watch Serie 6', 184, 224, 2, 'ios', 'none');
add('watch', 'apple-watch-ultra', 'Apple Watch Ultra', 205, 251, 2, 'ios', 'none');
add('watch', 'apple-watch-10-46', 'Apple Watch Series 10 (46mm)', 208, 248, 2, 'ios', 'none', { isNew: true });
add('desktop', 'macbook-air', 'MacBook Air', 1440, 900, 2, 'mac', 'none', { kind: 'laptop', chin: 'MacBook Air' });
add('desktop', 'macbook-pro-14', 'Macbook PRO 14', 1512, 982, 2, 'mac', 'none', { kind: 'laptop', chin: 'MacBook Pro' });
add('desktop', 'macbook-pro-16', 'Macbook PRO 16', 1728, 1117, 2, 'mac', 'none', { kind: 'laptop', chin: 'MacBook Pro' });
add('desktop', 'dell-latitude', 'Dell Latitude', 1366, 768, 1, 'win', 'none', { kind: 'laptop' });
add('desktop', 'imac-24', 'Apple iMac 24"', 2240, 1260, 2, 'mac', 'none', { kind: 'monitor' });
add('desktop', 'desktop-fhd', 'Desktop Full HD', 1920, 1080, 1, 'win', 'none', { kind: 'monitor' });
add('desktop', 'samsung-tv', 'Samsung Smart TV', 1920, 1080, 1, 'win', 'none', { kind: 'tv' });
add('desktop', 'nest-hub', 'Nest Hub', 1024, 600, 2, 'android', 'none', { kind: 'hub', touch: true });
add('desktop', 'nest-hub-max', 'Nest Hub Max', 1280, 800, 2, 'android', 'none', { kind: 'hub', touch: true });

const CHROME_VER = '138.0.0.0';

function uaFor(d) {
  switch (d.os) {
    case 'ios':
      if (d.type === 'tablet') {
        return 'Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
      }
      return 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
    case 'android': {
      const mobile = d.type === 'phone' || d.type === 'watch' ? 'Mobile ' : '';
      const model = d.type === 'tablet' ? 'SM-X710' : d.type === 'desktop' ? 'Nest Hub' : 'Pixel 9';
      return `Mozilla/5.0 (Linux; Android 15; ${model}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VER} ${mobile}Safari/537.36`;
    }
    case 'mac':
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VER} Safari/537.36`;
    default:
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VER} Safari/537.36`;
  }
}

function platformFor(d) {
  if (d.os === 'ios') return d.type === 'tablet' ? 'iPad' : 'iPhone';
  if (d.os === 'android') return 'Linux armv81';
  if (d.os === 'mac') return 'MacIntel';
  return 'Win32';
}

/* Frame style used for rendering. */
function kindOf(d) {
  if (d.type === 'phone') return d.notch === 'none' ? 'bar' : d.notch;
  if (d.type === 'tablet') return 'tablet';
  if (d.type === 'watch') return 'watch';
  return d.kind || 'monitor';
}
