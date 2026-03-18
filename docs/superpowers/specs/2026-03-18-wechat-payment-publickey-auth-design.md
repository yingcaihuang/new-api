# 微信支付切换到 PublicKeyAuthCipher 设计文档

**日期**: 2026-03-18
**作者**: Claude Sonnet 4.5
**状态**: 待审核

## 1. 概述

### 1.1 背景

当前微信支付实现使用了 `WithWechatPayAutoAuthCipher` 方式，但代码中已切换到 `WithWechatPayPublicKeyAuthCipher`，存在以下问题：
- 公钥文件路径硬编码为 `/Users/feng/pub_key.pem`
- 公钥ID硬编码为 `PUB_KEY_ID_0117401704292026031300212083003200`
- 注释掉的 `WithWechatPayAutoAuthCipher` 代码未清理

### 1.2 目标

1. 完全移除 `WithWechatPayAutoAuthCipher` 相关代码
2. 将微信支付平台公钥内容和公钥ID作为可配置项，存储在数据库中
3. 提供前端配置界面，允许管理员输入公钥信息
4. 使用 Go 标准库直接从字符串解析公钥，无需文件系统操作

### 1.3 改动范围

**后端**：
- `setting/payment_wechat.go` - 新增配置字段
- `controller/payment_wechat.go` - 修改客户端初始化逻辑，新增公钥解析函数

**前端**：
- `web/src/pages/Setting/Payment/SettingsPaymentGatewayWechat.jsx` - 新增表单字段

**不涉及的部分**：
- 支付回调处理（`WechatNotify`, `SubscriptionWechatNotify`）
- 订单查询逻辑
- 前端支付流程

## 2. 配置层设计

### 2.1 新增配置字段

在 `setting/payment_wechat.go` 中新增：

```go
var WechatPublicKey = ""      // 微信支付平台公钥内容（PEM格式）
var WechatPublicKeyID = ""    // 微信支付平台公钥ID
```

### 2.2 配置说明

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `WechatPublicKey` | string | 微信支付平台公钥的完整PEM内容 | `-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...\n-----END PUBLIC KEY-----` |
| `WechatPublicKeyID` | string | 微信支付平台提供的公钥ID | `PUB_KEY_ID_0117401704292026031300212083003200` |

**PEM格式示例**：
```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
(多行Base64编码内容)
...xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
-----END PUBLIC KEY-----
```

### 2.3 配置验证

在 `initWechatClient()` 函数**开头**更新配置完整性检查，替换现有的验证逻辑（当前在 line 37-39）：

```go
// 配置完整性检查（包含新增的公钥字段）
if !setting.WechatEnabled ||
   setting.WechatMchID == "" ||
   setting.WechatAPIv3Key == "" ||
   setting.WechatPrivateKey == "" ||
   setting.WechatPublicKey == "" ||      // 新增
   setting.WechatPublicKeyID == "" {     // 新增
    return nil, errors.New("微信支付未启用或配置不完整")
}
```

**位置说明**：在函数的第一步进行验证，避免后续不必要的处理。

## 3. 后端实现设计

### 3.1 使用 SDK 提供的公钥加载函数

**无需自定义实现**：WeChat Pay SDK 已经提供了 `utils.LoadPublicKey()` 函数用于从字符串加载公钥。

该函数位于 `github.com/wechatpay-apiv3/wechatpay-go/utils` 包中：

```go
// LoadPublicKey 通过公钥的文本内容加载公钥
func LoadPublicKey(publicKeyStr string) (publicKey *rsa.PublicKey, err error)
```

**函数功能**：
- 接受 PEM 格式的公钥字符串
- 返回 `*rsa.PublicKey` 类型
- 内置错误处理和格式验证
- 与 `utils.LoadPrivateKey()` 保持一致的使用方式

### 3.2 修改 `initWechatClient()` 函数

**主要改动**（完整的修改后的函数）：

