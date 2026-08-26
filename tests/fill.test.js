const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class FakeEvent {
  constructor(type) {
    this.type = type;
  }
}

class FakeSelect {
  constructor(options) {
    this.options = options;
    this.disabled = false;
    this.type = 'select-one';
    this.events = [];
    this._value = '';
  }

  get value() {
    return this._value;
  }

  set value(value) {
    this._value = value;
  }

  dispatchEvent(event) {
    this.events.push(event.type);
  }
}

const context = vm.createContext({
  window: {},
  document: { activeElement: null },
  Event: FakeEvent,
  console
});
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, '..', 'utils/fill.js'), 'utf8'),
  context,
  { filename: 'utils/fill.js' }
);

const fill = context.window.AmazonLogisticsFill;
const select = new FakeSelect([
  { textContent: '请选择目的地', value: '', selected: false },
  { textContent: 'CA 加拿大 Canada', value: 'CA', selected: false },
  { textContent: 'US 美国 UNITED STATES', value: 'US', selected: false },
  { textContent: 'UM 美国本土外小岛屿', value: 'UM', selected: false }
]);

const usResult = fill.setSelectByCandidates(select, ['United States', 'US', 'USA', '美国']);
assert.equal(usResult.ok, true);
assert.equal(select.value, 'US');
assert.deepEqual(select.events, ['input', 'change', 'blur']);

select.events = [];
const canadaResult = fill.setSelectByCandidates(select, ['Canada', 'CA', '加拿大']);
assert.equal(canadaResult.ok, true);
assert.equal(select.value, 'CA');
assert.deepEqual(select.events, ['input', 'change', 'blur']);

console.log('fill tests passed');
