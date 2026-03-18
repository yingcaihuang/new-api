# 微信支付 PublicKeyAuthCipher 切换实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将微信支付从 WithWechatPayAutoAuthCipher 切换到 WithWechatPayPublicKeyAuthCipher，使公钥和公钥ID可通过配置界面管理

**Architecture:** 在后端配置层新增两个字段（WechatPublicKey、WechatPublicKeyID），修改客户端初始化逻辑使用这些配置，移除所有硬编码值。前端添加对应的表单字段和验证逻辑。

**Tech Stack:** Go (WeChat Pay SDK v0.2.x), React (Semi Design UI), JavaScript

---

## 文件变更概览

**后端**:
- Modify: `setting/payment_wechat.go` - 添加两个新配置字段
- Modify: `controller/payment_wechat.go` - 重构 `initWechatClient()` 函数

**前端**:
- Modify: `web/src/pages/Setting/Payment/SettingsPaymentGatewayWechat.jsx` - 添加表单字段和验证

**文档**:
- Spec: `docs/superpowers/specs/2026-03-18-wechat-payment-publickey-auth-design.md` (已存在)

---

## Task 1: 后端配置层 - 添加新配置字段

**Files:**
- Modify: `setting/payment_wechat.go`

**目标:** 在配置文件中添加微信支付平台公钥和公钥ID字段

- [ ] **Step 1: 添加配置字段**

在 `setting/payment_wechat.go` 文件末尾添加两个新的配置变量：

```go
var WechatPublicKey = ""      // 微信支付平台公钥内容（PEM格式）
var WechatPublicKeyID = ""    // 微信支付平台公钥ID
```

位置：在现有的 `WechatMinTopUp` 变量之后

- [ ] **Step 2: 验证文件语法**

Run: `cd /Users/feng/workspace/code/git.metami.work/new-api-yingcai && go build ./setting`

Expected: 编译成功，无错误输出

- [ ] **Step 3: Commit**

