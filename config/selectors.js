// Confirmed selectors are first. Later entries are conservative DOM fallbacks.
window.AMAZON_SELECTORS = {
  orderNumber: [
    // Confirmed on Seller Central orders-v3.
    'span[data-testid="order-id-value"]',
    '[data-testid="order-id"]',
    '[data-testid*="order-id-value"]'
  ],
  addressContainer: [
    '[data-testid="shipping-address"]',
    '[data-testid="shipping-address-section"]',
    '[data-testid="shipping-address-card"]',
    '[data-testid="delivery-address"]',
    '[data-testid*="shipping-address"]',
    '[data-testid*="delivery-address"]',
    '[data-testid*="shipping" i][data-testid*="address" i]',
    '[data-testid*="delivery" i][data-testid*="address" i]',
    '[id*="shipping-address" i]',
    '.shipping-address'
  ],
  recipientName: [
    '[data-testid="shipping-address-name"]',
    '[data-testid="recipient-name"]',
    '[data-testid*="shipping-address"] [data-testid*="name"]',
    '.a-text-bold'
  ],
  country: [
    '[data-testid="shipping-address-country"]',
    '[data-testid="address-country"]',
    '[data-testid*="address"] [data-testid*="country"]'
  ],
  phone: [
    '[data-testid="shipping-address-phone"]',
    '[data-testid="buyer-phone"]',
    '[data-testid*="phone"]',
    'a[href^="tel:"]'
  ]
};

window.LOGISTICS_SELECTORS = {
  orderNumber: [
    // Confirmed logistics order-number field.
    '#order_customerinvoicecode',
    'input[name="orderParam.order_customerinvoicecode"]'
  ],
  country: [
    '#country',
    '#order_countrycode',
    '#consignee_country',
    'select[name="orderParam.order_countrycode"]',
    'select[name="orderParam.consignee_country"]',
    'select[name*="countrycode" i]'
  ],
  recipientName: [
    '#consignee_name',
    '#order_cname',
    'input[name="orderParam.consignee_name"]',
    'input[name="orderParam.order_cname"]',
    'input[name*="consignee_name" i]'
  ],
  state: [
    '#consignee_state',
    '#order_cstate',
    'input[name="orderParam.consignee_state"]',
    'input[name="orderParam.order_cstate"]',
    'input[name*="consignee_state" i]'
  ],
  city: [
    '#consignee_city',
    '#order_ccity',
    'input[name="orderParam.consignee_city"]',
    'input[name="orderParam.order_ccity"]',
    'input[name*="consignee_city" i]'
  ],
  address: [
    '#consignee_address',
    '#order_caddress',
    'input[name="orderParam.consignee_address"]',
    'textarea[name="orderParam.consignee_address"]',
    'input[name="orderParam.order_caddress"]',
    'textarea[name="orderParam.order_caddress"]'
  ],
  phone: [
    '#consignee_telephone',
    '#order_ctel',
    'input[name="orderParam.consignee_telephone"]',
    'input[name="orderParam.order_ctel"]',
    'input[name*="consignee_telephone" i]',
    'input[name*="consignee_phone" i]'
  ],
  mobile: [
    '#consignee_mobile',
    'input[name="orderParam.consignee_mobile"]',
    'input[name*="consignee_mobile" i]'
  ],
  postcode: [
    '#consignee_postcode',
    '#order_cpostcode',
    'input[name="orderParam.consignee_postcode"]',
    'input[name="orderParam.order_cpostcode"]',
    'input[name*="postcode" i]'
  ]
};

window.AMAZON_COUNTRIES = [
  { name: 'United States', code: 'US', aliases: ['United States', 'United States of America', 'USA', 'US', '美国', '美國'] },
  { name: 'Canada', code: 'CA', aliases: ['Canada', 'CA', '加拿大'] },
  { name: 'Germany', code: 'DE', aliases: ['Germany', 'Deutschland', 'DE', '德国', '德國'] },
  { name: 'France', code: 'FR', aliases: ['France', 'FR', '法国', '法國'] },
  { name: 'United Kingdom', code: 'GB', aliases: ['United Kingdom', 'Great Britain', 'UK', 'GB', '英国', '英國'] },
  { name: 'Italy', code: 'IT', aliases: ['Italy', 'Italia', 'IT', '意大利'] },
  { name: 'Spain', code: 'ES', aliases: ['Spain', 'España', 'ES', '西班牙'] }
];
