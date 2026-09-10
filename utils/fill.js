(function () {
  if (window.AmazonLogisticsFill) return;

  function normalizeText(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[().,]/g, '')
      .toLowerCase();
  }

  function isUsableField(element) {
    return Boolean(element && !element.disabled && element.type !== 'hidden');
  }

  function firstMatch(selectors, root = document) {
    for (const selector of Array.isArray(selectors) ? selectors : [selectors]) {
      if (!selector) continue;
      try {
        const element = root.querySelector(selector);
        if (isUsableField(element)) return element;
      } catch (error) {
        console.warn('[订单搬运助手] 无效物流选择器:', selector, error);
      }
    }
    return null;
  }

  function allMatches(selectors, root = document) {
    const matches = [];
    const seen = new Set();
    for (const selector of Array.isArray(selectors) ? selectors : [selectors]) {
      if (!selector) continue;
      try {
        for (const element of root.querySelectorAll(selector)) {
          if (isUsableField(element) && !seen.has(element)) {
            seen.add(element);
            matches.push(element);
          }
        }
      } catch (error) {
        console.warn('[订单搬运助手] 无效物流选择器:', selector, error);
      }
    }
    return matches;
  }

  function dispatchValueEvents(element) {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    if (document.activeElement === element && typeof element.blur === 'function') element.blur();
    else element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function setNativeValue(element, value) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor?.set) descriptor.set.call(element, String(value ?? ''));
    else element.value = String(value ?? '');
  }

  function setInputValue(element, value) {
    if (!isUsableField(element)) return false;
    try { element.focus({ preventScroll: true }); } catch (_) { /* Keep compatibility with old forms. */ }
    setNativeValue(element, value);
    dispatchValueEvents(element);
    return String(element.value ?? '') === String(value ?? '');
  }

  function validOptions(selectElement) {
    return Array.from(selectElement.options || []).filter(option => {
      const label = normalizeText(option.textContent);
      if (!label) return false;
      return !(!normalizeText(option.value) && /请选择|please select|select destination/.test(label));
    });
  }

  function syncSelectWidget(selectElement, matchedText) {
    const id = String(selectElement.id || '');
    const containers = [
      id ? document.getElementById(`${id}_chosen`) : null,
      id ? document.getElementById(`s2id_${id}`) : null,
      selectElement.nextElementSibling
    ].filter(Boolean);
    let synced = false;

    for (const container of containers) {
      const label = container.matches?.('.chosen-single span, .select2-chosen, .select2-selection__rendered')
        ? container
        : container.querySelector?.('.chosen-single span, .select2-chosen, .select2-selection__rendered');
      if (!label) continue;
      label.textContent = matchedText;
      label.setAttribute('title', matchedText);
      synced = true;
    }
    return synced;
  }

  function setSelectByCandidates(selectElement, candidates) {
    const targets = (Array.isArray(candidates) ? candidates : [candidates])
      .map(value => normalizeText(value))
      .filter(Boolean);
    const options = validOptions(selectElement);
    let matched = null;

    // Match visible option text first, then option value.
    for (const target of targets) {
      matched = options.find(option => normalizeText(option.textContent) === target);
      if (matched) break;
    }
    if (!matched) {
      for (const target of targets) {
        matched = options.find(option => normalizeText(option.value) === target);
        if (matched) break;
      }
    }
    if (!matched) {
      for (const target of targets) {
        matched = options.find(option => {
          const label = normalizeText(option.textContent);
          const value = normalizeText(option.value);
          return label.startsWith(target) || value.startsWith(target);
        });
        if (matched) break;
      }
    }
    if (!matched) return { ok: false, matchedText: '', matchedValue: '' };

    setNativeValue(selectElement, matched.value);
    matched.selected = true;
    dispatchValueEvents(selectElement);

    if (window.jQuery) {
      window.jQuery(selectElement)
        .trigger('change')
        .trigger('chosen:updated')
        .trigger('liszt:updated');
    }

    const matchedText = String(matched.textContent || '').trim();
    const widgetSynced = syncSelectWidget(selectElement, matchedText);

    return {
      ok: String(selectElement.value) === String(matched.value),
      matchedText,
      matchedValue: matched.value,
      widgetSynced
    };
  }

  function choosePrimaryPhone(elements) {
    if (!elements.length) return null;
    return [...elements].sort((left, right) => {
      const score = element => {
        const identity = `${element.id} ${element.name}`.toLowerCase();
        let value = 0;
        if (/telephone|phone|tel/.test(identity)) value += 20;
        if (/mobile|cell/.test(identity)) value -= 10;
        if (element.offsetParent !== null) value += 5;
        return value;
      };
      return score(right) - score(left) ||
        left.getBoundingClientRect().left - right.getBoundingClientRect().left;
    })[0];
  }

  function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  async function retryFind(selectors, attempts = 5, delay = 250) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const element = firstMatch(selectors);
      if (element) return element;
      if (attempt < attempts - 1) await sleep(delay);
    }
    return null;
  }

  async function retrySelectByCandidates(selectElement, candidates, attempts = 8, delay = 250) {
    let result = { ok: false, matchedText: '', matchedValue: '', widgetSynced: false };
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      result = setSelectByCandidates(selectElement, candidates);
      if (result.ok) return result;
      if (attempt < attempts - 1) await sleep(delay);
    }
    return result;
  }

  window.AmazonLogisticsFill = {
    normalizeText,
    firstMatch,
    allMatches,
    setInputValue,
    setSelectByCandidates,
    retrySelectByCandidates,
    syncSelectWidget,
    choosePrimaryPhone,
    retryFind
  };
})();
