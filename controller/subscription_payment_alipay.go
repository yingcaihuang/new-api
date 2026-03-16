package controller

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/smartwalle/alipay/v3"
)

type SubscriptionAlipayPayRequest struct {
	PlanId int `json:"plan_id"`
}

// SubscriptionRequestAlipayPay 发起支付宝订阅支付
func SubscriptionRequestAlipayPay(c *gin.Context) {
	var req SubscriptionAlipayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	// 获取套餐信息
	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorMsg(c, "套餐未启用")
		return
	}
	if plan.PriceAmount < 0.01 {
		common.ApiErrorMsg(c, "套餐金额过低")
		return
	}

	// 检查支付宝配置
	if !setting.AlipayEnabled || setting.AlipayAppID == "" || setting.AlipayPrivateKey == "" {
		common.ApiErrorMsg(c, "支付宝未启用或配置不完整")
		return
	}

	userId := c.GetInt("id")

	// 检查购买限制
	if plan.MaxPurchasePerUser > 0 {
		count, err := model.CountUserSubscriptionsByPlan(userId, plan.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			common.ApiErrorMsg(c, "已达到该套餐购买上限")
			return
		}
	}

	// 生成订单号
	tradeNo := fmt.Sprintf("SUBUSR%dNO%s%d", userId, common.GetRandomString(6), time.Now().Unix())

	// 初始化支付宝客户端
	isProduction := setting.AlipayServerURL == "https://openapi.alipay.com/gateway.do"
	client, err := alipay.New(setting.AlipayAppID, setting.AlipayPrivateKey, isProduction)
	if err != nil {
		log.Println("初始化支付宝客户端失败:", err)
		common.ApiErrorMsg(c, "当前管理员未配置支付宝支付信息")
		return
	}

	// 如果配置了支付宝公钥，加载公钥用于验签
	if setting.AlipayPublicKey != "" {
		// 先尝试证书模式
		err = client.LoadAlipayCertPublicKey(setting.AlipayPublicKey)
		if err != nil {
			// 证书模式失败，尝试普通公钥模式
			log.Println("证书模式加载失败，尝试普通公钥模式:", err)
			err = client.LoadAliPayPublicKey(setting.AlipayPublicKey)
			if err != nil {
				log.Println("加载支付宝公钥失败:", err)
				common.ApiErrorMsg(c, "支付宝公钥配置错误")
				return
			}
		}
	}

	// 获取回调地址
	callBackAddress := system_setting.ServerAddress
	notifyUrl := callBackAddress + "/api/subscription/alipay/notify"

	// 创建扫码支付参数
	var p alipay.TradePreCreate
	p.NotifyURL = notifyUrl
	p.OutTradeNo = tradeNo
	p.TotalAmount = strconv.FormatFloat(plan.PriceAmount, 'f', 2, 64)
	p.Subject = fmt.Sprintf("订阅:%s", plan.Title)

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

	// 创建订阅订单
	order := &model.SubscriptionOrder{
		UserId:        userId,
		PlanId:        plan.Id,
		Money:         plan.PriceAmount,
		TradeNo:       tradeNo,
		PaymentMethod: PaymentMethodAlipay,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	err = order.Insert()
	if err != nil {
		log.Println("创建订单失败:", err)
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}

	// 返回二维码URL
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"trade_no":    tradeNo,
			"qr_code_url": payResult.QRCode,
		},
	})
}

