package controller

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/wechatpay-apiv3/wechatpay-go/core"
	"github.com/wechatpay-apiv3/wechatpay-go/core/notify"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments/native"
)

type SubscriptionWechatPayRequest struct {
	PlanId int `json:"plan_id"`
}

// SubscriptionRequestWechatPay 发起微信订阅支付
func SubscriptionRequestWechatPay(c *gin.Context) {
	var req SubscriptionWechatPayRequest
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

	// 检查微信支付配置
	if !setting.WechatEnabled || setting.WechatMchID == "" || setting.WechatAPIv3Key == "" || setting.WechatPrivateKey == "" {
		common.ApiErrorMsg(c, "微信支付未启用或配置不完整")
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

	// 初始化微信支付客户端
	client, err := initWechatClient()
	if err != nil {
		log.Println("初始化微信支付客户端失败:", err)
		common.ApiErrorMsg(c, "当前管理员未配置微信支付信息")
		return
	}

	// 获取回调地址
	callBackAddress := system_setting.ServerAddress
	notifyUrl := callBackAddress + "/api/subscription/wechat/notify"

	// 创建Native支付参数
	svc := native.NativeApiService{Client: client}

	// 微信支付金额单位为分
	totalAmount := int64(plan.PriceAmount * 100)

	ctx := context.Background()
	resp, _, err := svc.Prepay(ctx, native.PrepayRequest{
		Appid:       core.String(setting.WechatAppID),
		Mchid:       core.String(setting.WechatMchID),
		Description: core.String(fmt.Sprintf("订阅:%s", plan.Title)),
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

	// 创建订阅订单
	order := &model.SubscriptionOrder{
		UserId:        userId,
		PlanId:        plan.Id,
		Money:         plan.PriceAmount,
		TradeNo:       tradeNo,
		PaymentMethod: PaymentMethodWechat,
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
			"trade_no": tradeNo,
			"code_url": *resp.CodeUrl,
		},
	})
}

// SubscriptionWechatNotify 微信订阅支付异步通知回调
func SubscriptionWechatNotify(c *gin.Context) {
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
	order := model.GetSubscriptionOrderByTradeNo(tradeNo)
	if order == nil {
		log.Println("微信支付回调订单不存在:", tradeNo)
		c.JSON(200, gin.H{"code": "FAIL", "message": "订单不存在"})
		return
	}

	// 如果已经处理过，直接返回成功
	if order.Status == common.TopUpStatusSuccess {
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
	if !compareFloat(payMoney, order.Money) {
		log.Printf("微信支付回调金额不匹配: 期望 %.2f, 实际 %.2f", order.Money, payMoney)
		c.JSON(200, gin.H{"code": "FAIL", "message": "金额不匹配"})
		return
	}

	// 完成订单
	err = model.CompleteSubscriptionOrder(tradeNo, common.GetJsonString(transaction))
	if err != nil {
		log.Println("完成订阅订单失败:", err)
		c.JSON(200, gin.H{"code": "FAIL", "message": "完成订单失败"})
		return
	}

	log.Printf("用户 %d 使用微信支付订阅套餐 %d 成功，订单号: %s", order.UserId, order.PlanId, tradeNo)

	// 返回成功给微信
	c.JSON(200, gin.H{"code": "SUCCESS", "message": "成功"})
}

// SubscriptionQueryWechatOrder 查询微信订阅订单状态
func SubscriptionQueryWechatOrder(c *gin.Context) {
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
	if queryResp.TradeState != nil && *queryResp.TradeState == "SUCCESS" {
		// 加锁防止并发
		LockOrder(tradeNo)
		defer UnlockOrder(tradeNo)

		// 再次检查订单状态（防止重复处理）
		order = model.GetSubscriptionOrderByTradeNo(tradeNo)
		if order.Status == common.TopUpStatusSuccess {
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
		if !compareFloat(payMoney, order.Money) {
			log.Printf("微信支付回调金额不匹配: 期望 %.2f, 实际 %.2f", order.Money, payMoney)
			common.ApiErrorMsg(c, "订单金额不匹配")
			return
		}

		// 完成订单
		err = model.CompleteSubscriptionOrder(tradeNo, common.GetJsonString(queryResp))
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