```bash
git add setting/payment_wechat.go
git commit -m "feat(payment): add WechatPublicKey and WechatPublicKeyID config fields

Add configuration fields for WeChat Pay platform public key and key ID
to support WithWechatPayPublicKeyAuthCipher authentication method.

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 后端控制层 - 重构客户端初始化函数

**Files:**
- Modify: `controller/payment_wechat.go:36-79`

**目标:** 更新 `initWechatClient()` 函数以使用新配置字段，移除硬编码值和注释代码

- [ ] **Step 1: 更新配置完整性检查**

修改 `initWechatClient()` 函数的配置检查部分（当前 line 37-39），添加新字段验证：

```go
// 配置完整性检查
if !setting.WechatEnabled ||
   setting.WechatMchID == "" ||
   setting.WechatAPIv3Key == "" ||
   setting.WechatPrivateKey == "" ||
   setting.WechatPublicKey == "" ||
   setting.WechatPublicKeyID == "" {
    return nil, errors.New("微信支付未启用或配置不完整")
}
```

- [ ] **Step 2: 移除硬编码的公钥文件加载代码**

删除 line 51-54 的硬编码公钥加载代码：

```go
// 删除这段代码：
mchPublicKey, err := utils.LoadPublicKeyWithPath("/Users/feng/pub_key.pem")
if err != nil {
    return nil, fmt.Errorf("加载商户私钥失败: %v", err)
}
```

- [ ] **Step 3: 添加从配置加载平台公钥的代码**

在加载商户私钥的代码之后（line 49 之后），添加新的公钥加载逻辑：

```go
// 加载微信支付平台公钥
wechatPublicKey, err := utils.LoadPublicKey(setting.WechatPublicKey)
if err != nil {
    return nil, fmt.Errorf("加载微信支付平台公钥失败: %v", err)
}
```

- [ ] **Step 4: 删除注释的 WithWechatPayAutoAuthCipher 代码**

删除 line 60-65 的注释代码块：

```go
// 删除这整段注释：
// option.WithWechatPayAutoAuthCipher(
//     setting.WechatMchID,
//     setting.WechatSerialNo,
//     mchPrivateKey,
//     setting.WechatAPIv3Key,
// ),
```

- [ ] **Step 5: 更新 WithWechatPayPublicKeyAuthCipher 使用配置值**

修改客户端初始化代码（line 66-72），使用从配置加载的值，并使用正确的变量名：

```go
option.WithWechatPayPublicKeyAuthCipher(
    setting.WechatMchID,
    setting.WechatSerialNo,
    mchPrivateKey,
    setting.WechatPublicKeyID,      // 从配置读取
    wechatPublicKey,                // 使用新加载的变量
),
```

修改后的完整 `initWechatClient()` 函数应该是：

```go
func initWechatClient() (*core.Client, error) {
    // 配置完整性检查
    if !setting.WechatEnabled ||
       setting.WechatMchID == "" ||
       setting.WechatAPIv3Key == "" ||
       setting.WechatPrivateKey == "" ||
       setting.WechatPublicKey == "" ||
       setting.WechatPublicKeyID == "" {
        return nil, errors.New("微信支付未启用或配置不完整")
    }

    // 加载商户私钥
    mchPrivateKey, err := utils.LoadPrivateKey(setting.WechatPrivateKey)
    if err != nil {
        return nil, fmt.Errorf("加载商户私钥失败: %v", err)
    }

    // 加载微信支付平台公钥
    wechatPublicKey, err := utils.LoadPublicKey(setting.WechatPublicKey)
    if err != nil {
        return nil, fmt.Errorf("加载微信支付平台公钥失败: %v", err)
    }

    // 初始化客户端
    ctx := context.Background()
    client, err := core.NewClient(
        ctx,
        option.WithWechatPayPublicKeyAuthCipher(
            setting.WechatMchID,
            setting.WechatSerialNo,
            mchPrivateKey,
            setting.WechatPublicKeyID,
            wechatPublicKey,
        ),
    )
    if err != nil {
        return nil, fmt.Errorf("初始化微信支付客户端失败: %v", err)
    }

    return client, nil
}
```

- [ ] **Step 6: 验证编译**

Run: `cd /Users/feng/workspace/code/git.metami.work/new-api-yingcai && go build ./controller`

Expected: 编译成功，无错误输出

- [ ] **Step 7: Commit**

```bash
git add controller/payment_wechat.go
git commit -m "refactor(payment): migrate to WithWechatPayPublicKeyAuthCipher

- Update initWechatClient() to use WechatPublicKey and WechatPublicKeyID
  from configuration instead of hardcoded values
- Remove hardcoded public key file path (/Users/feng/pub_key.pem)
- Remove hardcoded public key ID
- Delete commented WithWechatPayAutoAuthCipher code
- Use utils.LoadPublicKey() to load platform public key from string
- Rename variable from mchPublicKey to wechatPublicKey for clarity

All payment functions (topup and subscription) automatically use the new
authentication method as they share the same initWechatClient() function.

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 前端配置界面 - 添加表单字段

**Files:**
- Modify: `web/src/pages/Setting/Payment/SettingsPaymentGatewayWechat.jsx`

**目标:** 在前端配置界面添加公钥和公钥ID输入字段，包含验证逻辑

- [ ] **Step 1: 更新状态定义**

在 `useState` 初始化中添加两个新字段（约在 line 39-48）：

找到：
```javascript
const [inputs, setInputs] = useState({
  WechatEnabled: false,
  WechatAppID: '',
  WechatMchID: '',
  WechatAPIv3Key: '',
  WechatSerialNo: '',
  WechatPrivateKey: '',
  WechatServerURL: 'https://api.mch.weixin.qq.com',
  WechatMinTopUp: 1,
});
```

修改为：
```javascript
const [inputs, setInputs] = useState({
  WechatEnabled: false,
  WechatAppID: '',
  WechatMchID: '',
  WechatAPIv3Key: '',
  WechatSerialNo: '',
  WechatPrivateKey: '',
  WechatPublicKey: '',      // 新增
  WechatPublicKeyID: '',    // 新增
  WechatServerURL: 'https://api.mch.weixin.qq.com',
  WechatMinTopUp: 1,
});
```

