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

import React, { useState } from 'react';
import { Card, Typography, Modal } from '@douyinfe/semi-ui';
import { Crown } from 'lucide-react';

const { Text, Paragraph } = Typography;

const PackagesIntro = ({ t, planCount = 0 }) => {
  const [modalVisible, setModalVisible] = useState(false);

  const openModal = () => setModalVisible(true);
  const closeModal = () => setModalVisible(false);

  const cardStyle = {
    '--palette-primary-darkerChannel': '139 92 246',
    backgroundImage: `linear-gradient(0deg, rgba(139, 92, 246, 0.85), rgba(139, 92, 246, 0.85)), url('/cover-4.webp')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };

  return (
    <>
      <Card
        className='!rounded-2xl shadow-sm border-0 mb-6'
        cover={
          <div className='relative h-full' style={cardStyle}>
            <div className='relative z-10 h-full flex items-center justify-between p-6'>
              <div className='flex-1 min-w-0 mr-4'>
                <div className='flex items-center gap-3 mb-3'>
                  <div className='w-12 h-12 rounded-xl bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md'>
                    <Crown size={24} className='text-purple-600' />
                  </div>
                  <h2 className='text-xl sm:text-2xl font-bold text-white'>
                    {t('优惠套餐')}
                  </h2>
                </div>
                <Paragraph
                  className='text-sm leading-relaxed !mb-0 cursor-pointer'
                  style={{ color: 'rgba(255,255,255,0.9)' }}
                  ellipsis={{ rows: 2 }}
                  onClick={openModal}
                >
                  {t('查看所有可订阅的优惠套餐，选择适合您的方案享受更多权益，包括不同额度和有效期的套餐选项。')}
                </Paragraph>
              </div>
            </div>
          </div>
        }
      />
      <Modal
        title={t('套餐介绍')}
        visible={modalVisible}
        onCancel={closeModal}
        footer={null}
        width={600}
        bodyStyle={{
          maxHeight: '60vh',
          overflowY: 'auto',
        }}
      >
        <div className='text-sm space-y-4'>
          <p>
            {t('我们提供多种订阅套餐，满足不同用户的需求。套餐特点：')}
          </p>
          <ul className='list-disc pl-5 space-y-2'>
            <li>{t('多种额度选择：从小额试用到大额商业套餐')}</li>
            <li>{t('灵活的有效期：支持小时、天、月、年等多种时长')}</li>
            <li>{t('额度重置功能：部分套餐支持周期性额度重置')}</li>
            <li>{t('用户等级升级：购买套餐可升级到高级用户分组')}</li>
            <li>{t('多种支付方式：支持Stripe、支付宝、微信等多种支付')}</li>
          </ul>
          <p className='text-gray-500'>
            {t('请根据您的实际使用情况选择合适的套餐，购买后即可立即享受订阅权益。')}
          </p>
        </div>
      </Modal>
    </>
  );
};

export default PackagesIntro;
