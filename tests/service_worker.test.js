const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({
  URL,
  chrome: {
    runtime: {
      onMessage: { addListener() {} }
    }
  }
});

vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, '..', 'service_worker.js'), 'utf8'),
  context,
  { filename: 'service_worker.js' }
);

const isLogisticsUrl = url => vm.runInContext(`isLogisticsUrl(${JSON.stringify(url)})`, context);

assert.equal(isLogisticsUrl('http://129.204.184.34:8082/gotoCreateOrder.htm'), true);
assert.equal(isLogisticsUrl('http://120.78.183.106:8082/gotoCreateOrder.htm'), true);
assert.equal(isLogisticsUrl('http://120.78.183.106:8083/gotoCreateOrder.htm'), false);
assert.equal(isLogisticsUrl('https://120.78.183.106:8082/gotoCreateOrder.htm'), false);
assert.equal(isLogisticsUrl('http://120.78.183.107:8082/gotoCreateOrder.htm'), false);

console.log('service worker URL tests passed');
