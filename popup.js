const PREFIX_KEY = 'order_prefix';

async function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

async function getLocal(keys) {
  return chrome.storage.local.get(keys);
}

async function setLocal(data) {
  return chrome.storage.local.set(data);
}

function setStatus(text, level = 'info') {
  const el = document.getElementById('status');
  el.textContent = `状态：${text}`;
  el.className = `status status-${level}`;
}

function safeSet(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '';
}

function renderPreview(data) {
  const empty = document.getElementById('previewEmpty');
  const table = document.getElementById('previewTable');

  if (!data) {
    empty.classList.remove('hidden');
    table.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  table.classList.remove('hidden');

  safeSet('vOrderId', data.orderId || '');
  safeSet('vCountry', [data.countryName, data.countryCode].filter(Boolean).join(' / ') || data.countryRaw || '');
  safeSet('vRecipient', data.recipientName || '');
  safeSet('vState', data.state || '');
  safeSet('vCity', data.city || '');
  safeSet('vPostalCode', data.postalCode || '');
  safeSet('vAddress', data.addressLine1 || '');
  safeSet('vPhone', data.phone || '');
  safeSet('vWarnings', (data.warnings || []).join('；') || '无');
}

function renderLogs(logs) {
  const container = document.getElementById('logs');
  container.replaceChildren();
  if (!logs || !logs.length) {
    const empty = document.createElement('div');
    empty.className = 'log-item';
    empty.textContent = '暂无日志';
    container.appendChild(empty);
    return;
  }

  for (const log of logs.slice(0, 20)) {
    const item = document.createElement('div');
    const time = document.createElement('span');
    const message = document.createElement('span');
    item.className = `log-item log-${log.level || 'info'}`;
    time.className = 'log-time';
    time.textContent = new Date(log.time).toLocaleString();
    message.textContent = String(log.message || '');
    item.append(time, message);
    container.appendChild(item);
  }
}

async function loadPrefix() {
  const res = await getLocal([PREFIX_KEY]);
  const input = document.getElementById('orderPrefix');
  input.value = res[PREFIX_KEY] || '';
}

async function savePrefix() {
  const input = document.getElementById('orderPrefix');
  const prefix = String(input.value || '');
  await setLocal({ [PREFIX_KEY]: prefix });
  setStatus('订单号前缀已保存', 'success');
}

async function refresh() {
  try {
    const res = await sendMessage({ type: 'GET_CURRENT_ORDER_DATA' });
    if (!res?.ok) throw new Error(res?.error || '读取扩展状态失败');
    renderPreview(res.data);
    renderLogs(res.logs || []);
    safeSet('cacheSummary', res.summary || '当前缓存为空');
    if (res.status?.message) setStatus(res.status.message, res.status.level || 'info');
  } catch (error) {
    setStatus(error.message || '扩展后台不可用，请重新加载插件', 'error');
  }
}

async function runAction(buttonId, busyText, message) {
  const button = document.getElementById(buttonId);
  button.disabled = true;
  setStatus(busyText, 'info');
  try {
    const response = await sendMessage(message);
    if (!response?.ok) throw new Error(response?.error || response?.message || '操作失败');
    setStatus(response.message || '操作成功', response.report?.warnings?.length ? 'warning' : 'success');
  } catch (error) {
    setStatus(error.message || '操作失败', 'error');
  } finally {
    button.disabled = false;
    await refresh();
  }
}

document.getElementById('btnExtract').addEventListener('click', () => {
  runAction('btnExtract', '正在读取 Amazon 订单...', { type: 'EXTRACT_FROM_ACTIVE_AMAZON' });
});

document.getElementById('btnFill').addEventListener('click', () => {
  runAction('btnFill', '正在填充物流系统...', { type: 'FILL_TO_LOGISTICS' });
});

document.getElementById('btnClear').addEventListener('click', async () => {
  await runAction('btnClear', '正在清空缓存...', { type: 'CLEAR_CURRENT_ORDER_DATA' });
});

document.getElementById('btnSavePrefix').addEventListener('click', async () => {
  try {
    await savePrefix();
  } catch (error) {
    setStatus(error.message || '前缀保存失败', 'error');
  }
});

Promise.all([loadPrefix(), refresh()]).catch(error => {
  setStatus(error.message || 'popup 初始化失败', 'error');
});
