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

import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';
import { UserContext } from '../../context/User';
import SubscriptionPlansCard from '../../components/topup/SubscriptionPlansCard';
import PackagesIntro from '../../components/packages/PackagesIntro';

const Packages = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [userState] = useContext(UserContext);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // 获取套餐列表
  const getSubscriptionPlans = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/subscription/public/plans');
      setSubscriptionPlans(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch subscription plans:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getSubscriptionPlans();
  }, []);

  // 处理"立即订阅"按钮点击
  const handleSubscribeNow = (plan) => {
    // 检查用户是否已登录
    if (!userState || !userState.user) {
      // 未登录，跳转到登录页
      navigate('/login?redirect=/console/topup?openSubscription=' + plan.id);
      return;
    }
    // 已登录，直接跳转到钱包管理页面
    navigate('/console/topup?openSubscription=' + plan.id);
  };

  return (
    <div className='max-w-7xl mx-auto px-4 py-8 pt-20'>
      <PackagesIntro t={t} planCount={subscriptionPlans.length} />
      <div className='mt-6'>
        <SubscriptionPlansCard
          t={t}
          loading={loading}
          plans={subscriptionPlans}
          hideMySubscription={true}
          onSubscribeNow={handleSubscribeNow}
          withCard={false}
          compact={true}
        />
      </div>
    </div>
  );
};

export default Packages;
