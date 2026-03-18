package controller

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/url"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/smartwalle/alipay/v3"
)

const (
	PaymentMethodAlipay = "alipay_official"
)

type AlipayPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
}

// initAlipayClient 初始化支付宝客户端
func initAlipayClient() (*alipay.Client, error) {
	if !setting.AlipayEnabled || setting.AlipayAppID == "" || setting.AlipayPrivateKey == "" {
		return nil, errors.New("支付宝未启用或配置不完整")
	}

	// 判断是否为生产环境
	isProduction := setting.AlipayServerURL == "https://openapi.alipay.com/gateway.do"

	client, err := alipay.New(setting.AlipayAppID, setting.AlipayPrivateKey, isProduction)
	if err != nil {
		return nil, err
	}

	// 如果配置了支付宝公钥，加载公钥用于验签
	// 支持两种模式：证书模式和普通公钥模式
	if setting.AlipayPublicKey != "" {
		// 先尝试证书模式
		err = client.LoadAlipayCertPublicKey(setting.AlipayPublicKey)
		if err != nil {
			// 证书模式失败，尝试普通公钥模式
			log.Println("证书模式加载失败，尝试普通公钥模式:", err)
			err = client.LoadAliPayPublicKey(setting.AlipayPublicKey)
			if err != nil {
				return nil, fmt.Errorf("加载支付宝公钥失败（尝试了证书模式和普通模式）: %v", err)
			}
		}
	}

	return client, nil
}

