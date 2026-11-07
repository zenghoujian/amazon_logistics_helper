// content_amazon.js
(function () {
  if (window.__AMAZON_ORDER_HELPER_LOADED__) return;
  window.__AMAZON_ORDER_HELPER_LOADED__ = true;

  const Parser = window.AmazonLogisticsParser;

  function getSelectors() {
    return (window.AMAZON_SELECTORS && typeof window.AMAZON_SELECTORS === 'object')
      ? window.AMAZON_SELECTORS
      : {
        orderNumber: ['span[data-testid="order-id-value"]'],
        addressContainer: [
          '[data-testid="shipping-address"]',
          '[data-testid="shipping-address-section"]',
          '[data-testid*="shipping-address"]',
          '[data-testid*="address"]'
        ],
        phone: [
          'a[href^="tel:"]',
          '[data-testid="buyer-phone"]',
          '[data-testid*="phone"]'
        ],
        recipientName: [
          '[data-testid="shipping-address"] .a-text-bold',
          '[data-testid="shipping-address-section"] .a-text-bold',
          '[data-testid*="shipping-address"] .a-text-bold'
        ]
      };
  }

  function firstMatch(selectors, root = document) {
    if (!selectors) return null;
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const sel of list) {
      try {
        const el = root.querySelector(sel);
        if (el) return el;
      } catch (e) {
        console.warn('[Amazon插件] 无效选择器:', sel, e);
      }
    }
    return null;
  }

  function cleanText(text) {
    return String(text || '')
      .replace(/\u00A0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n\s+/g, '\n')
      .trim();
  }

  function splitLines(text) {
    return String(text || '')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(s => cleanText(s))
      .filter(Boolean);
  }

  function uniqLines(lines) {
    const out = [];
    const seen = new Set();
    for (const line of lines) {
      const key = cleanText(line).toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(cleanText(line));
    }
    return out;
  }

  function parseOrderIdFromText(text) {
    const m = String(text || '').match(/\b\d{3}-\d{7}-\d{7}\b/);
    return m ? m[0] : '';
  }

  function isOrderIdLike(text) {
    return /\b\d{3}-\d{7}-\d{7}\b/.test(String(text || ''));
  }

  function getElementTextWithBreaks(el) {
    if (!el) return '';
    const raw = el.innerText || el.textContent || '';
    return String(raw || '').replace(/\r/g, '\n').trim();
  }

  function extractOrderId(S) {
    const el = firstMatch(S.orderNumber);
    if (el) {
      const txt = cleanText(el.innerText || el.textContent);
      const parsed = parseOrderIdFromText(txt);
      if (parsed) return parsed;
    }
    return parseOrderIdFromText(cleanText(document.body?.innerText || ''));
  }

  function findAddressSectionByHeading() {
    const all = Array.from(document.querySelectorAll('div, section, span, h2, h3, h4, p'));

    const heading = all.find(el => {
      const t = cleanText(el.innerText || el.textContent);
      return /^(?:配送地址|送货地址|收货地址|shipping address|delivery address|ship to)$/i.test(t);
    });

    if (!heading) return null;

    let node = heading;
    for (let i = 0; i < 5 && node; i++) {
      node = node.parentElement;
      if (!node) break;
      const txt = getElementTextWithBreaks(node);
      if (splitLines(txt).length >= 3) return node;
    }

    return heading.parentElement || null;
  }

  function findAddressContainer(S) {
    const direct = firstMatch(S.addressContainer);
    if (direct) return direct;
    return findAddressSectionByHeading();
  }

  function normalizeCountry(rawCountry) {
    return Parser?.normalizeCountry(rawCountry) || { name: cleanText(rawCountry), code: '' };
  }

  function looksLikeCountry(line) {
    return Boolean(Parser?.isKnownCountry(line));
  }

  function looksLikePhone(text) {
    return Boolean(Parser?.looksLikePhone(text));
  }

  function extractPhone(S, rootEl, orderId) {
    const telEl = firstMatch(S.phone, rootEl || document) || firstMatch(S.phone);
    if (telEl) {
      const txt = cleanText(telEl.innerText || telEl.textContent);
      if (looksLikePhone(txt) && txt !== orderId) return txt;

      const href = telEl.getAttribute && telEl.getAttribute('href');
      if (href && /^tel:/i.test(href)) {
        const p = href.replace(/^tel:/i, '').trim();
        if (looksLikePhone(p) && p !== orderId) return p;
      }
    }

    const scope = rootEl || document.body;
    const scopeText = getElementTextWithBreaks(scope);
    const labeledPhone = Parser?.extractLabeledPhone(scopeText);
    if (labeledPhone && labeledPhone !== orderId) return labeledPhone;

    const lines = splitLines(scopeText);
    for (const line of lines) {
      const cleaned = cleanText(line.replace(/^电话[:：]?\s*/i, ''));
      if (cleaned !== orderId && looksLikePhone(cleaned)) return cleaned;
    }
    return '';
  }

  function parseCityStatePostal(line) {
    return Parser?.parseCityStatePostal(line) || null;
  }

  function isContactNoise(line) {
    const t = cleanText(line).toLowerCase();
    return (
      t.includes('联系卖家') ||
      t.includes('联系买家') ||
      t.includes('contact buyer') ||
      t.includes('contact seller') ||
      t.startsWith('电话') ||
      t.startsWith('phone') ||
      t.includes('地址类型') ||
      t.includes('住宅') ||
      t.includes('residential')
    );
  }

  function stripNoiseFromAddress(text) {
    let v = cleanText(text);

    // 去掉 联系买家/联系卖家 及其后面的名字
    v = v.replace(/(?:联系买家|联系卖家|contact buyer|contact seller)\s*[:：]?\s*.+$/i, '');

    // 去掉 电话字段
    v = v.replace(/(?:电话|phone)\s*[:：]?\s*[\d()+\-\/\s]+/gi, '');

    // 去掉国家
    v = v.replace(/\b(?:Canada|加拿大|Germany|德国|France|法国|United Kingdom|UK|GB|英国|United States|USA|US|美国|Italy|意大利|Spain|西班牙)\b/gi, '');

    // 压缩多余空格
    v = cleanText(v.replace(/\s{2,}/g, ' '));
    return v;
  }

  function extractAddressBlock(S) {
    const container = findAddressContainer(S);
    const recipientEl = firstMatch(S.recipientName, container || document);
    const countryEl = firstMatch(S.country, container || document);
    const rawText = getElementTextWithBreaks(container);
    let lines = uniqLines(splitLines(rawText));

    let recipientName = recipientEl
      ? cleanText(recipientEl.innerText || recipientEl.textContent)
      : '';

    if (/^(?:配送地址|送货地址|收货地址|shipping address|delivery address|ship to)$/i.test(recipientName) ||
        recipientName.length > 100 || recipientName.includes('\n')) {
      recipientName = '';
    }

    lines = lines.filter(line => {
      const t = cleanText(line).toLowerCase();
      return t !== '配送地址' && t !== 'shipping address';
    });

    if (!recipientName && lines.length) recipientName = lines[0];

    return {
      container,
      rawText,
      lines,
      recipientName,
      countryRaw: countryEl ? cleanText(countryEl.innerText || countryEl.textContent) : ''
    };
  }

  function parseAddressInfo(addressInfo, phone) {
    return Parser.parseAddressBlock(addressInfo.rawText, phone, {
      recipientName: addressInfo.recipientName,
      countryRaw: addressInfo.countryRaw
    });
  }

  function extractAmazonOrder() {
    const S = getSelectors();

    if (!Parser) throw new Error('地址解析器未加载，请重新加载插件并刷新订单页');

    const orderId = extractOrderId(S);
    if (!orderId) throw new Error('未找到 Amazon 订单号元素');

    const addressInfo = extractAddressBlock(S);
    if (!addressInfo.container || !addressInfo.lines.length) {
      throw new Error('未找到 Amazon 地址容器');
    }
    const phone = extractPhone(S, addressInfo.container, orderId);
    const parsed = parseAddressInfo(addressInfo, phone);

    return {
      orderId,
      orderNumber: orderId,
      recipientName: parsed.recipientName || '',
      countryRaw: parsed.countryRaw || '',
      countryName: parsed.countryName || parsed.countryRaw || '',
      countryNormalized: parsed.countryNormalized || parsed.countryName || '',
      countryCode: parsed.countryCode || '',
      state: parsed.state || '',
      city: parsed.city || '',
      postalCode: parsed.postalCode || '',
      addressLine1: parsed.addressLine1 || '',
      phone: parsed.phone || '',
      warnings: parsed.warnings || []
    };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'EXTRACT_AMAZON_ORDER') return;

    try {
      const data = extractAmazonOrder();
      sendResponse({ ok: true, data });
    } catch (e) {
      console.error('[Amazon插件] 提取失败:', e);
      sendResponse({
        ok: false,
        error: e.message || '提取失败'
      });
    }

    return true;
  });
})();
