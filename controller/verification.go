package controller

import (
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// SubmitVerificationRequest 提交实名认证请求
type SubmitVerificationRequest struct {
	RealName     string `json:"real_name" binding:"required,min=2,max=20"`
	IdCardNumber string `json:"id_card_number" binding:"required,len=18"`
}

// RealNameVerificationResponse 实名认证状态响应
type RealNameVerificationResponse struct {
	Status           int        `json:"status"`
	RealName         string     `json:"real_name,omitempty"`
	MaskedIdCard     string     `json:"masked_id_card,omitempty"`
	IdCardNumber     string     `json:"id_card_number,omitempty"`
	VerificationTime *time.Time `json:"verification_time,omitempty"`
}

// SubmitVerification 用户提交实名认证
func SubmitVerification(c *gin.Context) {
	userId := c.GetInt("id")

	var req SubmitVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	// 获取用户信息
	user, err := model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 检查是否已经提交过认证
	if user.VerificationStatus == model.VerificationStatusApproved {
		common.ApiErrorI18n(c, i18n.MsgUserVerificationAlreadySubmitted)
		return
	}

	// 验证身份证号格式
	if !validateIdCard(req.IdCardNumber) {
		common.ApiErrorI18n(c, i18n.MsgUserVerificationInvalidIdCard)
		return
	}

	// 更新用户信息（直接存储，不加密）
	now := time.Now()
	user.RealName = req.RealName
	user.IdCardNumber = req.IdCardNumber
	user.VerificationStatus = model.VerificationStatusApproved
	user.VerificationTime = &now

	if err := model.DB.Save(user).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccessI18n(c, i18n.MsgUserVerificationSubmitSuccess, nil)
}

// GetVerificationStatus 获取认证状态
func GetVerificationStatus(c *gin.Context) {
	userId := c.GetInt("id")

	user, err := model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	response := RealNameVerificationResponse{
		Status: user.VerificationStatus,
	}

	// 如果已认证，返回脱敏后的信息
	if user.VerificationStatus == model.VerificationStatusApproved {
		response.RealName = user.RealName
		response.VerificationTime = user.VerificationTime

		// 脱敏显示身份证号
		if user.IdCardNumber != "" {
			response.MaskedIdCard = maskIdCard(user.IdCardNumber)
		}
	}

	common.ApiSuccess(c, response)
}

// validateIdCard 验证身份证号格式和校验码
func validateIdCard(idCard string) bool {
	if len(idCard) != 18 {
		return false
	}

	// 正则验证基本格式
	regex := regexp.MustCompile(`^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$`)
	if !regex.MatchString(idCard) {
		return false
	}

	// 校验码验证（ISO 7064:1983 Mod 11-2）
	weights := []int{7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2}
	codes := []string{"1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"}

	sum := 0
	for i := 0; i < 17; i++ {
		digit, err := strconv.Atoi(string(idCard[i]))
		if err != nil {
			return false
		}
		sum += digit * weights[i]
	}

	checkCode := codes[sum%11]
	lastChar := strings.ToUpper(string(idCard[17]))

	return checkCode == lastChar
}

// maskIdCard 脱敏显示身份证号（仅显示后4位）
func maskIdCard(idCard string) string {
	if len(idCard) < 4 {
		return "**************"
	}
	return strings.Repeat("*", len(idCard)-4) + idCard[len(idCard)-4:]
}

// GetVerificationByAdmin 管理员获取用户实名认证信息
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
		IdCardNumber:     user.IdCardNumber, // 完整身份证号（管理员可见）
		VerificationTime: user.VerificationTime,
	}

	common.ApiSuccess(c, response)
}

// UpdateVerificationRequest 管理员更新实名认证请求
type UpdateVerificationRequest struct {
	RealName     string `json:"real_name" binding:"required,min=2,max=20"`
	IdCardNumber string `json:"id_card_number" binding:"required,len=18"`
	Status       int    `json:"status" binding:"required,oneof=0 2"`
}

// UpdateVerificationByAdmin 管理员更新/添加用户实名认证信息
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
	if req.Status == model.VerificationStatusApproved {
		user.VerificationTime = &now
	} else {
		user.VerificationTime = nil
	}

	if err := model.DB.Save(user).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccessI18n(c, i18n.MsgUserVerificationUpdateSuccess, nil)
}

// DeleteVerificationByAdmin 管理员清除用户实名认证信息
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
