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

import React, { useEffect, useState } from 'react';
import {
  Button,
  SideSheet,
  Space,
  Tag,
  Typography,
  Banner,
  Form,
  Select,
  Modal,
} from '@douyinfe/semi-ui';
import { IconEyeOpened, IconEyeClosed } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const { Text } = Typography;

/**
 * Validate Chinese ID card number (18 digits with checksum)
 */
function validateIdCard(idCard) {
  if (!idCard || idCard.length !== 18) {
    return false;
  }

  // Check first 17 digits are numbers
  const first17 = idCard.substring(0, 17);
  if (!/^\d{17}$/.test(first17)) {
    return false;
  }

  // Check last digit (can be number or X)
  const last = idCard.charAt(17);
  if (!/^[\dXx]$/.test(last)) {
    return false;
  }

  // Validate checksum
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += parseInt(first17.charAt(i)) * weights[i];
  }

  const checkCode = checkCodes[sum % 11];
  return last.toUpperCase() === checkCode;
}

/**
 * Mask ID card number (show first 6 and last 4 digits)
 */
function maskIdCard(idCard) {
  if (!idCard || idCard.length !== 18) {
    return idCard;
  }
  return idCard.substring(0, 6) + '********' + idCard.substring(14);
}

const UserVerificationModal = ({ visible, onCancel, user, t, onSuccess }) => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verification, setVerification] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showIdCard, setShowIdCard] = useState(false);

  const formApi = Form.useFormApi();

  // Load verification data
  const loadVerification = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await API.get(`/api/user/${user.id}/verification`);
      if (res.data?.success) {
        const data = res.data.data;
        setVerification(data);
        // If no verification exists, enter edit mode automatically
        if (!data?.real_name && !data?.id_card) {
          setIsEditMode(true);
        }
      } else {
        showError(res.data?.message || t('加载失败'));
      }
    } catch (e) {
      showError(t('请求失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) {
      // Reset state when modal closes
      setIsEditMode(false);
      setShowIdCard(false);
      setVerification(null);
      return;
    }
    loadVerification();
  }, [visible, user?.id]);

  // Initialize form when entering edit mode
  useEffect(() => {
    if (isEditMode && verification) {
      formApi.setValues({
        real_name: verification.real_name || '',
        id_card: verification.id_card || '',
        status: verification.status || 'unverified',
      });
    } else if (isEditMode && !verification) {
      // New verification
      formApi.setValues({
        real_name: '',
        id_card: '',
        status: 'unverified',
      });
    }
  }, [isEditMode, verification]);

  // Handle save
  const handleSave = async (values) => {
    if (!user?.id) {
      showError(t('用户信息缺失'));
      return;
    }

    // Validate ID card
    if (!validateIdCard(values.id_card)) {
      showError(t('身份证号格式不正确'));
      return;
    }

    setSaving(true);
    try {
      const res = await API.put(`/api/user/${user.id}/verification`, {
        real_name: values.real_name,
        id_card: values.id_card,
        status: values.status,
      });
      if (res.data?.success) {
        showSuccess(t('保存成功'));
        setIsEditMode(false);
        await loadVerification();
        onSuccess?.();
      } else {
        showError(res.data?.message || t('保存失败'));
      }
    } catch (e) {
      showError(t('请求失败'));
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = () => {
    Modal.confirm({
      title: t('确认清除实名认证'),
      content: t(
        '清除后该用户的所有实名认证信息将被永久删除，用户可重新提交认证。是否继续？',
      ),
      centered: true,
      okType: 'danger',
      onOk: async () => {
        try {
          const res = await API.delete(`/api/user/${user.id}/verification`);
          if (res.data?.success) {
            showSuccess(t('已清除实名认证信息'));
            await loadVerification();
            onSuccess?.();
          } else {
            showError(res.data?.message || t('删除失败'));
          }
        } catch (e) {
          showError(t('请求失败'));
        }
      },
    });
  };

  // Render view mode
  const renderViewMode = () => {
    const hasVerification = verification?.real_name || verification?.id_card;

    if (!hasVerification) {
      return (
        <div className='p-4'>
          <Banner
            type='info'
            description={t('该用户尚未进行实名认证')}
            style={{ marginBottom: 16 }}
          />
          <Button
            type='primary'
            theme='solid'
            onClick={() => setIsEditMode(true)}
          >
            {t('添加认证信息')}
          </Button>
        </div>
      );
    }

    return (
      <div className='p-4'>
        {/* Status */}
        <div className='mb-4'>
          <Text type='secondary' className='block mb-2'>
            {t('认证状态')}
          </Text>
          {verification?.status === 'verified' ? (
            <Tag color='green' size='large'>
              {t('已验证')}
            </Tag>
          ) : (
            <Tag color='grey' size='large'>
              {t('未验证')}
            </Tag>
          )}
        </div>

        {/* Real Name */}
        <div className='mb-4'>
          <Text type='secondary' className='block mb-2'>
            {t('真实姓名')}
          </Text>
          <Text>{verification?.real_name || '-'}</Text>
        </div>

        {/* ID Card */}
        <div className='mb-4'>
          <Text type='secondary' className='block mb-2'>
            {t('身份证号')}
          </Text>
          <Space>
            <Text>
              {showIdCard
                ? verification?.id_card || '-'
                : maskIdCard(verification?.id_card) || '-'}
            </Text>
            <Button
              type='tertiary'
              size='small'
              icon={showIdCard ? <IconEyeClosed /> : <IconEyeOpened />}
              onClick={() => setShowIdCard(!showIdCard)}
            >
              {showIdCard ? t('隐藏') : t('显示')}
            </Button>
          </Space>
        </div>

        {/* Verification Time */}
        {verification?.verified_at && (
          <div className='mb-4'>
            <Text type='secondary' className='block mb-2'>
              {t('认证时间')}
            </Text>
            <Text>
              {new Date(verification.verified_at * 1000).toLocaleString()}
            </Text>
          </div>
        )}

        {/* Action Buttons */}
        <Space className='mt-6'>
          <Button type='primary' onClick={() => setIsEditMode(true)}>
            {t('编辑信息')}
          </Button>
          <Button type='danger' theme='light' onClick={handleDelete}>
            {t('清除认证')}
          </Button>
        </Space>
      </div>
    );
  };

  // Render edit mode
  const renderEditMode = () => {
    return (
      <div className='p-4'>
        <Form
          getFormApi={(api) => Object.assign(formApi, api)}
          onSubmit={handleSave}
          labelPosition='left'
          labelAlign='right'
          labelWidth={isMobile ? 100 : 120}
        >
          <Form.Input
            field='real_name'
            label={t('真实姓名')}
            placeholder={t('请输入真实姓名')}
            rules={[
              { required: true, message: t('请输入真实姓名') },
              {
                min: 2,
                max: 20,
                message: t('真实姓名长度为2-20个字符'),
              },
            ]}
            style={{ width: '100%' }}
          />

          <Form.Input
            field='id_card'
            label={t('身份证号')}
            placeholder={t('请输入18位身份证号')}
            rules={[
              { required: true, message: t('请输入身份证号') },
              {
                validator: (rule, value) => {
                  if (!value) return true;
                  if (value.length !== 18) {
                    return t('请输入18位身份证号');
                  }
                  if (!validateIdCard(value)) {
                    return t('身份证号格式不正确');
                  }
                  return true;
                },
              },
            ]}
            style={{ width: '100%' }}
            maxLength={18}
          />

          <Form.Select
            field='status'
            label={t('认证状态')}
            placeholder={t('选择认证状态')}
            rules={[{ required: true }]}
            style={{ width: '100%' }}
          >
            <Select.Option value='unverified'>{t('未验证')}</Select.Option>
            <Select.Option value='verified'>{t('已验证')}</Select.Option>
          </Form.Select>

          <Banner
            type='info'
            description={t('请填写真实姓名和身份证号，用于身份验证')}
            style={{ marginTop: 16, marginBottom: 16 }}
          />

          <Space className='mt-4'>
            <Button
              type='tertiary'
              onClick={() => {
                setIsEditMode(false);
                setShowIdCard(false);
              }}
            >
              {t('取消')}
            </Button>
            <Button type='primary' htmlType='submit' loading={saving}>
              {t('保存')}
            </Button>
          </Space>
        </Form>
      </div>
    );
  };

  return (
    <SideSheet
      visible={visible}
      placement='right'
      width={isMobile ? '100%' : 600}
      bodyStyle={{ padding: 0 }}
      onCancel={onCancel}
      title={
        <Space>
          <Tag color='blue' shape='circle'>
            {t('管理')}
          </Tag>
          <Typography.Title heading={4} className='m-0'>
            {t('用户实名认证管理')}
          </Typography.Title>
          <Text type='tertiary' className='ml-2'>
            {user?.username || '-'} (ID: {user?.id || '-'})
          </Text>
        </Space>
      }
    >
      {loading ? (
        <div className='p-4 text-center'>
          <Text type='secondary'>{t('加载中...')}</Text>
        </div>
      ) : isEditMode ? (
        renderEditMode()
      ) : (
        renderViewMode()
      )}
    </SideSheet>
  );
};

export default UserVerificationModal;