```go
func initWechatClient() (*core.Client, error) {
    // 1. 配置完整性检查（包含新增的公钥字段）
    // 位置：函数开头，替换现有的检查（line 37-39）
    if !setting.WechatEnabled ||
       setting.WechatMchID == "" ||
       setting.WechatAPIv3Key == "" ||
       setting.WechatPrivateKey == "" ||
       setting.WechatPublicKey == "" ||
       setting.WechatPublicKeyID == "" {
        return nil, errors.New("微信支付未启用或配置不完整")
    }

    // 2. 加载商户私钥（保持不变）
    mchPrivateKey, err := utils.LoadPrivateKey(setting.WechatPrivateKey)
    if err != nil {
        return nil, fmt.Errorf("加载商户私钥失败: %v", err)
    }

    // 3. 加载微信支付平台公钥（新增，使用SDK提供的函数）
    // 变量名：使用 wechatPublicKey 而非 mchPublicKey，清晰表明这是平台公钥
    wechatPublicKey, err := utils.LoadPublicKey(setting.WechatPublicKey)
    if err != nil {
        return nil, fmt.Errorf("加载微信支付平台公钥失败: %v", err)
    }

    // 4. 使用 WithWechatPayPublicKeyAuthCipher 初始化客户端
    // 位置：替换现有的初始化代码（line 57-77）
    ctx := context.Background()
    client, err := core.NewClient(
        ctx,
        option.WithWechatPayPublicKeyAuthCipher(
            setting.WechatMchID,
            setting.WechatSerialNo,
            mchPrivateKey,
            setting.WechatPublicKeyID,
            wechatPublicKey,  // 使用新加载的平台公钥
        ),
    )
    if err != nil {
        return nil, fmt.Errorf("初始化微信支付客户端失败: %v", err)
    }

    return client, nil
}
```

**关键点**：
- 变量命名使用 `wechatPublicKey` 而非 `mchPublicKey`，与配置字段名 `WechatPublicKey` 保持一致
- 配置检查在函数最开始，快速失败
- 所有硬编码的值都替换为配置值

**需要删除/修复的代码**：
1. 硬编码的公钥文件路径加载（line 51-54）：
   ```go
   mchPublicKey, err := utils.LoadPublicKeyWithPath("/Users/feng/pub_key.pem")
   if err != nil {
       return nil, fmt.Errorf("加载商户私钥失败: %v", err)  // 错误消息也需要修正
   }
   ```
   **注意**：错误消息说"加载商户私钥失败"但实际加载的是公钥，这是一个错误

2. 注释掉的 `WithWechatPayAutoAuthCipher` 代码块（line 60-65）：
   ```go
   // option.WithWechatPayAutoAuthCipher(
   //     setting.WechatMchID,
   //     setting.WechatSerialNo,
   //     mchPrivateKey,
   //     setting.WechatAPIv3Key,
   // ),
   ```

3. 硬编码的公钥ID（line 70）：`"PUB_KEY_ID_0117401704292026031300212083003200"`

### 3.3 影响的功能模块

**已验证**：所有调用 `initWechatClient()` 的功能都会自动使用新的认证方式。

通过代码验证，以下函数都调用了共享的 `initWechatClient()` 函数：

- ✅ `RequestWechatPay()` - 充值支付 (line 141)
- ✅ `QueryWechatOrder()` - 充值订单查询 (line 244)
- ✅ `SubscriptionRequestWechatPay()` - 订阅支付，位于 `controller/subscription_payment_wechat.go` (line 87)
- ✅ `SubscriptionQueryWechatOrder()` - 订阅订单查询 (line 272)

**不受影响的部分**：
- `WechatNotify()` - 使用独立的 `notify.NewRSANotifyHandler()`，不依赖 `initWechatClient()`
- `SubscriptionWechatNotify()` - 同上

**结论**：修改 `initWechatClient()` 函数后，所有微信支付相关功能（充值和订阅）都会自动切换到新的认证方式，无需额外改动。

