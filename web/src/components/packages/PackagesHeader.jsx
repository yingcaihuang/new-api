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

import React from 'react';
import { Input, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Nav } from '@douyinfe/semi-ui';

const { Title, Text } = Typography;

const PackagesHeader = ({ searchValue, onSearchChange }) => {
  const { t } = useTranslation();

  return (
    <div className='bg-white border-b'>
      <div className='max-w-7xl mx-auto px-4 py-12'>
        <Title heading={1} className='mb-3'>
          {t('优惠套餐')}
        </Title>
        <Text type='secondary' size='large'>
          {t('选择适合您的订阅套餐，享受更多权益')}
        </Text>

        <div className='mt-8 max-w-md'>
          <Input
            prefix={<Search />}
            placeholder={t('搜索套餐名称')}
            value={searchValue}
            onChange={onSearchChange}
            showClear
            size='large'
            className='search-input'
          />
        </div>
      </div>
    </div>
  );
};

export default PackagesHeader;
