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

import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Form,
  Button,
  Typography,
  Space,
  Tag,
  Banner,
  Spin,
} from '@douyinfe/semi-ui';
import { IconCheckCircleStroked, IconInfoCircle } from '@douyinfe/semi-icons';
import { IdCard } from 'lucide-react';
import { API, showError, showSuccess } from '../../../../helpers';

const RealNameVerification = ({ t }) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const formApiRef = useRef(null);

  // 加载认证状态
  useEffect(() => {
    loadVerificationStatus();
  }, []);

  const loadVerificationStatus = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/user/verification/status');
      if (res.data.success) {
        setStatus(res.data.data);
      }
    } catch (error) {
      // 忽略错误，可能是未认证状态
      console.error('Failed to load verification status:', error);
    } finally {
      setLoading(false);
    }
  };

  // 提交认证
  const handleSubmit = async () => {
    // 检查Form API是否已初始化
    if (!formApiRef.current) {
      showError(t('表单未初始化，请刷新页面重试'));
      return;
    }

    try {
      const values = await formApiRef.current.validate();
      setSubmitting(true);

      const res = await API.post('/api/user/verification/submit', {
        real_name: values.realName,
        id_card_number: values.idCardNumber,
      });

      if (res.data.success) {
        showSuccess(t('实名认证提交成功'));
        loadVerificationStatus();
      } else {
        showError(res.data.message || t('提交失败'));
      }
    } catch (error) {
      if (error.errors) {
        // 表单验证错误
        return;
      }
      showError(error);
    } finally {
      setSubmitting(false);
    }
  };

  // 身份证号校验
  const validateIdCard = (rule, value) => {
    if (!value) {
      return Promise.reject(t('请输入身份证号'));
    }

    // 转换为大写进行验证（兼容小写x）
    const upperValue = value.toUpperCase();

    // 18位身份证号正则验证（包括X）
    const idCardRegex =
      /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dX]$/;
    if (!idCardRegex.test(upperValue)) {
      return Promise.reject(t('身份证号格式不正确'));
    }

    // 校验码验证
    const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

    let sum = 0;
    for (let i = 0; i < 17; i++) {
      sum += parseInt(upperValue[i]) * weights[i];
    }

    const checkCode = codes[sum % 11];
    const lastChar = upperValue[17];

    if (checkCode !== lastChar) {
      return Promise.reject(t('身份证号格式不正确'));
    }

    return Promise.resolve();
  };

  if (loading) {
    return (
      <div className='py-8 flex justify-center'>
        <Spin spinning={loading} />
      </div>
    );
  }

  // 已认证状态
  if (status && status.status === 2) {
    return (
      <div className='py-4'>
        <Card className='!rounded-xl'>
          <Space vertical spacing='medium' style={{ width: '100%' }}>
            <div className='flex items-center gap-2'>
              <IconCheckCircleStroked
                style={{
                  color: 'var(--semi-color-success)',
                  fontSize: 24,
                }}
              />
              <Typography.Title heading={5}>
                {t('实名认证已通过')}
              </Typography.Title>
              <Tag color='green' size='large'>
                {t('已认证')}
              </Tag>
            </div>

            <Banner
              type='success'
              icon={null}
              description={t('您的账户已完成实名认证')}
            />

            <Space vertical spacing='small' className='mt-4'>
              <div className='flex items-center gap-3'>
                <Typography.Text
                  strong
                  className='text-gray-600 dark:text-gray-400 w-24'
                >
                  {t('姓名')}
                </Typography.Text>
                <Typography.Text className='text-gray-900 dark:text-gray-100'>
                  {status.real_name}
                </Typography.Text>
              </div>
              <div className='flex items-center gap-3'>
                <Typography.Text
                  strong
                  className='text-gray-600 dark:text-gray-400 w-24'
                >
                  {t('身份证号')}
                </Typography.Text>
                <Typography.Text className='text-gray-900 dark:text-gray-100 font-mono'>
                  {status.masked_id_card}
                </Typography.Text>
              </div>
              <div className='flex items-center gap-3'>
                <Typography.Text
                  strong
                  className='text-gray-600 dark:text-gray-400 w-24'
                >
                  {t('认证时间')}
                </Typography.Text>
                <Typography.Text className='text-gray-900 dark:text-gray-100'>
                  {new Date(status.verification_time).toLocaleString()}
                </Typography.Text>
              </div>
            </Space>
          </Space>
        </Card>
      </div>
    );
  }

  // 未认证状态 - 显示表单
  return (
    <div className='py-4'>
      <Card className='!rounded-xl'>
        <Space vertical spacing='medium' style={{ width: '100%' }}>
          <div className='flex items-center gap-2'>
            <IdCard size={20} />
            <Typography.Title heading={5}>{t('实名认证')}</Typography.Title>
          </div>

          <Banner
            type='info'
            icon={<IconInfoCircle />}
            description={t('请填写真实姓名和身份证号，用于身份验证')}
          />

          <Form
            getFormApi={(api) => (formApiRef.current = api)}
            labelPosition='left'
            labelWidth={100}
            className='mt-4'
          >
            <Form.Input
              field='realName'
              label={t('真实姓名')}
              placeholder={t('请输入真实姓名')}
              style={{ width: '100%' }}
              rules={[
                { required: true, message: t('请输入真实姓名') },
                { min: 2, max: 20, message: t('姓名长度为2-20个字符') },
              ]}
            />

            <Form.Input
              field='idCardNumber'
              label={t('身份证号')}
              placeholder={t('请输入18位身份证号')}
              maxLength={18}
              style={{ width: '100%' }}
              rules={[
                { required: true, message: t('请输入身份证号') },
                { validator: validateIdCard },
              ]}
            />
          </Form>

          <div className='flex justify-center mt-4'>
            <Button
              theme='solid'
              type='primary'
              onClick={handleSubmit}
              loading={submitting}
              size='large'
            >
              {t('提交认证')}
            </Button>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default RealNameVerification;
