const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {} });
for (const file of ['config/selectors.js', 'utils/parser.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

const parser = context.window.AmazonLogisticsParser;

const us = parser.parseAddressBlock([
  'Sample Recipient',
  '123 Main Street',
  'Apt 4B',
  'Seattle, WA 98101',
  'United States',
  'Phone: +1 206 555 0100'
].join('\n'));
assert.equal(us.recipientName, 'Sample Recipient');
assert.equal(us.countryNormalized, 'United States');
assert.equal(us.countryCode, 'US');
assert.equal(us.state, 'WA');
assert.equal(us.city, 'Seattle');
assert.equal(us.postalCode, '98101');
assert.equal(us.addressLine1, '123 Main Street, Apt 4B');
assert.equal(us.phone, '+1 206 555 0100');

const canada = parser.parseAddressBlock([
  'Sample Recipient',
  '88 King Street West',
  'Unit 1203',
  'Toronto, ON M5V 3A8',
  'Canada'
].join('\n'), '+1 (416) 555-0100');
assert.equal(canada.countryNormalized, 'Canada');
assert.equal(canada.countryCode, 'CA');
assert.equal(canada.state, 'ON');
assert.equal(canada.city, 'Toronto');
assert.equal(canada.postalCode, 'M5V 3A8');
assert.equal(canada.addressLine1, '88 King Street West, Unit 1203');

const splitCanada = parser.parseAddressBlock([
  'Sample Recipient',
  '500 Example Avenue',
  'Vancouver, BC',
  'V6B 1A1',
  '加拿大'
].join('\n'));
assert.equal(splitCanada.countryNormalized, 'Canada');
assert.equal(splitCanada.state, 'BC');
assert.equal(splitCanada.city, 'Vancouver');
assert.equal(splitCanada.postalCode, 'V6B 1A1');
assert.equal(splitCanada.addressLine1, '500 Example Avenue');

const missingState = parser.parseAddressBlock([
  'Sample Recipient',
  '1 Example Road',
  'Unknown City',
  'United States'
].join('\n'));
assert.equal(missingState.state, '');
assert.ok(missingState.warnings.some(item => item.includes('州/省缺失')));

const splitUs = parser.parseAddressBlock([
  'Sample Recipient',
  '200 Example Boulevard',
  'Los Angeles',
  'CA',
  '90001',
  'United States'
].join('\n'));
assert.equal(splitUs.countryCode, 'US');
assert.equal(splitUs.state, 'CA');
assert.equal(splitUs.city, 'Los Angeles');
assert.equal(splitUs.postalCode, '90001');
assert.equal(splitUs.addressLine1, '200 Example Boulevard');

const rochester = parser.parseAddressBlock([
  'Sample Recipient',
  '100 Example Street',
  'ROCHESTER, NY 14608-2644',
  'United States',
  'Phone: +1 480-555-0100 ext. 60388'
].join('\n'));
assert.equal(rochester.city, 'ROCHESTER');
assert.equal(rochester.state, 'NY');
assert.equal(rochester.postalCode, '14608-2644');
assert.equal(rochester.phone, '+1 480-555-0100 ext. 60388');
assert.ok(!rochester.warnings.some(item => item.includes('电话缺失')));

console.log('parser tests passed');
