package controller

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/wechatpay-apiv3/wechatpay-go/core"
	"github.com/wechatpay-apiv3/wechatpay-go/core/notify"
	"github.com/wechatpay-apiv3/wechatpay-go/core/option"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments/native"
	"github.com/wechatpay-apiv3/wechatpay-go/utils"
)

const (
	PaymentMethodWechat = "wechat_official"
)

type WechatPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
}

// initWechatClient 初始化微信支付客户端
func initWechatClient() (*core.Client, error) {
	if !setting.WechatEnabled || setting.WechatMchID == "" || setting.WechatAPIv3Key == "" || setting.WechatPrivateKey == "" {
		return nil, errors.New("微信支付未启用或配置不完整")
	}

	// 加载商户私钥
	mchPrivateKey, err := utils.LoadPrivateKey(setting.WechatPrivateKey)
	if err != nil {
		return nil, fmt.Errorf("加载商户私钥失败: %v", err)
	}

	// 初始化客户端
	ctx := context.Background()
	client, err := core.NewClient(
		ctx,
		option.WithWechatPayAutoAuthCipher(
			setting.WechatMchID,
			setting.WechatSerialNo,
			mchPrivateKey,
			setting.WechatAPIv3Key,
		),
	)
	if err != nil {
		return nil, fmt.Errorf("初始化微信支付客户端失败: %v", err)
	}

	return client, nil
}

// RequestWechatPay 发起微信支付（扫码支付）
func RequestWechatPay(c *gin.Context) {
	var req WechatPayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	if req.PaymentMethod != PaymentMethodWechat {
		common.ApiErrorMsg(c, "不支持的支付方式")
		return
	}

	// 检查最低充值金额
	if req.Amount < int64(setting.WechatMinTopUp) {
		common.ApiErrorMsg(c, fmt.Sprintf("充值数量不能小于 %d", setting.WechatMinTopUp))
		return
	}

	id := c.GetInt("id")

	// 实名认证检查
	if common.RealNameVerificationEnabled {
		log.Printf("实名认证检查: 开关已启用, 用户ID=%d", id)
		user, err := model.GetUserById(id, true)
		if err != nil {
			log.Printf("实名认证检查: 获取用户信息失败, 错误=%v", err)
			common.ApiErrorMsg(c, "获取用户信息失败")
			return
		}
		log.Printf("实名认证检查: 用户=%s, 认证状态=%d, 期望状态=%d", user.Username, user.VerificationStatus, model.VerificationStatusApproved)
		if user.VerificationStatus != model.VerificationStatusApproved {
			log.Printf("实名认证检查: 用户未通过实名认证, 拒绝充值请求")
			common.ApiErrorMsg(c, "请先完成实名认证后再使用充值功能")
			return
		}
		log.Printf("实名认证检查: 用户已通过实名认证, 允许充值")
	} else {
		log.Printf("实名认证检查: 开关未启用, 跳过检查")
	}

	// 获取用户组用于计算价格
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		common.ApiErrorMsg(c, "获取用户分组失败")
		return
	}

	// 计算支付金额（元）
	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		common.ApiErrorMsg(c, "充值金额过低")
		return
	}

	// 生成订单号
	tradeNo := fmt.Sprintf("USR%dNO%s%d", id, common.GetRandomString(6), time.Now().Unix())

	// 初始化微信支付客户端
	client, err := initWechatClient()
	if err != nil {
		log.Println("初始化微信支付客户端失败:", err)
		common.ApiErrorMsg(c, "当前管理员未配置微信支付信息")
		return
	}

	// 获取回调地址
	callBackAddress := system_setting.ServerAddress
	notifyUrl := callBackAddress + "/api/wechat/notify"

	// 创建Native支付参数
	svc := native.NativeApiService{Client: client}

	// 微信支付金额单位为分
	totalAmount := int64(payMoney * 100)

	ctx := context.Background()
	resp, _, err := svc.Prepay(ctx, native.PrepayRequest{
		Appid:       core.String(setting.WechatAppID),
		Mchid:       core.String(setting.WechatMchID),
		Description: core.String(fmt.Sprintf("充值%d", req.Amount)),
		OutTradeNo:  core.String(tradeNo),
		NotifyUrl:   core.String(notifyUrl),
		Amount: &native.Amount{
			Total:    core.Int64(totalAmount),
			Currency: core.String("CNY"),
		},
	})

	if err != nil {
		log.Println("调用微信支付失败:", err)
		common.ApiErrorMsg(c, "拉起支付失败")
		return
	}

	if resp.CodeUrl == nil {
		log.Println("微信支付返回的二维码地址为空")
		common.ApiErrorMsg(c, "创建支付订单失败")
		return
	}

	// 转换金额（如果是Token显示类型）
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(int64(amount))
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		amount = dAmount.Div(dQuotaPerUnit).IntPart()
	}

	// 创建充值订单
	topUp := &model.TopUp{
		UserId:        id,
		Amount:        amount,
		Money:         payMoney,
		TradeNo:       tradeNo,
		PaymentMethod: PaymentMethodWechat,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	err = topUp.Insert()
	if err != nil {
		log.Println("创建订单失败:", err)
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}

	// 返回二维码URL
	common.ApiSuccess(c, gin.H{
		"trade_no": tradeNo,
		"code_url": *resp.CodeUrl,
		"amount":   payMoney,
	})
}

