# Amazon Logistics Helper

这是一个可本地加载的 Chrome Manifest V3 插件 MVP，优先适配 Amazon Seller Central 美国站和加拿大站订单，用于：
- 从亚马逊订单详情页提取订单号、国家、收件人姓名、州、城市、详细地址、电话
- 自动填充到物流系统录单页
- 保留人工确认，不自动提交

## 目录说明

- `manifest.json`：插件配置
- `service_worker.js`：后台消息转发、缓存、日志
- `content_amazon.js`：亚马逊页面提取逻辑
- `content_logistics.js`：物流系统页面填充逻辑
- `config/selectors.js`：页面选择器和国家映射
- `utils/parser.js`：文本清洗、美国/加拿大地址解析
- `utils/fill.js`：输入框、下拉框填充与事件触发
- `popup.html / popup.js / popup.css`：弹窗控制面板

## 安装方式

1. 打开 Chrome
2. 访问 `chrome://extensions`
3. 右上角打开“开发者模式”
4. 点击“加载已解压的扩展程序”
5. 选择本项目目录

## 使用步骤

1. 打开亚马逊卖家后台订单详情页
   - 美国站和加拿大站订单都可能显示在 `sellercentral.amazon.com/orders-v3/order/...`
2. 打开物流系统新建订单页：
   - `http://129.204.184.34:8082/gotoCreateOrder.htm`
3. 点击扩展图标
4. 点击“读取亚马逊订单”
5. 检查预览内容
6. 点击“填充到物流系统”
7. 到物流系统页面人工确认并手动提交

## 当前实现说明

### 已实现

- 订单号优先读取 `span[data-testid="order-id-value"]`，并保留 URL/页面文本回退
- 美国 `City, ST ZIP` 与加拿大 `City, Province A1A 1A1` 地址解析
- 加拿大邮编单独一行时与上一行城市/省份合并解析
- 国家英文名、两位代码和中文名标准化，至少覆盖 US/CA/DE/FR/GB
- 电话提取、姓名/国家去重、多行街道地址合并和缺失字段警告
- 物流字段逐项填充并触发 `input`、`change`、`blur`
- 目的地下拉按 option 文本优先、value 次优先匹配
- popup 当前状态、缓存摘要、数据预览和最近日志
- content script 未加载时由 service worker 自动补注入一次
- 不读取或点击任何最终提交按钮

### 当前已确认的物流 DOM

- 订单号：`#order_customerinvoicecode`
- 目的地：`#country`
- 收件人：`#consignee_name`
- 州/省：`#consignee_state`
- 城市：`#consignee_city`
- 邮编：`#consignee_postcode`
- 地址：`#consignee_address`
- 电话：`#consignee_telephone`
- 手机备用框：`#consignee_mobile`，MVP 不自动重复填入

### 仍需真实页面反馈的 Amazon DOM

Amazon 订单号 DOM 已确认。地址容器、收件人和电话仍使用多候选选择器与标题回退；如果预览不准确，请提供对应订单页以下信息之一：

- “Shipping address / 配送地址”卡片的 `outerHTML`（姓名、地址和电话可打码，但保留标签、属性和换行结构）
- 地址卡片与电话区域的 DevTools Elements 截图
- popup 的完整可读错误和“警告”字段

## 调试方法

### 查看 popup 日志
点击插件图标即可看到最近日志。

### 查看页面脚本日志
1. 打开亚马逊或物流页面
2. 按 F12
3. 在 Console 查看输出和报错

### 查看 service worker
1. 打开 `chrome://extensions`
2. 找到本插件
3. 点击“service worker”下方的 inspect

### 本地核心测试

```powershell
node tests/parser.test.js
```

## 后续可升级方向

1. 自动识别下一单
2. 批量处理多个亚马逊订单
3. 自动记忆已处理订单号，避免重复录单
4. 导出成功/失败日志
5. 增加更多国家和本地化地址格式
6. 根据 SKU 自动填写配货信息

## 注意

- 本版本默认不自动提交表单
- 这是 MVP 版本，优先保证“可提取 + 可填充 + 可人工确认”
- 如果你的物流系统表单字段不是标准 input/select/textarea，需要针对真实 DOM 再补一轮选择器
