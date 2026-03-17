/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useState, useEffect } from 'react';
import { Modal, Spin, Button, Typography, Toast, Image } from '@douyinfe/semi-ui';
import { API } from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { SiWechat } from 'react-icons/si';

const { Title, Text, Paragraph } = Typography;

export default function WechatQRCodeModal({
  visible,
  onClose,
  tradeNo,
  amount,
  qrCodeUrl,
  type = 'topup', // 'topup' for 充值, 'subscription' for 订阅
}) {
  const { t } = useTranslation();
  const [paid, setPaid] = useState(false);
  const [queryCount, setQueryCount] = useState(0);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!visible || paid) {
      setChecking(false);
      return;
    }

    setChecking(true);

    // 根据类型选择不同的查询接口
    const queryUrl = type === 'subscription'
      ? `/api/subscription/wechat/query?trade_no=${tradeNo}`
      : `/api/user/wechat/query?trade_no=${tradeNo}`;

    // 轮询检查支付状态
    const timer = setInterval(async () => {
      try {
        const res = await API.get(queryUrl);
        if (res.data?.success && res.data?.data?.status === 'success') {
          setPaid(true);
          setChecking(false);
          clearInterval(timer);

          // 显示成功提示
          Toast.success({
            content: t('支付成功！'),
            duration: 2,
          });

          // 延迟关闭并刷新余额
          setTimeout(() => {
            onClose?.(true);
          }, 2000);
        }
      } catch (e) {
        console.error('查询订单状态失败', e);
      }
      setQueryCount((c) => c + 1);
    }, 3000); // 每3秒轮询一次

    // 最多轮询5分钟（100次 * 3秒）
    const maxAttempts = 100;
    const timeout = setTimeout(() => {
      clearInterval(timer);
      setChecking(false);
      if (!paid) {
        Toast.warning({
          content: t('查询超时，请稍后在账单记录中查看'),
          duration: 3,
        });
      }
    }, maxAttempts * 3000);

    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [visible, paid, tradeNo]);

  if (!qrCodeUrl) {
    return null;
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <SiWechat
            size={24}
            color="#07C160"
            style={{ marginRight: '8px' }}
          />
          {t('微信扫码支付')}
        </div>
      }
      visible={visible}
      onCancel={() => onClose?.(false)}
      footer={null}
      closable={!paid}
      maskClosable={false}
      width={480}
    >
      <div style={{ textAlign: 'center', padding: '24px 12px' }}>
        {paid ? (
          <div style={{ padding: '40px 0' }}>
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: '#52c41a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
              }}
            >
              <svg
                viewBox="0 0 1024 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                fill="#fff"
              >
                <path d="M384 690.752L160 466.752 211.776 415.008 384 587.264 824.8 146.432 876.544 198.208 384 690.752z" />
              </svg>
            </div>
            <Title heading={4}>{t('支付成功！')}</Title>
            <Paragraph type="secondary">{t('正在跳转...')}</Paragraph>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  padding: '16px',
                  background: '#fff',
                  borderRadius: '8px',
                  border: '1px solid #f0f0f0',
                }}
              >
                <Image
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrCodeUrl)}`}
                  width={224}
                  height={224}
                  preview={false}
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <Title heading={5} style={{ marginBottom: '8px' }}>
                {t('请使用微信扫码支付')}
              </Title>
              <Text
                type="danger"
                style={{ fontSize: '24px', fontWeight: 'bold' }}
              >
                ¥{parseFloat(amount).toFixed(2)}
              </Text>
            </div>

            <div style={{ marginTop: '20px', textAlign: 'left' }}>
              <Paragraph
                type="secondary"
                style={{ marginBottom: '8px', fontSize: '14px' }}
              >
                <Text strong>{t('订单号：')}</Text>
                <Text code copyable>
                  {tradeNo}
                </Text>
              </Paragraph>
              {checking && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '12px',
                    color: '#07C160',
                  }}
                >
                  <Spin size="small" />
                  <Text type="secondary" style={{ fontSize: '14px' }}>
                    {t('正在检测支付状态...')}
                  </Text>
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: '24px',
                padding: '12px',
                background: '#f6f6f6',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#666',
              }}
            >
              <Paragraph style={{ margin: 0, fontSize: '13px' }}>
                {t('请确保在15分钟内完成支付')}
              </Paragraph>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