- [ ] **Step 2: 更新 useEffect 初始化逻辑**

在 `useEffect` 中添加新字段的初始化（约在 line 52-72）：

找到 `currentInputs` 对象定义，在 `WechatPrivateKey` 之后添加：

```javascript
const currentInputs = {
  WechatEnabled: props.options.WechatEnabled === true || props.options.WechatEnabled === 'true',
  WechatAppID: props.options.WechatAppID || '',
  WechatMchID: props.options.WechatMchID || '',
  WechatAPIv3Key: props.options.WechatAPIv3Key || '',
  WechatSerialNo: props.options.WechatSerialNo || '',
  WechatPrivateKey: props.options.WechatPrivateKey || '',
  WechatPublicKey: props.options.WechatPublicKey || '',        // 新增
  WechatPublicKeyID: props.options.WechatPublicKeyID || '',    // 新增
  WechatServerURL: props.options.WechatServerURL || 'https://api.mch.weixin.qq.com',
  WechatMinTopUp:
    props.options.WechatMinTopUp !== undefined
      ? parseInt(props.options.WechatMinTopUp)
      : 1,
};
```

- [ ] **Step 3: 添加表单字段（公钥内容）**

在商户私钥字段之后（约在 line 210-216 之后），添加公钥字段：

```jsx
<Form.TextArea
  field="WechatPublicKey"
  label={t('微信支付平台公钥')}
  placeholder={t('请输入微信支付平台公钥（PEM格式）')}
  autosize={{ minRows: 3, maxRows: 6 }}
  rules={[
    { required: true, message: t('请输入微信支付平台公钥') },
    {
      validator: (rule, value) => {
        if (!value) return true;
        if (!value.includes('-----BEGIN PUBLIC KEY-----')) {
          return t('公钥格式错误，应为PEM格式');
        }
        return true;
      }
    }
  ]}
/>
```

- [ ] **Step 4: 添加表单字段（公钥ID）**

紧接着公钥字段之后，添加公钥ID字段：

```jsx
<Form.Input
  field="WechatPublicKeyID"
  label={t('微信支付平台公钥ID')}
  placeholder={t('请输入平台公钥ID，如：PUB_KEY_ID_xxx')}
  rules={[
    { required: true, message: t('请输入平台公钥ID') }
  ]}
/>
```

- [ ] **Step 5: 更新配置提交逻辑**

在 `submitWechatSetting` 函数中，在处理 `WechatPrivateKey` 的代码之后（约在 line 108-113 之后），添加新字段的处理：

```javascript
if (inputs.WechatPublicKey !== originInputs.WechatPublicKey) {
  options.push({
    key: 'WechatPublicKey',
    value: inputs.WechatPublicKey,
  });
}
if (inputs.WechatPublicKeyID !== originInputs.WechatPublicKeyID) {
  options.push({
    key: 'WechatPublicKeyID',
    value: inputs.WechatPublicKeyID,
  });
}
```

- [ ] **Step 6: 验证前端编译**

Run: `cd /Users/feng/workspace/code/git.metami.work/new-api-yingcai/web && npm run build`

Expected: 编译成功，无错误

- [ ] **Step 7: Commit**

```bash
git add web/src/pages/Setting/Payment/SettingsPaymentGatewayWechat.jsx
git commit -m "feat(frontend): add WeChat Pay public key configuration fields

- Add WechatPublicKey field (TextArea with PEM format validation)
- Add WechatPublicKeyID field (Input with required validation)
- Update state management to include new fields
- Update form submission logic to save new fields
- Public key field does not use password type (public keys are not sensitive)

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 集成测试 - 验证支付流程

**Files:**
- N/A (手动测试)

**目标:** 验证配置和支付流程正常工作

- [ ] **Step 1: 启动开发环境**

Run:
```bash
# 启动后端
cd /Users/feng/workspace/code/git.metami.work/new-api-yingcai
go run main.go

