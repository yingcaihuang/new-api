# 管理员实名认证管理功能设计文档

**日期：** 2026-03-17
**版本：** 1.0
**状态：** 待审核

## 1. 概述

### 1.1 功能描述

在用户管理页面中，为每个用户的操作菜单添加"实名认证"管理入口，点击后通过侧边抽屉（SideSheet）展示该用户的实名认证信息，并提供查看、编辑、添加、清除等管理功能。

### 1.2 目标用户

- 管理员（role = 10）
- 超级管理员（role = 100）

### 1.3 核心需求

1. 在用户管理表格的操作列下拉菜单中，"订阅管理"下方添加"实名认证"入口
2. 管理员可以查看用户的完整实名认证信息（包括完整身份证号）
3. 管理员可以编辑已认证用户的信息
4. 管理员可以为未认证用户添加认证信息
5. 管理员可以清除用户的实名认证信息（彻底删除，允许用户重新认证）
6. 身份证号默认脱敏显示，可点击按钮显示完整信息

## 2. 架构设计

### 2.1 整体架构

采用**完全独立的管理界面方案**，将管理端和用户端完全分离：

- 前端：创建独立的 `UserVerificationModal.jsx` 组件
- 后端：新增管理员专用 API 端点
- 权限：复用现有 AdminAuth 中间件

### 2.2 前端架构

**新增文件：**
```
/web/src/components/table/users/modals/UserVerificationModal.jsx
```

**修改文件：**
```
/web/src/components/table/users/UsersColumnDefs.jsx  (添加菜单项)
/web/src/components/table/users/UsersTable.jsx       (添加状态管理)
```

**组件层级：**
```
UsersTable (父组件)
  └─ UsersColumnDefs (列定义)
       └─ renderOperations (操作列)
            └─ Dropdown Menu
                 ├─ 订阅管理 (已有)
                 ├─ 实名认证 (新增) ← 打开 UserVerificationModal
                 ├─ 重置 Passkey
                 └─ ...
```

### 2.3 后端架构

