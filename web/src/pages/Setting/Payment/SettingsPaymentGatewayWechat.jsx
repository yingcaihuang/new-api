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

export default function SettingsPaymentGatewayWechat(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
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
  const [originInputs, setOriginInputs] = useState({});
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const currentInputs = {
        WechatEnabled: props.options.WechatEnabled === true || props.options.WechatEnabled === 'true',
        WechatAppID: props.options.WechatAppID || '',
        WechatMchID: props.options.WechatMchID || '',
        WechatAPIv3Key: props.options.WechatAPIv3Key || '',
        WechatSerialNo: props.options.WechatSerialNo || '',
        WechatPrivateKey: props.options.WechatPrivateKey || '',
        WechatServerURL: props.options.WechatServerURL || 'https://api.mch.weixin.qq.com',
        WechatMinTopUp:
          props.options.WechatMinTopUp !== undefined
            ? parseInt(props.options.WechatMinTopUp)
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

  const submitWechatSetting = async () => {
    setLoading(true);
    try {
      const options = [];

      // 只保存有值的配置项
      if (inputs.WechatEnabled !== originInputs.WechatEnabled) {
        options.push({
          key: 'WechatEnabled',
          value: inputs.WechatEnabled.toString(),
        });
      }
      if (inputs.WechatAppID !== originInputs.WechatAppID) {
        options.push({ key: 'WechatAppID', value: inputs.WechatAppID });
      }
      if (inputs.WechatMchID !== originInputs.WechatMchID) {
        options.push({ key: 'WechatMchID', value: inputs.WechatMchID });
      }
      if (inputs.WechatAPIv3Key !== originInputs.WechatAPIv3Key) {
        options.push({
          key: 'WechatAPIv3Key',
          value: inputs.WechatAPIv3Key,
        });
      }
      if (inputs.WechatSerialNo !== originInputs.WechatSerialNo) {
        options.push({
          key: 'WechatSerialNo',
          value: inputs.WechatSerialNo,
        });
      }
      if (inputs.WechatPrivateKey !== originInputs.WechatPrivateKey) {
        options.push({
          key: 'WechatPrivateKey',
          value: inputs.WechatPrivateKey,
        });
      }
      if (inputs.WechatServerURL !== originInputs.WechatServerURL) {
        options.push({
          key: 'WechatServerURL',
          value: inputs.WechatServerURL,
        });
      }
      if (inputs.WechatMinTopUp !== originInputs.WechatMinTopUp) {
        options.push({
          key: 'WechatMinTopUp',
          value: inputs.WechatMinTopUp.toString(),
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
        <Form.Section text={t('微信官方支付设置')}>
          <Banner
            type="info"
            description={
              <div>
                <Text strong>{t('Webhook 回调地址：')}</Text>
                <Text code>{`${window.location.origin}/api/wechat/notify`}</Text>
              </div>
            }
            style={{ marginBottom: '16px' }}
          />

          <Form.Switch
            field="WechatEnabled"
            label={t('启用微信官方支付')}
            extraText={t('启用后用户可以选择微信官方支付进行充值')}
          />

          <Form.Input
            field="WechatAppID"
            label={t('微信AppID')}
            placeholder={t('请输入微信AppID')}
          />

          <Form.Input
            field="WechatMchID"
            label={t('商户号')}
            placeholder={t('请输入商户号')}
          />

          <Form.TextArea
            field="WechatAPIv3Key"
            label={t('API v3密钥')}
            placeholder={t('请输入API v3密钥')}
            autosize={{ minRows: 2, maxRows: 4 }}
            type="password"
          />

          <Form.Input
            field="WechatSerialNo"
            label={t('证书序列号')}
            placeholder={t('请输入证书序列号')}
          />

          <Form.TextArea
            field="WechatPrivateKey"
            label={t('商户私钥')}
            placeholder={t('请输入商户私钥（apiclient_key.pem内容）')}
            autosize={{ minRows: 3, maxRows: 6 }}
            type="password"
          />

          <Form.Input
            field="WechatServerURL"
            label={t('网关地址')}
            placeholder="https://api.mch.weixin.qq.com"
            extraText={t('微信支付网关地址')}
          />

          <Form.InputNumber
            field="WechatMinTopUp"
            label={t('最低充值金额')}
            placeholder={t('请输入最低充值金额')}
            min={1}
            precision={0}
            suffix={t('元')}
          />

          <Button onClick={submitWechatSetting}>{t('更新微信配置')}</Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