// SubscriptionAlipayNotify 支付宝订阅支付异步通知回调
func SubscriptionAlipayNotify(c *gin.Context) {
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
	isProduction := setting.AlipayServerURL == "https://openapi.alipay.com/gateway.do"
	client, err := alipay.New(setting.AlipayAppID, setting.AlipayPrivateKey, isProduction)
	if err != nil {
		log.Println("初始化支付宝客户端失败:", err)
		c.String(200, "fail")
		return
	}

	// 如果配置了支付宝公钥，加载公钥用于验签
	if setting.AlipayPublicKey != "" {
		// 先尝试证书模式
		err = client.LoadAlipayCertPublicKey(setting.AlipayPublicKey)
		if err != nil {
			// 证书模式失败，尝试普通公钥模式
			log.Println("证书模式加载失败，尝试普通公钥模式:", err)
			err = client.LoadAliPayPublicKey(setting.AlipayPublicKey)
			if err != nil {
				log.Println("加载支付宝公钥失败:", err)
				c.String(200, "fail")
				return
			}
		}
	}

	// 验证签名
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
	order := model.GetSubscriptionOrderByTradeNo(tradeNo)
	if order == nil {
		log.Println("支付宝回调订单不存在:", tradeNo)
		c.String(200, "fail")
		return
	}

	// 如果已经处理过，直接返回成功
	if order.Status == common.TopUpStatusSuccess {
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

	if !compareFloat(payMoney, order.Money) {
		log.Printf("支付宝回调金额不匹配: 期望 %.2f, 实际 %.2f", order.Money, payMoney)
		c.String(200, "fail")
		return
	}

	// 完成订单
	err = model.CompleteSubscriptionOrder(tradeNo, common.GetJsonString(params))
	if err != nil {
		log.Println("完成订阅订单失败:", err)
		c.String(200, "fail")
		return
	}

	log.Printf("用户 %d 使用支付宝订阅套餐 %d 成功，订单号: %s", order.UserId, order.PlanId, tradeNo)

	// 返回success给支付宝
	c.String(200, "success")
}

// SubscriptionQueryAlipayOrder 查询支付宝订阅订单状态
func SubscriptionQueryAlipayOrder(c *gin.Context) {
	tradeNo := c.Query("trade_no")
	if tradeNo == "" {
		common.ApiErrorMsg(c, "订单号不能为空")
		return
	}

	// 查询本地订单
	order := model.GetSubscriptionOrderByTradeNo(tradeNo)
	if order == nil {
		common.ApiErrorMsg(c, "订单不存在")
		return
	}

	// 如果已经是成功状态，直接返回
	if order.Status == common.TopUpStatusSuccess {
		common.ApiSuccess(c, gin.H{"status": "success"})
		return
	}

	// 如果不是待支付状态，直接返回当前状态
	if order.Status != common.TopUpStatusPending {
		common.ApiSuccess(c, gin.H{"status": order.Status})
		return
	}

	// 初始化支付宝客户端
	isProduction := setting.AlipayServerURL == "https://openapi.alipay.com/gateway.do"
	client, err := alipay.New(setting.AlipayAppID, setting.AlipayPrivateKey, isProduction)
	if err != nil {
		log.Println("初始化支付宝客户端失败:", err)
		common.ApiErrorMsg(c, "支付宝配置错误")
		return
	}

	// 如果配置了支付宝公钥，加载公钥用于验签
	if setting.AlipayPublicKey != "" {
		// 先尝试证书模式
		err = client.LoadAlipayCertPublicKey(setting.AlipayPublicKey)
		if err != nil {
			// 证书模式失败，尝试普通公钥模式
			log.Println("证书模式加载失败，尝试普通公钥模式:", err)
			err = client.LoadAliPayPublicKey(setting.AlipayPublicKey)
			if err != nil {
				log.Println("加载支付宝公钥失败:", err)
				common.ApiErrorMsg(c, "支付宝公钥配置错误")
				return
			}
		}
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
	if queryResult.TradeStatus == "TRADE_SUCCESS" || queryResult.TradeStatus == "TRADE_FINISHED" {
		// 加锁防止并发
		LockOrder(tradeNo)
		defer UnlockOrder(tradeNo)

		// 再次检查订单状态（防止重复处理）
		order = model.GetSubscriptionOrderByTradeNo(tradeNo)
		if order.Status == common.TopUpStatusSuccess {
			common.ApiSuccess(c, gin.H{"status": "success"})
			return
		}

		// 验证金额
		payMoney, _ := strconv.ParseFloat(queryResult.TotalAmount, 64)
		if !compareFloat(payMoney, order.Money) {
			log.Printf("支付宝回调金额不匹配: 期望 %.2f, 实际 %.2f", order.Money, payMoney)
			common.ApiErrorMsg(c, "订单金额不匹配")
			return
		}

		// 完成订单
		err = model.CompleteSubscriptionOrder(tradeNo, common.GetJsonString(queryResult))
		if err != nil {
			log.Println("完成订阅订单失败:", err)
			common.ApiErrorMsg(c, "完成订单失败")
			return
		}

		common.ApiSuccess(c, gin.H{"status": "success"})
		return
	}

	// 其他状态返回pending
	common.ApiSuccess(c, gin.H{"status": "pending"})
}