// QueryWechatOrder 查询微信支付订单状态（用于前端轮询）
func QueryWechatOrder(c *gin.Context) {
	tradeNo := c.Query("trade_no")
	if tradeNo == "" {
		common.ApiErrorMsg(c, "订单号不能为空")
		return
	}

	// 查询本地订单
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		common.ApiErrorMsg(c, "订单不存在")
		return
	}

	// 如果已经是成功状态，直接返回
	if topUp.Status == common.TopUpStatusSuccess {
		common.ApiSuccess(c, gin.H{"status": "success"})
		return
	}

	// 如果不是待支付状态，直接返回当前状态
	if topUp.Status != common.TopUpStatusPending {
		common.ApiSuccess(c, gin.H{"status": topUp.Status})
		return
	}

	// 初始化微信支付客户端
	client, err := initWechatClient()
	if err != nil {
		log.Println("初始化微信支付客户端失败:", err)
		common.ApiErrorMsg(c, "微信支付配置错误")
		return
	}

	// 查询微信支付订单状态
	svc := native.NativeApiService{Client: client}
	ctx := context.Background()

	queryResp, _, err := svc.QueryOrderByOutTradeNo(ctx, native.QueryOrderByOutTradeNoRequest{
		OutTradeNo: core.String(tradeNo),
		Mchid:      core.String(setting.WechatMchID),
	})

	if err != nil {
		log.Println("查询微信支付订单失败:", err)
		common.ApiErrorMsg(c, "查询订单失败")
		return
	}

	// 检查交易状态
	// SUCCESS: 支付成功
	if queryResp.TradeState != nil && *queryResp.TradeState == "SUCCESS" {
		// 加锁防止并发
		LockOrder(tradeNo)
		defer UnlockOrder(tradeNo)

		// 再次检查订单状态（防止重复处理）
		topUp = model.GetTopUpByTradeNo(tradeNo)
		if topUp.Status == common.TopUpStatusSuccess {
			common.ApiSuccess(c, gin.H{"status": "success"})
			return
		}

		// 验证金额（微信支付金额单位为分，需要转换为元）
		if queryResp.Amount == nil || queryResp.Amount.Total == nil {
			log.Println("微信支付回调金额为空")
			common.ApiErrorMsg(c, "订单金额异常")
			return
		}
		payMoney := float64(*queryResp.Amount.Total) / 100.0
		if !compareFloat(payMoney, topUp.Money) {
			log.Printf("微信支付回调金额不匹配: 期望 %.2f, 实际 %.2f", topUp.Money, payMoney)
			common.ApiErrorMsg(c, "订单金额不匹配")
			return
		}

		// 更新订单状态
		topUp.Status = common.TopUpStatusSuccess
		topUp.CompleteTime = time.Now().Unix()
		err := topUp.Update()
		if err != nil {
			log.Println("更新订单状态失败:", err)
			common.ApiErrorMsg(c, "更新订单失败")
			return
		}

		// 增加用户额度
		quotaToAdd := int(decimal.NewFromInt(topUp.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart())
		err = model.IncreaseUserQuota(topUp.UserId, quotaToAdd, true)
		if err != nil {
			log.Println("增加用户额度失败:", err)
		}

		common.ApiSuccess(c, gin.H{"status": "success"})
		return
	}

	// 其他状态返回pending
	common.ApiSuccess(c, gin.H{"status": "pending"})
}