**新增 API 端点：**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/user/admin/verification/:id` | 获取指定用户的实名认证信息（完整） |
| PUT | `/api/user/admin/verification/:id` | 更新/添加用户实名认证信息 |
| DELETE | `/api/user/admin/verification/:id` | 清除用户实名认证信息 |

**Controller 函数：**
在 `controller/verification.go` 中新增：
- `GetVerificationByAdmin(c *gin.Context)`
- `UpdateVerificationByAdmin(c *gin.Context)`
- `DeleteVerificationByAdmin(c *gin.Context)`

**路由注册：**
在 `router/api-router.go` 的管理员路由组中添加：
```go
adminGroup.GET("/user/admin/verification/:id", controller.GetVerificationByAdmin)
adminGroup.PUT("/user/admin/verification/:id", controller.UpdateVerificationByAdmin)
adminGroup.DELETE("/user/admin/verification/:id", controller.DeleteVerificationByAdmin)
```

## 3. UI/UX 设计

### 3.1 UserVerificationModal 组件

**组件类型：** SideSheet 侧边抽屉（与 UserSubscriptionsModal 保持一致）

**宽度：**
- 桌面端：600px
- 移动端：100%

### 3.2 界面状态

#### 状态一：已认证用户 - 查看模式

**标题栏：**
```
[管理] 用户实名认证管理  张三 (ID: 123)
```

**内容区：**
- ✓ 已认证标签（绿色 Tag）
- 信息卡片：
  - 姓名：张三
  - 身份证号：`**************1234` [👁️ 显示完整]
  - 认证时间：2026-03-15 10:30:00

**操作按钮：**
- `[编辑信息]` - 进入编辑模式
- `[清除认证]` - 危险操作（红色按钮）

#### 状态二：未认证用户

**内容区：**
- 信息 Banner："该用户尚未进行实名认证"

**操作按钮：**
- `[添加认证信息]` - 显示表单

#### 状态三：编辑/添加模式

**表单字段：**

1. **真实姓名** (Input)
   - 验证规则：必填，2-20 字符
   - 占位符："请输入真实姓名"

2. **身份证号** (Input)
   - 验证规则：必填，18 位，格式校验 + 校验码验证
   - 占位符："请输入18位身份证号"
   - maxLength: 18

3. **认证状态** (Select)
   - 选项：
     - 未认证 (0)
     - 已认证 (2)

**表单底部按钮：**
- `[取消]` - 返回查看模式
- `[保存]` - 提交修改

### 3.3 交互细节

**身份证号显示/隐藏：**
- 默认状态：`**************1234` + [👁️ 显示完整] 按钮
- 点击后：`110101199001011234` + [👁️ 隐藏] 按钮
- 使用 Semi Design 的 IconEyeOpened / IconEyeClosed

**清除认证二次确认：**
```
Modal.confirm({
  title: "确认清除实名认证",
  content: "清除后该用户的所有实名认证信息将被永久删除，用户可重新提交认证。是否继续？",
  okType: "danger",
  okText: "确认清除",
  cancelText: "取消"
})
```

**加载状态：**
- Modal 打开时显示 Spin 加载动画
- 提交按钮显示 loading 状态

## 4. 数据流设计

### 4.1 前端数据流

**打开 Modal 流程：**
```
1. 用户点击"实名认证"菜单项
2. UsersTable 触发 showUserVerificationModal(record)
3. 设置 selectedUser 状态，打开 Modal (visible=true)
4. UserVerificationModal useEffect 检测到 visible=true
5. 自动调用 loadVerificationInfo(userId) 加载数据
```

**状态管理：**
```javascript
const [visible, setVisible] = useState(false);
const [selectedUser, setSelectedUser] = useState(null);
const [loading, setLoading] = useState(false);
const [submitting, setSubmitting] = useState(false);
const [editMode, setEditMode] = useState(false);
const [showFullIdCard, setShowFullIdCard] = useState(false);
const [verificationData, setVerificationData] = useState(null);
```

### 4.2 API 请求/响应格式

#### GET /api/user/admin/verification/:id

**请求：**
```
GET /api/user/admin/verification/123
Authorization: Bearer <token>
```

**响应（已认证）：**
```json
{
  "success": true,
  "data": {
    "status": 2,
    "real_name": "张三",
    "id_card_number": "110101199001011234",
    "verification_time": "2026-03-15T10:30:00Z"
  }
}
```

**响应（未认证）：**
```json
{
  "success": true,
  "data": {
    "status": 0,
    "real_name": "",
    "id_card_number": "",
    "verification_time": null
  }
}
```

#### PUT /api/user/admin/verification/:id

**请求：**
```json
{
  "real_name": "张三",
  "id_card_number": "110101199001011234",
  "status": 2
}
```

**响应：**
```json
{
  "success": true,
  "message": "更新成功"
}
```

#### DELETE /api/user/admin/verification/:id

**请求：**
```
DELETE /api/user/admin/verification/123
```

**响应：**
```json
{
  "success": true,
  "message": "已清除实名认证信息"
}
```

### 4.3 后端数据处理

**GetVerificationByAdmin:**
```go
func GetVerificationByAdmin(c *gin.Context) {
    userId, err := strconv.Atoi(c.Param("id"))
    if err != nil {
        common.ApiErrorI18n(c, i18n.MsgInvalidParams)
        return
    }

    user, err := model.GetUserById(userId, true)
    if err != nil {
        common.ApiErrorI18n(c, i18n.MsgUserVerificationNotFound)
        return
    }

    response := RealNameVerificationResponse{
        Status:           user.VerificationStatus,
        RealName:         user.RealName,
        IdCardNumber:     user.IdCardNumber, // 完整身份证号
        VerificationTime: user.VerificationTime,
    }

    common.ApiSuccess(c, response)
}
```

**UpdateVerificationByAdmin:**
```go
type UpdateVerificationRequest struct {
    RealName     string `json:"real_name" binding:"required,min=2,max=20"`
    IdCardNumber string `json:"id_card_number" binding:"required,len=18"`
    Status       int    `json:"status" binding:"required,oneof=0 2"`
}