## 4. 前端实现设计

### 4.1 修改配置界面

在 `web/src/pages/Setting/Payment/SettingsPaymentGatewayWechat.jsx` 中：

#### 4.1.1 更新状态定义

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

#### 4.1.2 新增表单字段

在 "商户私钥" 字段后添加：

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
        if (!value) return true; // required已经检查了
        if (!value.includes('-----BEGIN PUBLIC KEY-----')) {
          return t('公钥格式错误，应为PEM格式');
        }
        return true;
      }
    }
  ]}
/>

<Form.Input
  field="WechatPublicKeyID"
  label={t('微信支付平台公钥ID')}
  placeholder={t('请输入平台公钥ID，如：PUB_KEY_ID_xxx')}
  rules={[
    { required: true, message: t('请输入平台公钥ID') }
  ]}
/>
```

**验证说明**：
- 公钥字段移除 `type="password"`，因为公钥本身不敏感，隐藏反而不便于管理员验证是否复制正确
- 添加格式验证，检查是否包含 PEM 头部标记
- 公钥ID保持简单的必填验证

#### 4.1.3 更新配置提交逻辑

在 `submitWechatSetting()` 函数中添加新字段的处理：

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

#### 4.1.4 更新初始化逻辑

在 `useEffect` 中添加新字段的初始化：

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
  WechatMinTopUp: props.options.WechatMinTopUp !== undefined
    ? parseInt(props.options.WechatMinTopUp)
    : 1,
};
```

### 4.2 用户界面说明文本

建议在配置页面添加说明文本，帮助管理员理解如何获取公钥：

```jsx
<Banner
  type="info"
  description={
    <div>
      <Text>{t('微信支付平台公钥可从商户平台下载，路径：')}</Text>
      <Text strong>{t('账户中心 → API安全 → 平台证书')}</Text>
    </div>
  }
  style={{ marginBottom: '16px' }}
/>
```

## 5. 错误处理

### 5.1 配置错误

| 场景 | 错误信息 | 用户反馈 |
|------|----------|----------|
| 缺少公钥配置 | `微信支付未启用或配置不完整` | 前端初始化失败提示 |
| 公钥格式错误 | `解析公钥失败：无效的PEM格式` | 支付时提示配置错误 |
| 公钥类型错误 | `公钥类型错误：期望RSA公钥` | 支付时提示配置错误 |

### 5.2 运行时错误

所有错误都会在 `initWechatClient()` 阶段被捕获，并返回明确的错误信息给调用方。调用方会：
1. 记录详细日志：`log.Println("初始化微信支付客户端失败:", err)`
2. 返回用户友好的错误：`common.ApiErrorMsg(c, "当前管理员未配置微信支付信息")`

## 6. 向后兼容性

### 6.1 升级路径

对于已有的微信支付配置：
1. 系统管理员需要在配置界面补充 `WechatPublicKey` 和 `WechatPublicKeyID`
2. **重要**：在补充配置前，支付功能会失败并提示"配置不完整"，建议在低流量时段进行升级
3. 无需数据迁移，仅需添加新配置
4. 配置完成后立即生效，无需重启服务

### 6.2 配置完整性提示

建议在前端添加配置完整性检查，当检测到缺少新字段时显示警告横幅。

## 7. 测试策略

### 7.1 单元测试

**后端**：
虽然公钥解析逻辑由 SDK 提供无需测试，但仍需要集成测试来验证：

- 测试 `initWechatClient()` 函数的集成
  - ✅ 完整配置下的正常初始化
  - ✅ 缺少公钥配置的错误处理
  - ✅ 公钥格式错误时错误消息正确传播
  - ✅ 配置值正确从数据库传递到 SDK 函数
  - ✅ 初始化的客户端能正常调用微信支付API

**测试策略**：
- 使用模拟配置测试各种错误场景
- 使用真实配置测试完整的支付流程（集成测试）

