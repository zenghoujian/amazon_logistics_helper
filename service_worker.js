const STORAGE_KEY = 'current_order_data';
const LOGS_KEY = 'order_helper_logs';
const STATUS_KEY = 'order_helper_status';
const AMAZON_HOSTS = new Set([
  'sellercentral.amazon.com',
  'sellercentral.amazon.ca',
  'sellercentral.amazon.com.mx',
  'sellercentral.amazon.com.au',
  'sellercentral.amazon.sg',
  'sellercentral.amazon.ae',
  'sellercentral.amazon.sa',
  'sellercentral.amazon.co.uk',
  'sellercentral.amazon.de',
  'sellercentral.amazon.fr',
  'sellercentral.amazon.it',
  'sellercentral.amazon.es',
  'sellercentral.amazon.nl',
  'sellercentral.amazon.se',
  'sellercentral.amazon.pl',
  'sellercentral.amazon.com.be'
]);
const AMAZON_ORDER_TAB_PATTERNS = [...AMAZON_HOSTS].map(
  hostname => `https://${hostname}/orders-v3/order/*`
);
const LOGISTICS_TAB_PATTERN = 'http://129.204.184.34:8082/*';

async function getStorage(keys) {
  return chrome.storage.local.get(keys);
}

async function setStorage(obj) {
  return chrome.storage.local.set(obj);
}

async function addLog(message, level = 'info') {
  const res = await getStorage([LOGS_KEY]);
  const logs = res[LOGS_KEY] || [];
  logs.unshift({
    time: Date.now(),
    level,
    message
  });
  await setStorage({ [LOGS_KEY]: logs.slice(0, 100) });
}

async function setStatus(message, level = 'info') {
  await setStorage({
    [STATUS_KEY]: { message, level, time: Date.now() }
  });
}

function parseUrl(url) {
  try {
    return new URL(url);
  } catch (_) {
    return null;
  }
}

function isAmazonUrl(url = '') {
  const parsed = parseUrl(url);
  return Boolean(
    parsed &&
    parsed.protocol === 'https:' &&
    AMAZON_HOSTS.has(parsed.hostname) &&
    /^\/orders-v3\/order\/\d{3}-\d{7}-\d{7}\/?$/i.test(parsed.pathname)
  );
}

function isLogisticsUrl(url = '') {
  const parsed = parseUrl(url);
  return Boolean(
    parsed &&
    parsed.protocol === 'http:' &&
    parsed.hostname === '129.204.184.34' &&
    parsed.port === '8082'
  );
}

function summarizeOrder(data) {
  if (!data) return '当前缓存为空';
  const fields = [
    ['国家', data.countryCode || data.countryNormalized || data.countryRaw],
    ['收件人', data.recipientName],
    ['州/省', data.state],
    ['城市', data.city],
    ['地址', data.addressLine1],
    ['电话', data.phone]
  ];
  const missing = fields.filter(([, value]) => !String(value || '').trim()).map(([label]) => label);
  const completeness = fields.length - missing.length;
  return `订单 ${data.orderNumber || data.orderId || '未知'}；国家 ${data.countryCode || '未知'}；完整字段 ${completeness}/${fields.length}` +
    (missing.length ? `；缺失：${missing.join('、')}` : '；核心字段齐全');
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  return tabs[0] || null;
}

async function getAmazonTab() {
  const tabs = await chrome.tabs.query({ url: AMAZON_ORDER_TAB_PATTERNS });
  return tabs.find(tab => isAmazonUrl(tab.url)) || null;
}

async function getLogisticsTab() {
  const tabs = await chrome.tabs.query({ url: LOGISTICS_TAB_PATTERN });
  return tabs.find(tab => isLogisticsUrl(tab.url)) || null;
}

