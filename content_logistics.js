(function () {
  if (window.__LOGISTICS_ORDER_HELPER_LOADED__) return;
  window.__LOGISTICS_ORDER_HELPER_LOADED__ = true;

  const PREFIX_KEY = 'order_prefix';
  const Fill = window.AmazonLogisticsFill;

  const DEFAULT_SELECTORS = {
    orderNumber: ['#order_customerinvoicecode'],
    country: ['#country'],
    recipientName: ['#consignee_name'],
    state: ['#consignee_state'],
    city: ['#consignee_city'],
    postcode: ['#consignee_postcode'],
    address: ['#consignee_address'],
    phone: ['#consignee_telephone'],
    mobile: ['input[name="orderParam.consignee_mobile"]']
  };

  function getSelectors() {
    const s = window.LOGISTICS_SELECTORS;
    if (s && typeof s === 'object' && Object.keys(s).length > 0) {
      return { ...DEFAULT_SELECTORS, ...s };
    }
    return DEFAULT_SELECTORS;
  }

  function firstMatch(selectors) {
    if (!selectors) return null;
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const sel of list) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch (e) {
        console.warn('[物流插件] 无效选择器:', sel, e);
      }
    }
    return null;
  }

  function triggerAll(el) {
    if (!el) return;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function setNativeValue(el, value) {
    const val = value ?? '';
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && typeof desc.set === 'function') {
      desc.set.call(el, val);
    } else {
      el.value = val;
    }
  }

  function setInputValue(el, value) {
    if (!el) return false;
    try { el.focus(); } catch (_) { }
    setNativeValue(el, value ?? '');
    triggerAll(el);
    return true;
  }

  function normalizeText(v) {
    return String(v || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[()]/g, '')
      .replace(/[.,]/g, '')
      .toLowerCase();
  }

  function buildCountryCandidates(data) {
    const aliases = {
      'united states': ['United States', 'US', 'USA', '美国'],
      'us': ['United States', 'US', 'USA', '美国'],
      'usa': ['United States', 'US', 'USA', '美国'],
      '美国': ['United States', 'US', 'USA', '美国'],

      'canada': ['Canada', 'CA', '加拿大'],
      'ca': ['Canada', 'CA', '加拿大'],
      '加拿大': ['Canada', 'CA', '加拿大'],

      'united kingdom': ['United Kingdom', 'GB', 'UK', '英国'],
      'gb': ['United Kingdom', 'GB', 'UK', '英国'],
      'uk': ['United Kingdom', 'GB', 'UK', '英国'],
      '英国': ['United Kingdom', 'GB', 'UK', '英国'],

      'france': ['France', 'FR', '法国'],
      'fr': ['France', 'FR', '法国'],
      '法国': ['France', 'FR', '法国'],

      'germany': ['Germany', 'DE', '德国'],
      'de': ['Germany', 'DE', '德国'],
      '德国': ['Germany', 'DE', '德国'],

      'italy': ['Italy', 'IT', '意大利'],
      'it': ['Italy', 'IT', '意大利'],
      '意大利': ['Italy', 'IT', '意大利'],

      'austria': ['Austria', 'AT', '奥地利'],
      'at': ['Austria', 'AT', '奥地利'],
      '奥地利': ['Austria', 'AT', '奥地利'],

      'switzerland': ['Switzerland', 'CH', '瑞士'],
      'ch': ['Switzerland', 'CH', '瑞士'],
      '瑞士': ['Switzerland', 'CH', '瑞士']
    };

    const rawList = [
      data.countryNormalized,
      data.countryName,
      data.countryCode,
      data.countryRaw
    ].filter(Boolean);

    const out = [];
    const seen = new Set();

    function push(v) {
      const s = String(v || '').trim();
      if (!s) return;
      const key = s.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(s);
    }

    for (const item of rawList) {
      push(item);
      const key = String(item).trim().toLowerCase();
      if (aliases[key]) aliases[key].forEach(push);
    }

    return out;
  }

  function updateChosen(selectEl, matchedText) {
    try {
      if (window.jQuery) {
        const $el = window.jQuery(selectEl);
        $el.trigger('change');
        $el.trigger('chosen:updated');
        $el.trigger('liszt:updated');
      }

      const container = selectEl.nextElementSibling;
      if (container && container.classList.contains('chosen-container')) {
        const span = container.querySelector('.chosen-single span, .chosen-choices');
        if (span && matchedText) {
          span.textContent = matchedText;
        }
      }
    } catch (e) {
      console.warn('[物流插件] 更新 chosen 失败:', e);
    }
  }

  function getValidOptions(selectEl) {
    return Array.from(selectEl.options || []).filter(opt => {
      const valueText = normalizeText(opt.value);
      const labelText = normalizeText(opt.textContent);
      if (!labelText) return false;
      if (!valueText && /请选择|select/i.test(labelText)) return false;
      return true;
    });
  }

  function setSelectByCandidates(selectEl, candidates) {
    if (!selectEl) return false;

    const values = Array.isArray(candidates) ? candidates : [candidates];
    const normalizedTargets = values
      .filter(Boolean)
      .map(normalizeText)
      .filter(Boolean);

    if (!normalizedTargets.length) return false;

    const options = getValidOptions(selectEl);
    let matched = null;

    for (const target of normalizedTargets) {
      matched = options.find(opt => {
        const valueText = normalizeText(opt.value);
        const labelText = normalizeText(opt.textContent);
        return valueText === target || labelText === target;
      });
      if (matched) break;
    }

    if (!matched) {
      for (const target of normalizedTargets) {
        matched = options.find(opt => {
          const valueText = normalizeText(opt.value);
          const labelText = normalizeText(opt.textContent);
          return valueText.startsWith(target) || labelText.startsWith(target);
        });
        if (matched) break;
      }
    }

    if (!matched) {
      for (const target of normalizedTargets) {
        matched = options.find(opt => {
          const valueText = normalizeText(opt.value);
          const labelText = normalizeText(opt.textContent);
          return valueText.includes(target) || labelText.includes(target);
        });
        if (matched) break;
      }
    }

    if (!matched) {
      console.warn('[物流插件] 国家下拉未匹配到', {
        candidates: values,
        normalizedTargets,
        options: options.map(o => ({
          value: (o.value || '').trim(),
          text: (o.textContent || '').trim()
        }))
      });
      return false;
    }

    Array.from(selectEl.options || []).forEach(opt => {
      opt.selected = false;
    });
    matched.selected = true;
    setNativeValue(selectEl, matched.value);
    triggerAll(selectEl);
    updateChosen(selectEl, (matched.textContent || '').trim());

    return normalizeText(selectEl.value) === normalizeText(matched.value);
  }

  async function getOrderPrefix() {
    const res = await chrome.storage.local.get([PREFIX_KEY]);
    return String(res[PREFIX_KEY] || '').trim();
  }

  async function buildPrefixedOrderNumber(data) {
    const rawOrderNo = String(data.orderNumber || data.orderId || '').trim();
    if (!rawOrderNo) return '';

    const prefix = await getOrderPrefix();
    if (!prefix) return rawOrderNo;

    if (rawOrderNo.startsWith(prefix)) return rawOrderNo;
    return `${prefix}${rawOrderNo}`;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'FILL_LOGISTICS_FORM') return;

    (async () => {
      if (!Fill) {
        sendResponse({
          ok: false,
          message: '物流填充工具未加载，请重新加载插件并刷新物流页面'
        });
        return;
      }

      const S = getSelectors();
      const data = message.data || {};
      const filled = [];
      const warnings = [];
      const missingElements = [];
      const skipped = [];
      const orderNumberEl = await Fill.retryFind(S.orderNumber);
      const finalOrderNumber = await buildPrefixedOrderNumber(data);

      if (!orderNumberEl) {
        sendResponse({
          ok: false,
          message: '未找到物流系统订单号输入框',
          report: { filled, warnings, missingElements: ['订单号'], skipped }
        });
        return;
      }

      if (!finalOrderNumber) {
        sendResponse({
          ok: false,
          message: '缓存中的 Amazon 订单号为空',
          report: { filled, warnings, missingElements, skipped: ['订单号'] }
        });
        return;
      }

      if (!Fill.setInputValue(orderNumberEl, finalOrderNumber)) {
        sendResponse({
          ok: false,
          message: '物流系统订单号填充值未生效',
          report: { filled, warnings, missingElements, skipped }
        });
        return;
      }
      filled.push('订单号');

      const fillTextField = (label, selectors, value) => {
        const cleaned = String(value || '').trim();
        if (!cleaned) {
          skipped.push(label);
          warnings.push(`${label}数据缺失，需人工确认`);
          return;
        }
        const element = Fill.firstMatch(selectors);
        if (!element) {
          missingElements.push(label);
          warnings.push(`未找到物流系统${label}输入框`);
          return;
        }
        if (Fill.setInputValue(element, cleaned)) filled.push(label);
        else warnings.push(`${label}填充值未生效`);
      };

      const countryCandidates = buildCountryCandidates(data);
      const countryEl = Fill.firstMatch(S.country);
      if (!countryCandidates.length) {
        skipped.push('目的地');
        warnings.push('国家数据缺失，需人工确认');
      } else if (!countryEl) {
        missingElements.push('目的地');
        warnings.push('未找到物流系统目的地字段');
      } else if (countryEl.tagName === 'SELECT') {
        const countryResult = Fill.setSelectByCandidates(countryEl, countryCandidates);
        if (countryResult.ok) filled.push('目的地');
        else warnings.push('目的地下拉框未匹配到国家');
      } else if (Fill.setInputValue(countryEl, countryCandidates[0])) {
        filled.push('目的地');
      } else {
        warnings.push('目的地填充值未生效');
      }

      fillTextField('收件人名', S.recipientName, data.recipientName);
      fillTextField('收件人州', S.state, data.state);
      fillTextField('收件城市', S.city, data.city);
      fillTextField('邮编', S.postcode, data.postalCode);
      fillTextField('收件地址', S.address, data.addressLine1 || data.address);

      const phone = String(data.phone || '').trim();
      if (!phone) {
        skipped.push('收件电话');
        warnings.push('电话缺失，需人工确认');
      } else {
        const phoneEl = Fill.choosePrimaryPhone(Fill.allMatches(S.phone));
        if (!phoneEl) {
          missingElements.push('收件电话');
          warnings.push('未找到物流系统收件电话输入框');
        } else if (Fill.setInputValue(phoneEl, phone)) {
          filled.push('收件电话');
        } else {
          warnings.push('收件电话填充值未生效');
        }
      }

      const messageText = warnings.length
        ? `物流系统已部分填充，${warnings.length} 项需人工确认`
        : '物流系统填充成功，请人工确认后手动提交';

      sendResponse({
        ok: true,
        message: messageText,
        report: { filled, warnings, missingElements, skipped }
      });
    })().catch(error => {
      console.error('[订单搬运助手] 物流填充失败:', error);
      sendResponse({ ok: false, message: error.message || '物流填充异常' });
    });

    return true;
  });
})();