### 7.2 集成测试

**端到端流程**：
1. 配置保存：前端 → API → 数据库
2. 配置读取：数据库 → 后端配置层
3. 客户端初始化：配置解析 → SDK初始化
4. 支付流程：发起支付 → 订单查询 → 支付回调

**测试场景**：
- 充值支付完整流程
- 订阅支付完整流程
- 配置更新后的支付流程

### 7.3 手动测试清单

- [ ] 在配置界面输入公钥和公钥ID
- [ ] 保存配置并验证数据库存储
- [ ] 发起一笔小额充值测试
- [ ] 检查日志确认使用 `WithWechatPayPublicKeyAuthCipher`
- [ ] 扫码支付并完成
- [ ] 验证订单状态更新
- [ ] 验证用户额度增加
- [ ] 测试订阅支付流程

## 8. 部署注意事项

### 8.1 部署前准备

1. 从微信商户平台获取平台公钥和公钥ID
2. 准备测试用的小额支付场景

### 8.2 部署步骤

1. 部署后端代码
2. 部署前端代码
3. 访问配置界面，输入公钥信息
4. 使用测试账号进行小额充值测试
5. 确认测试通过后启用生产环境

### 8.3 回滚计划

如果出现问题，可以：
1. 通过数据库备份恢复配置
2. 回滚代码到之前版本
3. 注意：回滚后需要恢复到硬编码公钥的版本（不推荐）

建议采用灰度发布策略，先在测试环境充分验证。

## 9. 安全考虑

### 9.1 敏感信息保护

- 公钥内容和公钥ID存储在数据库中
- **注意**：公钥本身不是敏感信息（公开的），前端表单不使用 `type="password"`，便于管理员验证复制正确性
- 商户私钥（`WechatPrivateKey`）保持 `type="password"` 保护
- 日志中不应输出完整的私钥内容，公钥可以输出用于调试

### 9.2 配置访问控制

- 仅管理员可访问配置界面
- 使用现有的权限验证机制
- 配置修改需要记录操作日志

## 10. 文档更新

需要更新的文档：
- 用户手册：微信支付配置说明
- 管理员指南：如何获取和配置平台公钥
- API文档：配置字段说明（如果有公开API）

## 11. 实现检查清单

### 后端
- [ ] 在 `setting/payment_wechat.go` 中新增 `WechatPublicKey` 和 `WechatPublicKeyID` 字段
- [ ] 修改 `controller/payment_wechat.go` 中的 `initWechatClient()` 函数：
  - [ ] 添加新字段的配置检查
  - [ ] 使用 `utils.LoadPublicKey()` 加载公钥（无需自定义函数）
  - [ ] 移除硬编码的公钥文件路径 `utils.LoadPublicKeyWithPath("/Users/feng/pub_key.pem")`
  - [ ] 移除硬编码的公钥ID `"PUB_KEY_ID_0117401704292026031300212083003200"`
  - [ ] 删除注释掉的 `WithWechatPayAutoAuthCipher` 代码块
  - [ ] 确认使用 `WithWechatPayPublicKeyAuthCipher` 初始化，参数从配置读取

### 前端
- [ ] 在 `SettingsPaymentGatewayWechat.jsx` 中：
  - [ ] 更新 `inputs` 状态定义
  - [ ] 更新 `useEffect` 初始化逻辑
  - [ ] 添加 `WechatPublicKey` 表单字段（TextArea，password类型）
  - [ ] 添加 `WechatPublicKeyID` 表单字段（Input）
  - [ ] 更新 `submitWechatSetting()` 函数处理新字段
  - [ ] 添加配置说明文本（可选）

### 测试
- [ ] 手动测试充值支付流程
- [ ] 手动测试订阅支付流程
- [ ] 测试配置错误场景
- [ ] 验证日志输出

### 文档
- [ ] 更新用户配置文档
- [ ] 更新部署文档
