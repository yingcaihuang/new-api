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

import React, { useEffect, useState, useRef } from 'react';
import {
  Banner,
  Button,
  Form,
  Spin,
  Typography,
} from '@douyinfe/semi-ui';
const { Text } = Typography;
import {
  API,
  showError,
  showSuccess,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsPaymentGatewayAlipay(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    AlipayEnabled: false,
    AlipayAppID: '',
    AlipayPrivateKey: '',
    AlipayPublicKey: '',
    AlipayServerURL: 'https://openapi.alipay.com/gateway.do',
    AlipayMinTopUp: 1,
  });
  const [originInputs, setOriginInputs] = useState({});
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        AlipayEnabled: props.options.AlipayEnabled === true || props.options.AlipayEnabled === 'true',
        AlipayAppID: props.options.AlipayAppID || '',
        AlipayPrivateKey: props.options.AlipayPrivateKey || '',
        AlipayPublicKey: props.options.AlipayPublicKey || '',
        AlipayServerURL: props.options.AlipayServerURL || 'https://openapi.alipay.com/gateway.do',
        AlipayMinTopUp:
          props.options.AlipayMinTopUp !== undefined
            ? parseInt(props.options.AlipayMinTopUp)
            : 1,
      };

      setInputs(currentInputs);
      setOriginInputs({ ...currentInputs });
      formApiRef.current.setValues(currentInputs);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const submitAlipaySetting = async () => {
    setLoading(true);
    try {
      const options = [];

      // 只保存有值的配置项
      if (inputs.AlipayEnabled !== originInputs.AlipayEnabled) {
        options.push({
          key: 'AlipayEnabled',
          value: inputs.AlipayEnabled.toString(),
        });
      }
      if (inputs.AlipayAppID !== originInputs.AlipayAppID) {
        options.push({ key: 'AlipayAppID', value: inputs.AlipayAppID });
      }
      if (inputs.AlipayPrivateKey !== originInputs.AlipayPrivateKey) {
        options.push({
          key: 'AlipayPrivateKey',
          value: inputs.AlipayPrivateKey,
        });
      }
      if (inputs.AlipayPublicKey !== originInputs.AlipayPublicKey) {
        options.push({
          key: 'AlipayPublicKey',
          value: inputs.AlipayPublicKey,
        });
      }
      if (inputs.AlipayServerURL !== originInputs.AlipayServerURL) {
        options.push({
          key: 'AlipayServerURL',
          value: inputs.AlipayServerURL,
        });
      }
      if (inputs.AlipayMinTopUp !== originInputs.AlipayMinTopUp) {
        options.push({
          key: 'AlipayMinTopUp',
          value: inputs.AlipayMinTopUp.toString(),
        });
      }

      if (options.length === 0) {
        setLoading(false);
        return;
      }

      // 发送请求
      const requestQueue = options.map((opt) =>
        API.put('/api/option/', {
          key: opt.key,
          value: opt.value,
        }),
      );

      const results = await Promise.all(requestQueue);

      // 检查所有请求是否成功
      const errorResults = results.filter((res) => !res.data.success);
      if (errorResults.length > 0) {
        errorResults.forEach((res) => {
          showError(res.data.message);
        });
      } else {
        showSuccess(t('更新成功'));
        setOriginInputs({ ...inputs });
        props.refresh?.();
      }
    } catch (error) {
      showError(t('更新失败'));
    }
    setLoading(false);
  };

  return (
    <Spin spinning={loading}>
      <Form
        initValues={inputs}
        onValueChange={handleFormChange}
        getFormApi={(formApi) => (formApiRef.current = formApi)}
      >
        <Form.Section text={t('支付宝官方支付设置')}>
          <Banner
            type="info"
            description={
              <div>
                <Text strong>{t('Webhook 回调地址：')}</Text>
                <Text code>{`${window.location.origin}/api/alipay/notify`}</Text>
              </div>
            }
            style={{ marginBottom: '16px' }}
          />

          <Form.Switch
            field="AlipayEnabled"
            label={t('启用支付宝官方支付')}
            extraText={t('启用后用户可以选择支付宝官方支付进行充值')}
          />

          <Form.Input
            field="AlipayAppID"
            label={t('AppID')}
            placeholder={t('请输入支付宝应用AppID')}
          />

          <Form.TextArea
            field="AlipayPrivateKey"
            label={t('应用私钥')}
            placeholder={t('请输入应用私钥')}
            autosize={{ minRows: 3, maxRows: 6 }}
            type="password"
          />

          <Form.TextArea
            field="AlipayPublicKey"
            label={t('支付宝公钥')}
            placeholder={t('请输入支付宝公钥（用于验证回调签名）')}
            autosize={{ minRows: 3, maxRows: 6 }}
            type="password"
          />

          <Form.Input
            field="AlipayServerURL"
            label={t('网关地址')}
            placeholder="https://openapi.alipay.com/gateway.do"
            extraText={t('正式环境：https://openapi.alipay.com/gateway.do；沙箱环境：https://openapi.alipaydev.com/gateway.do')}
          />

          <Form.InputNumber
            field="AlipayMinTopUp"
            label={t('最低充值金额')}
            placeholder={t('请输入最低充值金额')}
            min={1}
            precision={0}
            suffix={t('元')}
          />

          <Button onClick={submitAlipaySetting}>{t('更新支付宝配置')}</Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
