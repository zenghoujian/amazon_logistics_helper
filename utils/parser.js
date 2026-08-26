(function () {
  if (window.AmazonLogisticsParser) return;

  const COUNTRIES = Array.isArray(window.AMAZON_COUNTRIES) ? window.AMAZON_COUNTRIES : [];
  const US_STATES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
    'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV',
    'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN',
    'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR'
  ];
  const CA_PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];
  const REGION_PATTERN = [...US_STATES, ...CA_PROVINCES].join('|');

  function cleanText(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[\t\r]+/g, ' ')
      .replace(/[ ]{2,}/g, ' ')
      .replace(/\n[ ]+/g, '\n')
      .replace(/[ ]+\n/g, '\n')
      .trim();
  }

  function cleanPhone(value) {
    const source = cleanText(value).replace(/^(?:buyer\s+)?(?:phone(?:\s+number)?|telephone|tel|mobile|电话|電話)\s*[:：]?\s*/i, '');
    const match = source.match(/(\+?\d[\d\s().\-/]{5,}\d)(?:\s*(?:ext(?:ension)?|x|分机)\.?\s*[:：]?\s*(\d{1,10}))?/i);
    if (!match) return '';
    const baseNumber = cleanText(match[1]);
    return match[2] ? `${baseNumber} ext. ${match[2]}` : baseNumber;
  }

  function splitAddressLines(text) {
    return String(text || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/\r/g, '\n')
      .split(/\n+/)
      .map(cleanText)
      .filter(Boolean);
  }

  function normalizeKey(value) {
    return cleanText(value).replace(/[.]/g, '').toLowerCase();
  }

  function normalizeCountry(rawCountry) {
    const raw = cleanText(rawCountry);
    const key = normalizeKey(raw);
    const found = COUNTRIES.find(country =>
      country.aliases.some(alias => normalizeKey(alias) === key)
    );
    return found
      ? { raw, name: found.name, code: found.code, aliases: [...found.aliases] }
      : { raw, name: raw, code: '', aliases: raw ? [raw] : [] };
  }

  function isKnownCountry(value) {
    return Boolean(normalizeCountry(value).code);
  }

  function parseOrderIdFromText(text) {
    const match = String(text || '').match(/\b\d{3}-\d{7}-\d{7}\b/);
    return match ? match[0] : '';
  }

  function looksLikePhone(value) {
    const text = cleanText(value);
    if (!text || parseOrderIdFromText(text)) return false;
    const digits = (text.match(/\d/g) || []).length;
    return digits >= 7 && digits <= 22 && /^(?:(?:buyer\s+)?(?:phone(?:\s+number)?|telephone|tel|mobile|电话|電話)\s*[:：]?\s*)?[+\d][\d\s().\-/]*(?:\s*(?:ext(?:ension)?|x|分机)\.?\s*[:：]?\s*\d{1,10})?$/i.test(text);
  }

  function isNoiseLine(value) {
    const key = normalizeKey(value);
    return !key || [
      'shipping address', 'delivery address', 'ship to', 'recipient address', 'address',
      '配送地址', '送货地址', '收货地址', '收件地址', '地址',
      'residential address', 'commercial address', 'residential', 'commercial',
      '住宅地址', '商业地址', '住宅', 'address type', '地址类型'
    ].includes(key) ||
      /^(?:contact buyer|contact seller|联系买家|联系卖家|复制地址|copy address)/i.test(key) ||
      /^(?:address type|地址类型)\s*[:：]/i.test(key);
  }

  function normalizeCanadianPostal(value) {
    const compact = cleanText(value).toUpperCase().replace(/\s+/g, '');
    return compact.length === 6 ? `${compact.slice(0, 3)} ${compact.slice(3)}` : compact;
  }

  function parseCityStatePostal(line) {
    const text = cleanText(line).replace(/\s+,/g, ',');
    if (!text) return null;

    let match = text.match(new RegExp(`^(.+?)(?:,\\s*|\\s+)(?:(${REGION_PATTERN})|([A-Za-z][A-Za-z .'-]{2,}))\\s+([A-Z]\\d[A-Z][ -]?\\d[A-Z]\\d)$`, 'i'));
    if (match) {
      return {
        city: cleanText(match[1]).replace(/,$/, ''),
        state: cleanText(match[2] || match[3]).toUpperCase(),
        postalCode: normalizeCanadianPostal(match[4]),
        countryCodeHint: 'CA'
      };
    }

    match = text.match(new RegExp(`^(.+?)(?:,\\s*|\\s+)(?:(${REGION_PATTERN})|([A-Za-z][A-Za-z .'-]{2,}))\\s+(\\d{5}(?:-\\d{4})?)$`, 'i'));
    if (match) {
      return {
        city: cleanText(match[1]).replace(/,$/, ''),
        state: cleanText(match[2] || match[3]).toUpperCase(),
        postalCode: match[4],
        countryCodeHint: 'US'
      };
    }

    match = text.match(/^(.+?),\s*([A-Za-z][A-Za-z .'-]{1,})$/);
    if (match) {
      return {
        city: cleanText(match[1]),
        state: cleanText(match[2]).toUpperCase(),
        postalCode: '',
        countryCodeHint: ''
      };
    }

    return null;
  }

  function findLocation(lines) {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const single = parseCityStatePostal(lines[index]);
      if (single && (single.postalCode || single.state)) {
        return { ...single, indexes: [index] };
      }
      if (index > 0) {
        const combined = parseCityStatePostal(`${lines[index - 1]} ${lines[index]}`);
        if (combined?.postalCode) return { ...combined, indexes: [index - 1, index] };
      }
      if (index > 1) {
        const combined = parseCityStatePostal(`${lines[index - 2]}, ${lines[index - 1]} ${lines[index]}`);
        if (combined?.postalCode) return { ...combined, indexes: [index - 2, index - 1, index] };
      }
    }
    return null;
  }

  function uniqueLines(lines) {
    const seen = new Set();
    return lines.filter(line => {
      const key = normalizeKey(line);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function parseAddressBlock(addressText, explicitPhone = '', hints = {}) {
    const warnings = [];
    let phone = cleanPhone(explicitPhone || hints.phone || '');
    let lines = uniqueLines(splitAddressLines(addressText));

    lines = lines.filter(line => {
      if (isNoiseLine(line)) return false;
      if (looksLikePhone(line)) {
        if (!phone) phone = cleanPhone(line);
        return false;
      }
      return true;
    });

    let recipientName = cleanText(hints.recipientName || '');
    if (!recipientName && lines.length) recipientName = lines.shift();
    lines = lines.filter(line => normalizeKey(line) !== normalizeKey(recipientName));

    let countryRaw = cleanText(hints.countryRaw || '');
    if (!countryRaw) {
      const countryIndex = lines.length && isKnownCountry(lines[lines.length - 1])
        ? lines.length - 1
        : -1;
      if (countryIndex >= 0) countryRaw = lines.splice(countryIndex, 1)[0];
    } else {
      lines = lines.filter(line => normalizeKey(line) !== normalizeKey(countryRaw));
    }

    let country = normalizeCountry(countryRaw);
    const location = findLocation(lines);
    const city = cleanText(hints.city || location?.city || '');
    const state = cleanText(hints.state || location?.state || '');
    const postalCode = cleanText(hints.postalCode || location?.postalCode || '');

    if (!country.code && location?.countryCodeHint) {
      country = normalizeCountry(location.countryCodeHint);
      countryRaw = country.raw;
    }

    const locationIndexes = new Set(location?.indexes || []);
    const addressLine1 = uniqueLines(lines.filter((_, index) => !locationIndexes.has(index)))
      .filter(line => !isKnownCountry(line) && normalizeKey(line) !== normalizeKey(recipientName))
      .join(', ');

    if (!recipientName) warnings.push('收件人姓名缺失，需人工确认');
    if (!country.code) warnings.push('国家缺失或未识别，需人工确认');
    if (!state) warnings.push('州/省缺失，需人工确认');
    if (!city) warnings.push('城市缺失，需人工确认');
    if (!postalCode) warnings.push('邮编缺失，需人工确认');
    if (!addressLine1) warnings.push('详细地址缺失，需人工确认');
    if (!phone) warnings.push('电话缺失，需人工确认');

    return {
      recipientName,
      countryRaw,
      countryNormalized: country.name,
      countryName: country.name,
      countryCode: country.code,
      state,
      city,
      postalCode,
      addressLine1,
      phone,
      warnings,
      rawAddress: cleanText(addressText)
    };
  }

  window.AmazonLogisticsParser = {
    cleanText,
    cleanPhone,
    splitAddressLines,
    normalizeCountry,
    isKnownCountry,
    looksLikePhone,
    parseCityStatePostal,
    parseAddressBlock,
    parseOrderIdFromText
  };
})();