# 启动前端（新终端）
cd /Users/feng/workspace/code/git.metami.work/new-api-yingcai/web
npm run dev
```

Expected: 两个服务都成功启动

- [ ] **Step 2: 测试配置界面**

Manual steps:
1. 访问 `http://localhost/admin` (或对应的管理员路径)
2. 进入支付设置 → 微信官方支付
3. 验证新增的两个字段显示正常：
   - "微信支付平台公钥" (TextArea)
   - "微信支付平台公钥ID" (Input)

Expected: 界面显示正常，字段可编辑

- [ ] **Step 3: 测试表单验证**

Manual steps:
1. 尝试提交空的公钥字段 → 应显示"请输入微信支付平台公钥"错误
2. 输入无效格式的公钥（不包含 `-----BEGIN PUBLIC KEY-----`）→ 应显示"公钥格式错误"
3. 输入正确的PEM格式公钥和公钥ID
4. 点击保存

Expected: 验证按预期工作，正确格式的数据可以成功保存

- [ ] **Step 4: 验证配置保存到数据库**

Run: 检查数据库中的 options 表

Expected:
- 存在 `WechatPublicKey` 记录，value 包含公钥内容
- 存在 `WechatPublicKeyID` 记录，value 包含公钥ID

- [ ] **Step 5: 测试充值支付流程**

Manual steps:
1. 使用测试用户登录前端
2. 进入充值页面
3. 选择微信支付，输入充值金额（大于最小充值额）
4. 点击支付

Expected:
- 成功生成二维码
- 查看后端日志，确认使用 `WithWechatPayPublicKeyAuthCipher` 初始化客户端
- 无 "配置不完整" 或公钥加载失败的错误

- [ ] **Step 6: 测试订阅支付流程（如果启用）**

Manual steps:
1. 访问订阅套餐页面
2. 选择一个套餐
3. 使用微信支付购买

Expected:
- 成功生成支付二维码
- 订阅支付使用相同的客户端初始化逻辑

- [ ] **Step 7: 验证错误处理**

Manual steps:
1. 在数据库中临时清空 `WechatPublicKey` 配置
2. 尝试发起支付

Expected: 返回错误 "微信支付未启用或配置不完整"

3. 恢复正确配置
4. 输入格式错误的公钥（例如删除 PEM 头部）
5. 尝试发起支付

Expected: 返回错误 "加载微信支付平台公钥失败"

- [ ] **Step 8: 记录测试结果**

创建测试报告文档（可选）：

```bash
cat > docs/superpowers/test-results/2026-03-18-wechat-publickey-test.md << 'EOF'
# 微信支付 PublicKeyAuthCipher 测试报告

## 测试日期
2026-03-18

## 测试环境
- 后端版本: [Git commit hash]
- 前端版本: [Git commit hash]
- 测试环境: [开发/测试/生产]

## 测试结果

### 配置界面 ✅
- [x] 新字段显示正常
- [x] 表单验证工作正常
- [x] 配置成功保存到数据库

### 支付流程 ✅
- [x] 充值支付正常
- [x] 订阅支付正常
- [x] 二维码生成正常

### 错误处理 ✅
- [x] 缺少配置时正确报错
- [x] 公钥格式错误时正确报错

## 遗留问题
无

EOF

git add docs/superpowers/test-results/
git commit -m "docs: add WeChat Pay PublicKeyAuth integration test results

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 文档和清理

**Files:**
- Modify: `docs/superpowers/specs/2026-03-18-wechat-payment-publickey-auth-design.md` (更新状态)
- Create: User documentation (可选)

**目标:** 更新文档并进行最终检查

- [ ] **Step 1: 更新设计文档状态**

在设计文档顶部更新状态：

```markdown
**日期**: 2026-03-18
**作者**: Claude Sonnet 4.5
**状态**: 已实施 ✅
```

- [ ] **Step 2: 验证检查清单**

回顾设计文档的 "实现检查清单"（Section 11），确认所有项目都已完成：

**后端**:
- ✅ 在 `setting/payment_wechat.go` 中新增字段
- ✅ 修改 `initWechatClient()` 函数
- ✅ 使用 `utils.LoadPublicKey()`
- ✅ 移除硬编码路径和ID
- ✅ 删除注释代码

**前端**:
- ✅ 更新状态定义
- ✅ 添加表单字段
- ✅ 添加验证逻辑
- ✅ 更新提交逻辑

**测试**:
- ✅ 充值支付流程
- ✅ 订阅支付流程
- ✅ 错误场景

- [ ] **Step 3: 代码审查自查**

检查以下方面：
- [ ] 所有硬编码值已移除
- [ ] 错误消息清晰准确
- [ ] 变量命名一致（wechatPublicKey vs WechatPublicKey）
- [ ] 没有遗留的调试代码或注释
- [ ] Git commit 消息清晰

- [ ] **Step 4: 创建用户文档（可选）**

如果需要面向管理员的配置指南，创建文档：

```markdown
# docs/user-guide/wechat-payment-configuration.md