// WechatNotify 微信支付异步通知回调
func WechatNotify(c *gin.Context) {
	// 初始化通知处理器
	handler, err := notify.NewRSANotifyHandler(setting.WechatAPIv3Key, nil)
	if err != nil {
		log.Println("初始化微信通知处理器失败:", err)
		c.JSON(200, gin.H{"code": "FAIL", "message": "初始化失败"})
		return
	}

	// 解析并验证通知
	ctx := context.Background()
	transaction := new(payments.Transaction)
	_, err = handler.ParseNotifyRequest(ctx, c.Request, transaction)
	if err != nil {
		log.Println("微信支付签名验证失败:", err)
		c.JSON(200, gin.H{"code": "FAIL", "message": "签名验证失败"})
		return
	}

	// 获取订单号
	if transaction.OutTradeNo == nil {
		log.Println("微信支付回调缺少订单号")
		c.JSON(200, gin.H{"code": "FAIL", "message": "缺少订单号"})
		return
	}
	tradeNo := *transaction.OutTradeNo

	// 获取交易状态
	if transaction.TradeState == nil {
		log.Println("微信支付回调缺少交易状态")
		c.JSON(200, gin.H{"code": "FAIL", "message": "缺少交易状态"})
		return
	}

	tradeState := *transaction.TradeState
	if tradeState != "SUCCESS" {
		log.Printf("微信支付回调交易状态未成功: %s", tradeState)
		c.JSON(200, gin.H{"code": "SUCCESS", "message": "成功"})
		return
	}

	// 加锁防止并发
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	// 查询本地订单
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		log.Println("微信支付回调订单不存在:", tradeNo)
		c.JSON(200, gin.H{"code": "FAIL", "message": "订单不存在"})
		return
	}

	// 如果已经处理过，直接返回成功
	if topUp.Status == common.TopUpStatusSuccess {
		c.JSON(200, gin.H{"code": "SUCCESS", "message": "成功"})
		return
	}

	// 验证金额（微信支付金额单位为分，需要转换为元）
	if transaction.Amount == nil || transaction.Amount.Total == nil {
		log.Println("微信支付回调金额为空")
		c.JSON(200, gin.H{"code": "FAIL", "message": "金额为空"})
		return
	}

	payMoney := float64(*transaction.Amount.Total) / 100.0
	if !compareFloat(payMoney, topUp.Money) {
		log.Printf("微信支付回调金额不匹配: 期望 %.2f, 实际 %.2f", topUp.Money, payMoney)
		c.JSON(200, gin.H{"code": "FAIL", "message": "金额不匹配"})
		return
	}

	// 更新订单状态
	topUp.Status = common.TopUpStatusSuccess
	topUp.CompleteTime = time.Now().Unix()
	err = topUp.Update()
	if err != nil {
		log.Println("更新微信支付订单状态失败:", err)
		c.JSON(200, gin.H{"code": "FAIL", "message": "更新订单失败"})
		return
	}

	// 增加用户额度
	quotaToAdd := int(decimal.NewFromInt(topUp.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart())
	err = model.IncreaseUserQuota(topUp.UserId, quotaToAdd, true)
	if err != nil {
		log.Println("增加用户额度失败:", err)
	}

	log.Printf("用户 %d 微信支付充值 %d 成功，订单号: %s", topUp.UserId, topUp.Amount, tradeNo)

	// 返回成功给微信
	c.JSON(200, gin.H{"code": "SUCCESS", "message": "成功"})
}