func UpdateVerificationByAdmin(c *gin.Context) {
    userId, err := strconv.Atoi(c.Param("id"))
    if err != nil {
        common.ApiErrorI18n(c, i18n.MsgInvalidParams)
        return
    }

    var req UpdateVerificationRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        common.ApiErrorI18n(c, i18n.MsgInvalidParams)
        return
    }

    // 验证身份证号格式
    if !validateIdCard(req.IdCardNumber) {
        common.ApiErrorI18n(c, i18n.MsgUserVerificationInvalidIdCard)
        return
    }

    user, err := model.GetUserById(userId, true)
    if err != nil {
        common.ApiErrorI18n(c, i18n.MsgUserVerificationNotFound)
        return
    }

    // 更新用户信息
    now := time.Now()
    user.RealName = req.RealName
    user.IdCardNumber = req.IdCardNumber
    user.VerificationStatus = req.Status
    user.VerificationTime = &now

    if err := model.DB.Save(user).Error; err != nil {
        common.ApiError(c, err)
        return
    }

    common.ApiSuccessI18n(c, i18n.MsgUserVerificationUpdateSuccess, nil)
}
```

**DeleteVerificationByAdmin:**
```go
func DeleteVerificationByAdmin(c *gin.Context) {
    userId, err := strconv.Atoi(c.Param("id"))
    if err != nil {
        common.ApiErrorI18n(c, i18n.MsgInvalidParams)
        return
    }

    user, err := model.GetUserById(userId, true)
    if err != nil {
        common.ApiErrorI18n(c, i18n.MsgUserVerificationNotFound)
        return
    }

    // 清除实名认证信息
    user.RealName = ""
    user.IdCardNumber = ""
    user.VerificationStatus = 0
    user.VerificationTime = nil

    if err := model.DB.Save(user).Error; err != nil {
        common.ApiError(c, err)
        return
    }

    common.ApiSuccessI18n(c, i18n.MsgUserVerificationDeleteSuccess, nil)
}
```

## 5. 错误处理

### 5.1 前端错误处理

**API 请求错误：**
- 网络错误：`showError(t('请求失败，请检查网络'))`
- 权限不足：显示后端返回的错误信息
- 用户不存在：`showError(t('用户不存在'))`

**表单验证错误：**
| 情况 | 错误消息 |
|------|----------|
| 姓名为空 | `t('请输入真实姓名')` |
| 姓名长度不符 | `t('姓名长度为2-20个字符')` |
| 身份证号为空 | `t('请输入身份证号')` |
| 身份证号格式错误 | `t('身份证号格式不正确')` |
| 身份证号校验码错误 | `t('身份证号格式不正确')` |

**防重复提交：**
- 使用 `submitting` 状态在提交时禁用按钮
- 使用 `loading` 状态防止并发请求

### 5.2 后端错误处理

**参数验证：**
- 用户 ID 不存在：返回 404 + i18n.MsgUserVerificationNotFound
- 姓名/身份证号格式错误：返回 400 + i18n.MsgInvalidParams
- 身份证号校验失败：返回 400 + i18n.MsgUserVerificationInvalidIdCard
- 状态值非法（不是 0 或 2）：返回 400 + i18n.MsgInvalidParams

**边界情况：**
1. **用户已删除**：返回 404，不允许操作
2. **并发修改**：使用 GORM 事务确保数据一致性
3. **清除未认证用户**：允许操作，返回成功（幂等操作）

**权限检查：**
- AdminAuth 中间件确保 role >= 10
- 无需额外的权限检查逻辑

### 5.3 用户体验优化

**成功反馈：**
- 更新成功：`showSuccess(t('更新成功'))`，自动刷新数据，切换到查看模式
- 清除成功：`showSuccess(t('已清除实名认证信息'))`，刷新数据显示未认证状态
- 添加成功：`showSuccess(t('添加成功'))`，切换到查看模式

**二次确认：**
- 清除操作：必须通过 Modal.confirm 确认
- 取消编辑：直接返回查看模式（简化实现）

## 6. 国际化支持

### 6.1 前端国际化

需要在以下文件中添加翻译键：
```
/web/src/i18n/locales/zh-CN.json
/web/src/i18n/locales/zh-TW.json
/web/src/i18n/locales/en.json
/web/src/i18n/locales/ja.json
/web/src/i18n/locales/fr.json
/web/src/i18n/locales/ru.json
/web/src/i18n/locales/vi.json
```

**新增翻译键（简体中文示例）：**
```json
{
  "实名认证": "实名认证",
  "用户实名认证管理": "用户实名认证管理",
  "该用户尚未进行实名认证": "该用户尚未进行实名认证",
  "添加认证信息": "添加认证信息",
  "编辑信息": "编辑信息",
  "清除认证": "清除认证",
  "显示完整": "显示完整",
  "隐藏": "隐藏",
  "认证状态": "认证状态",
  "确认清除实名认证": "确认清除实名认证",
  "清除后该用户的所有实名认证信息将被永久删除，用户可重新提交认证。是否继续？": "清除后该用户的所有实名认证信息将被永久删除，用户可重新提交认证。是否继续？",
  "确认清除": "确认清除",
  "已清除实名认证信息": "已清除实名认证信息",
  "用户不存在": "用户不存在"
}
```

### 6.2 后端国际化

**在 `/i18n/keys.go` 中添加：**
```go
const (
    // ... 现有的键
    MsgUserVerificationNotFound          = "user_verification_not_found"
    MsgUserVerificationUpdateSuccess     = "user_verification_update_success"
    MsgUserVerificationDeleteSuccess     = "user_verification_delete_success"
    MsgUserVerificationPermissionDenied  = "user_verification_permission_denied"
)
```

**在各语言的 YAML 文件中添加翻译：**

`/i18n/locales/zh-CN.yaml`:
```yaml
user_verification_not_found: "用户不存在或未认证"
user_verification_update_success: "更新实名认证信息成功"
user_verification_delete_success: "已清除实名认证信息"
user_verification_permission_denied: "无权限操作该用户的实名认证"
```

同样需要为 zh-TW, en, ja, fr, ru, vi 添加对应翻译。

## 7. 测试策略

### 7.1 功能测试清单

**菜单入口测试：**
- [ ] "订阅管理"下方显示"实名认证"菜单项
- [ ] 点击后正确打开 SideSheet

**已认证用户查看：**
- [ ] 显示认证信息卡片（姓名、身份证号、认证时间）
- [ ] 身份证号默认脱敏显示（后4位）
- [ ] 点击"显示完整"后显示完整身份证号
- [ ] 再次点击"隐藏"恢复脱敏

**未认证用户查看：**
- [ ] 显示"尚未进行实名认证"提示
- [ ] 显示"添加认证信息"按钮

**编辑已认证用户：**
- [ ] 点击"编辑信息"进入表单模式
- [ ] 表单预填充现有数据
- [ ] 修改姓名、身份证号、状态后保存
- [ ] 保存成功后刷新显示新数据
- [ ] 点击"取消"返回查看模式

**添加未认证用户信息：**
- [ ] 点击"添加认证信息"显示表单
- [ ] 填写完整信息（姓名、身份证号、状态）后保存
- [ ] 保存成功后切换到查看模式

**清除认证：**
- [ ] 点击"清除认证"弹出确认对话框
- [ ] 点击"取消"关闭对话框，不执行操作
- [ ] 点击"确认清除"清除成功
- [ ] 清除后显示未认证状态

**表单验证：**
- [ ] 姓名为空时提示"请输入真实姓名"
- [ ] 姓名少于2字符时提示"姓名长度为2-20个字符"
- [ ] 姓名超过20字符时提示错误
- [ ] 身份证号为空时提示错误
- [ ] 身份证号格式错误时提示"身份证号格式不正确"
- [ ] 身份证号校验码错误时提示"身份证号格式不正确"

**权限测试：**
- [ ] 管理员（role=10）可以访问功能
- [ ] 超级管理员（role=100）可以访问功能
- [ ] 普通用户（role=1）调用管理员 API 返回 403

### 7.2 边界情况测试

- [ ] 用户不存在时返回404错误
- [ ] 网络错误时显示友好提示
- [ ] 已删除用户（DeletedAt != null）无法操作
- [ ] 清除未认证用户的认证信息（幂等操作）
- [ ] Modal 关闭后重新打开，数据正确刷新
- [ ] 身份证号包含小写 x 时正确转换为大写 X

### 7.3 兼容性测试

- [ ] 桌面端 SideSheet 宽度为 600px
- [ ] 移动端 SideSheet 宽度为 100%
- [ ] 深色模式下样式正常
- [ ] 多语言切换后文本正确显示（测试所有7种语言）
- [ ] 不同浏览器下正常工作（Chrome, Firefox, Safari, Edge）

### 7.4 性能测试

- [ ] Modal 打开速度 < 500ms
- [ ] API 请求响应时间 < 1s
- [ ] 加载状态正确显示，避免白屏

## 8. 实现清单

### 8.1 后端实现

**文件修改：**
1. `controller/verification.go`
   - [ ] 新增 `GetVerificationByAdmin` 函数
   - [ ] 新增 `UpdateVerificationByAdmin` 函数
   - [ ] 新增 `DeleteVerificationByAdmin` 函数
   - [ ] 新增 `UpdateVerificationRequest` 结构体

2. `router/api-router.go`
   - [ ] 注册 GET `/api/user/admin/verification/:id` 路由
   - [ ] 注册 PUT `/api/user/admin/verification/:id` 路由
   - [ ] 注册 DELETE `/api/user/admin/verification/:id` 路由

3. `i18n/keys.go`
   - [ ] 添加新的国际化键常量

4. `i18n/locales/*.yaml`
   - [ ] zh-CN.yaml 添加中文翻译
   - [ ] zh-TW.yaml 添加繁体中文翻译
   - [ ] en.yaml 添加英文翻译
   - [ ] ja.yaml 添加日文翻译
   - [ ] fr.yaml 添加法文翻译
   - [ ] ru.yaml 添加俄文翻译
   - [ ] vi.yaml 添加越南文翻译

### 8.2 前端实现

**新建文件：**
1. `web/src/components/table/users/modals/UserVerificationModal.jsx`
   - [ ] 创建主组件
   - [ ] 实现查看模式（已认证/未认证）
   - [ ] 实现编辑/添加模式
   - [ ] 实现身份证号显示/隐藏切换
   - [ ] 实现表单验证逻辑
   - [ ] 实现 API 调用（获取、更新、删除）
   - [ ] 实现加载和提交状态管理

**修改文件：**
2. `web/src/components/table/users/UsersColumnDefs.jsx`
   - [ ] 在 `moreMenu` 中添加"实名认证"菜单项
   - [ ] 添加 `showUserVerificationModal` 回调参数
   - [ ] 在菜单项 onClick 中调用回调

3. `web/src/components/table/users/UsersTable.jsx`
   - [ ] 添加 `showUserVerificationModal` 状态
   - [ ] 添加 `selectedUserForVerification` 状态
   - [ ] 实现 `showUserVerificationModal` 函数
   - [ ] 渲染 `UserVerificationModal` 组件
   - [ ] 传递必要的 props（visible, user, onCancel, onSuccess）

4. `web/src/i18n/locales/*.json`
   - [ ] zh-CN.json 添加中文翻译
   - [ ] zh-TW.json 添加繁体中文翻译
   - [ ] en.json 添加英文翻译
   - [ ] ja.json 添加日文翻译
   - [ ] fr.json 添加法文翻译
   - [ ] ru.json 添加俄文翻译
   - [ ] vi.json 添加越南文翻译

## 9. 安全考虑

### 9.1 权限控制

- 所有管理员 API 端点使用 `AdminAuth()` 中间件保护
- 仅允许 role >= 10 的用户访问
- 前端菜单项对所有管理员可见（依赖后端权限控制）

### 9.2 数据安全

- 身份证号在管理端 API 返回完整信息（管理员需要完整数据）
- 前端默认脱敏显示，需要点击按钮才显示完整信息
- 使用 HTTPS 传输敏感数据
- 不在日志中记录完整身份证号

### 9.3 输入验证

- 前端和后端都进行身份证号格式验证
- 后端使用 binding tags 确保数据完整性
- 身份证号校验码验证（ISO 7064:1983 Mod 11-2）

### 9.4 审计日志

- 建议：在后续版本中添加操作日志记录
- 记录内容：操作类型（查看/编辑/清除）、操作时间、操作管理员 ID、目标用户 ID

## 10. 未来扩展

### 10.1 可能的功能扩展

1. **审批流程**
   - 添加"待审核"状态
   - 管理员审核用户提交的认证信息
   - 审核通过/拒绝操作

2. **历史记录**
   - 记录认证信息的修改历史
   - 显示谁在什么时间修改了什么

3. **批量操作**
   - 批量清除认证
   - 批量导出认证信息

4. **高级搜索**
   - 在用户列表中按认证状态筛选
   - 按认证时间范围筛选

5. **OCR 识别**
   - 上传身份证照片自动识别信息
   - 人脸识别验证

### 10.2 可扩展性设计

- API 端点设计预留扩展空间
- 前端组件采用模块化设计，便于添加新功能
- 数据库字段预留足够空间

## 11. 总结

本设计方案采用完全独立的管理界面架构，将管理端和用户端分离，确保：

1. **职责清晰**：管理功能独立实现，不影响用户端
2. **安全可靠**：管理员 API 独立，权限控制严格
3. **易于维护**：代码结构清晰，便于后续扩展
4. **用户体验好**：与现有订阅管理风格一致，学习成本低

实现后将为管理员提供完整的实名认证管理能力，提升平台的运营管理效率。