# 微信支付配置指南

## 获取平台公钥

1. 登录微信商户平台
2. 进入 **账户中心** → **API安全** → **平台证书**
3. 下载平台证书
4. 从证书中提取公钥（PEM格式）

## 配置步骤

1. 访问系统管理员后台
2. 进入 **支付设置** → **微信官方支付**
3. 填写以下字段：
   - **微信支付平台公钥**: 粘贴完整的PEM格式公钥
   - **微信支付平台公钥ID**: 输入平台提供的公钥ID
4. 点击保存

## 故障排除

### 支付失败："配置不完整"
- 确认所有必填字段已填写
- 检查公钥和公钥ID是否正确

### "加载公钥失败"
- 检查公钥格式是否正确（必须包含 `-----BEGIN PUBLIC KEY-----`）
- 确认公钥内容没有被截断
```

```bash
git add docs/user-guide/ docs/superpowers/specs/
git commit -m "docs: update implementation status and add user guide

- Mark design spec as implemented
- Add WeChat Pay configuration guide for administrators

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: 最终验证**

Run complete test suite (if available):
```bash
# Backend tests
cd /Users/feng/workspace/code/git.metami.work/new-api-yingcai
go test ./...

# Frontend tests (if available)
cd web
npm test
```

Expected: 所有测试通过

- [ ] **Step 6: 推送到远程仓库（可选）**

如果需要推送到远程：

```bash
git push origin main
```

或创建 Pull Request：

```bash
# 如果在 feature 分支上
git push origin feature/wechat-publickey-auth

# 然后在 GitHub/GitLab 上创建 PR
```

---

## 完成标准

✅ 后端配置字段已添加
✅ 客户端初始化函数已重构
✅ 所有硬编码值已移除
✅ 前端表单字段已添加
✅ 表单验证正常工作
✅ 充值支付流程测试通过
✅ 订阅支付流程测试通过
✅ 错误处理测试通过
✅ 文档已更新
✅ 代码已提交

## 参考文档

- 设计文档: `docs/superpowers/specs/2026-03-18-wechat-payment-publickey-auth-design.md`
- WeChat Pay SDK: `vendor/github.com/wechatpay-apiv3/wechatpay-go/`
- 当前实现: `controller/payment_wechat.go:36-79`

## 估计时间

- Task 1: 5 分钟
- Task 2: 15 分钟
- Task 3: 20 分钟
- Task 4: 30 分钟（手动测试）
- Task 5: 10 分钟

**总计**: 约 80 分钟（1小时20分钟）

## 风险和注意事项

⚠️ **生产环境部署警告**: 在生产环境部署前，必须先配置公钥和公钥ID，否则支付功能会失败。建议在低流量时段部署。

⚠️ **公钥获取**: 确保从微信商户平台获取的是**平台公钥**，不是商户公钥或证书。

⚠️ **格式验证**: PEM格式必须包含头部（`-----BEGIN PUBLIC KEY-----`）和尾部（`-----END PUBLIC KEY-----`），不要截断或修改内容。