// RequestAlipayPay 发起支付宝支付（扫码支付）
func RequestAlipayPay(c *gin.Context) {
	var req AlipayPayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	if req.PaymentMethod != PaymentMethodAlipay {
		common.ApiErrorMsg(c, "不支持的支付方式")
		return
	}

	// 检查最低充值金额
	if req.Amount < int64(setting.AlipayMinTopUp) {
		common.ApiErrorMsg(c, fmt.Sprintf("充值数量不能小于 %d", setting.AlipayMinTopUp))
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

	// 计算支付金额
	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		common.ApiErrorMsg(c, "充值金额过低")
		return
	}

	// 生成订单号
	tradeNo := fmt.Sprintf("USR%dNO%s%d", id, common.GetRandomString(6), time.Now().Unix())

	// 初始化支付宝客户端
	client, err := initAlipayClient()
	if err != nil {
		log.Println("初始化支付宝客户端失败:", err)
		common.ApiErrorMsg(c, "当前管理员未配置支付宝支付信息")
		return
	}

	// 获取回调地址
	callBackAddress := system_setting.ServerAddress
	notifyUrl := callBackAddress + "/api/alipay/notify"

	// 创建扫码支付参数（预创建交易）
	var p alipay.TradePreCreate
	p.NotifyURL = notifyUrl
	p.OutTradeNo = tradeNo
	p.TotalAmount = strconv.FormatFloat(payMoney, 'f', 2, 64)
	p.Subject = fmt.Sprintf("充值%d", req.Amount)
	// p.TimeoutExpress = "15m" // 交易超时时间

	// 发起支付
	ctx := context.Background()
	payResult, err := client.TradePreCreate(ctx, p)
	if err != nil {
		log.Println("调用支付宝支付失败:", err)
		common.ApiErrorMsg(c, "拉起支付失败")
		return
	}

	// 检查支付结果
	if payResult.Code != alipay.CodeSuccess {
		log.Printf("支付宝支付失败: code=%s, msg=%s, subCode=%s, subMsg=%s",
			payResult.Code, payResult.Msg, payResult.SubCode, payResult.SubMsg)
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
		PaymentMethod: PaymentMethodAlipay,
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
	// QRCode 是用于生成二维码的内容
	common.ApiSuccess(c, gin.H{
		"trade_no":    tradeNo,
		"qr_code_url": payResult.QRCode,
		"amount":      payMoney,
	})
}

// QueryAlipayOrder 查询支付宝订单状态（用于前端轮询）
func QueryAlipayOrder(c *gin.Context) {
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

	// 初始化支付宝客户端
	client, err := initAlipayClient()
	if err != nil {
		log.Println("初始化支付宝客户端失败:", err)
		common.ApiErrorMsg(c, "支付宝配置错误")
		return
	}

	// 查询支付宝订单状态
	var queryP alipay.TradeQuery
	queryP.OutTradeNo = tradeNo

	ctx := context.Background()
	queryResult, err := client.TradeQuery(ctx, queryP)
	if err != nil {
		log.Println("查询支付宝订单失败:", err)
		common.ApiErrorMsg(c, "查询订单失败")
		return
	}

	// 检查查询结果
	if queryResult.Code != alipay.CodeSuccess {
		log.Printf("查询支付宝订单失败: code=%s, msg=%s", queryResult.Code, queryResult.Msg)
		common.ApiSuccess(c, gin.H{"status": "pending"})
		return
	}

	// 检查交易状态
	// TRADE_SUCCESS: 交易支付成功
	// TRADE_FINISHED: 交易结束，不可退款
	if queryResult.TradeStatus == "TRADE_SUCCESS" || queryResult.TradeStatus == "TRADE_FINISHED" {
		// 加锁防止并发
		LockOrder(tradeNo)
		defer UnlockOrder(tradeNo)

		// 再次检查订单状态（防止重复处理）
		topUp = model.GetTopUpByTradeNo(tradeNo)
		if topUp.Status == common.TopUpStatusSuccess {
			common.ApiSuccess(c, gin.H{"status": "success"})
			return
		}

		// 验证金额
		payMoney, _ := strconv.ParseFloat(queryResult.TotalAmount, 64)
		if !compareFloat(payMoney, topUp.Money) {
			log.Printf("支付宝回调金额不匹配: 期望 %.2f, 实际 %.2f", topUp.Money, payMoney)
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

// AlipayNotify 支付宝异步通知回调
func AlipayNotify(c *gin.Context) {
	// 读取通知内容
	var params url.Values

	if c.Request.Method == "POST" {
		// POST 请求：从 POST body 解析参数
		if err := c.Request.ParseForm(); err != nil {
			log.Println("支付宝回调POST解析失败:", err)
			c.String(200, "fail")
			return
		}
		params = c.Request.PostForm
	} else {
		// GET 请求：从 URL Query 解析参数
		params = c.Request.URL.Query()
	}

	// 初始化支付宝客户端用于验证签名
	client, err := initAlipayClient()
	if err != nil {
		log.Println("初始化支付宝客户端失败:", err)
		c.String(200, "fail")
		return
	}

	// 验证签名
	// 注意：必须验证签名，防止伪造通知
	ctx := context.Background()
	err = client.VerifySign(ctx, params)
	if err != nil {
		log.Println("支付宝签名验证失败:", err)
		c.String(200, "fail")
		return
	}

	// 获取订单号
	tradeNo := params.Get("out_trade_no")
	if tradeNo == "" {
		log.Println("支付宝回调缺少订单号")
		c.String(200, "fail")
		return
	}

	// 获取交易状态
	tradeStatus := params.Get("trade_status")
	if tradeStatus != "TRADE_SUCCESS" && tradeStatus != "TRADE_FINISHED" {
		log.Printf("支付宝回调交易状态未成功: %s", tradeStatus)
		c.String(200, "success")
		return
	}

	// 加锁防止并发
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	// 查询本地订单
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		log.Println("支付宝回调订单不存在:", tradeNo)
		c.String(200, "fail")
		return
	}

	// 如果已经处理过，直接返回成功
	if topUp.Status == common.TopUpStatusSuccess {
		c.String(200, "success")
		return
	}

	// 验证金额
	totalAmount := params.Get("total_amount")
	payMoney, err := strconv.ParseFloat(totalAmount, 64)
	if err != nil {
		log.Println("支付宝回调金额解析失败:", err)
		c.String(200, "fail")
		return
	}

	if !compareFloat(payMoney, topUp.Money) {
		log.Printf("支付宝回调金额不匹配: 期望 %.2f, 实际 %.2f", topUp.Money, payMoney)
		c.String(200, "fail")
		return
	}

	// 更新订单状态
	topUp.Status = common.TopUpStatusSuccess
	topUp.CompleteTime = time.Now().Unix()
	err = topUp.Update()
	if err != nil {
		log.Println("更新支付宝订单状态失败:", err)
		c.String(200, "fail")
		return
	}

	// 增加用户额度
	quotaToAdd := int(decimal.NewFromInt(topUp.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart())
	err = model.IncreaseUserQuota(topUp.UserId, quotaToAdd, true)
	if err != nil {
		log.Println("增加用户额度失败:", err)
	}

	log.Printf("用户 %d 支付宝充值 %d 成功，订单号: %s", topUp.UserId, topUp.Amount, tradeNo)

	// 返回success给支付宝
	c.String(200, "success")
}

// compareFloat 比较两个浮点数是否相等（精度为0.01）
func compareFloat(f1, f2 float64) bool {
	diff := f1 - f2
	if diff < 0 {
		diff = -diff
	}
	return diff < 0.01
}