async function sendToTab(tab, message, pageType) {
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    const noReceiver = /Receiving end does not exist|Could not establish connection/i.test(error.message || '');
    if (!noReceiver) throw error;

    const files = pageType === 'amazon'
      ? ['config/selectors.js', 'utils/parser.js', 'content_amazon.js']
      : ['config/selectors.js', 'utils/fill.js', 'content_logistics.js'];
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files });
    return chrome.tabs.sendMessage(tab.id, message);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === 'GET_CURRENT_ORDER_DATA') {
        const res = await getStorage([STORAGE_KEY, LOGS_KEY, STATUS_KEY]);
        sendResponse({
          ok: true,
          data: res[STORAGE_KEY] || null,
          logs: res[LOGS_KEY] || [],
          status: res[STATUS_KEY] || null,
          summary: summarizeOrder(res[STORAGE_KEY] || null)
        });
        return;
      }

      if (message?.type === 'CLEAR_CURRENT_ORDER_DATA') {
        await setStorage({
          [STORAGE_KEY]: null
        });
        await addLog('已清空当前缓存', 'info');
        await setStatus('缓存已清空', 'info');
        sendResponse({ ok: true, summary: '当前缓存为空' });
        return;
      }

      if (message?.type === 'EXTRACT_FROM_ACTIVE_AMAZON') {
        const activeTab = await getActiveTab();
        const amazonTab = activeTab && isAmazonUrl(activeTab.url)
          ? activeTab
          : await getAmazonTab();

        if (!amazonTab) {
          await addLog('提取失败：未找到亚马逊订单详情页标签页', 'error');
          await setStatus('读取失败：未找到 Amazon 订单详情页', 'error');
          sendResponse({
            ok: false,
            error: '未找到亚马逊订单详情页标签页'
          });
          return;
        }

        let extractRes;
        try {
          extractRes = await sendToTab(amazonTab, {
            type: 'EXTRACT_AMAZON_ORDER'
          }, 'amazon');
        } catch (e) {
          await addLog(`提取失败：${e.message}`, 'error');
          await setStatus('读取失败，请刷新订单页后重试', 'error');
          sendResponse({
            ok: false,
            error: `提取失败：${e.message}。请确认亚马逊订单页已打开并已刷新。`
          });
          return;
        }

        if (!extractRes?.ok) {
          await addLog(`提取失败：${extractRes?.error || '未知错误'}`, 'error');
          await setStatus(`读取失败：${extractRes?.error || '未知错误'}`, 'error');
          sendResponse({
            ok: false,
            error: extractRes?.error || '提取失败'
          });
          return;
        }

        await setStorage({
          [STORAGE_KEY]: extractRes.data
        });
        await addLog('亚马逊订单提取成功', 'success');
        await addLog(`缓存摘要：${summarizeOrder(extractRes.data)}`, 'info');
        for (const warning of extractRes.data.warnings || []) {
          await addLog(`缺失字段：${warning}`, 'warning');
        }
        const extractStatus = (extractRes.data.warnings || []).length
          ? `读取成功，${extractRes.data.warnings.length} 项需人工确认`
          : '读取成功，核心字段齐全';
        await setStatus(extractStatus, (extractRes.data.warnings || []).length ? 'warning' : 'success');

        sendResponse({
          ok: true,
          data: extractRes.data,
          summary: summarizeOrder(extractRes.data),
          message: extractStatus
        });
        return;
      }

      if (message?.type === 'FILL_TO_LOGISTICS') {
        const res = await getStorage([STORAGE_KEY]);
        const data = res[STORAGE_KEY];

        if (!data) {
          await addLog('填充失败：暂无可用订单数据，请先提取', 'error');
          await setStatus('填充失败：请先读取 Amazon 订单', 'error');
          sendResponse({
            ok: false,
            error: '暂无可用订单数据，请先读取亚马逊订单'
          });
          return;
        }

        const activeTab = await getActiveTab();
        const logisticsTab = activeTab && isLogisticsUrl(activeTab.url)
          ? activeTab
          : await getLogisticsTab();

        if (!logisticsTab) {
          await addLog('填充失败：未找到物流系统标签页', 'error');
          await setStatus('填充失败：未找到物流系统页面', 'error');
          sendResponse({
            ok: false,
            error: '未找到物流系统标签页'
          });
          return;
        }

        let fillRes;
        try {
          fillRes = await sendToTab(logisticsTab, {
            type: 'FILL_LOGISTICS_FORM',
            data
          }, 'logistics');
        } catch (e) {
          await addLog(`填充失败：${e.message}`, 'error');
          await setStatus('填充失败，请刷新物流页面后重试', 'error');
          sendResponse({
            ok: false,
            error: `填充失败：${e.message}。请确认物流系统页面已打开并已刷新。`
          });
          return;
        }

        if (!fillRes?.ok) {
          await addLog(`填充失败：${fillRes?.message || '未知错误'}`, 'error');
          await setStatus(`填充失败：${fillRes?.message || '未知错误'}`, 'error');
          sendResponse({
            ok: false,
            error: fillRes?.message || '填充失败'
          });
          return;
        }

        await addLog(fillRes.message || '物流系统填充成功', 'success');
        for (const warning of fillRes.report?.warnings || []) {
          await addLog(`填充提示：${warning}`, 'warning');
        }
        await setStatus(fillRes.message || '填充成功，请人工确认',
          fillRes.report?.warnings?.length ? 'warning' : 'success');
        sendResponse({
          ok: true,
          message: fillRes.message,
          report: fillRes.report || null
        });
        return;
      }

      sendResponse({
        ok: false,
        error: '未知消息类型'
      });
    } catch (e) {
      await addLog(`运行异常：${e.message}`, 'error');
      await setStatus(`运行异常：${e.message}`, 'error');
      sendResponse({
        ok: false,
        error: e.message || '未知异常'
      });
    }
  })();

  return true;
});
