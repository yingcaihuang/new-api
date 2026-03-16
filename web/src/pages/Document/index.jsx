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

import React, { useContext } from 'react';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { StatusContext } from '../../context/Status';
import { Button } from '@douyinfe/semi-ui';
import { IconCopy } from '@douyinfe/semi-icons';
import { copy, showSuccess } from '../../helpers';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const Document = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [statusState] = useContext(StatusContext);
  const serverAddress =
    statusState?.status?.server_address || `${window.location.origin}`;

  const handleCopy = async (text) => {
    const ok = await copy(text);
    if (ok) {
      showSuccess(t('已复制到剪切板'));
    }
  };

  const curlExample = `curl ${serverAddress}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "user",
        "content": "${t('你好')}"
      }
    ]
  }'`;

  const pythonExample = `from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="${serverAddress}/v1"
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "user", "content": "${t('你好')}"}
    ]
)

print(response.choices[0].message.content)`;

  const nodeExample = `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'YOUR_API_KEY',
  baseURL: '${serverAddress}/v1'
});

async function main() {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: '${t('你好')}' }
    ]
  });

  console.log(response.choices[0].message.content);
}

main();`;

  const steps = [
    {
      title: t('注册账号'),
      desc: t('访问平台并注册一个新账号，完成邮箱验证。'),
    },
    {
      title: t('登录控制台'),
      desc: t('使用注册的账号登录到控制台管理页面。'),
    },
    {
      title: t('生成 API Key'),
      desc: t('在控制台的令牌页面生成API Key'),
    },
    {
      title: t('开始调用'),
      desc: t('使用生成的 API Key 调用接口，开始使用 AI 模型服务。'),
    },
  ];

  return (
    <div className='w-full overflow-x-hidden'>
      <div className='w-full overflow-x-hidden pb-16 md:pb-24'>
        <div className='blur-ball blur-ball-indigo' />
        <div className='blur-ball blur-ball-teal' />
        <div className='absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(45,212,191,0.20),transparent_38%),radial-gradient(circle_at_82%_8%,rgba(56,189,248,0.16),transparent_34%),linear-gradient(to_bottom,rgba(240,249,255,0.6),transparent_55%)] pointer-events-none dark:bg-none' />

        <div className='mt-8 px-4 md:px-8 lg:px-10'>
          <div className='max-w-6xl mx-auto'>
            <div className='rounded-[28px] border border-semi-color-border bg-semi-color-bg-0/90 backdrop-blur-md shadow-[0_20px_70px_rgba(2,132,199,0.08)] p-6 md:p-10 lg:p-12 text-center'>
              <h1 className='text-3xl md:text-5xl font-bold text-semi-color-text-0 leading-tight'>
                {t('快速开始')}
              </h1>
              <p className='mt-4 text-base md:text-lg text-semi-color-text-1 max-w-3xl mx-auto leading-relaxed'>
                {t('按照以下步骤，快速接入平台并开始使用 AI 模型服务')}
              </p>
            </div>

            <div className='mt-8 rounded-3xl border border-semi-color-border bg-semi-color-bg-0 p-6 md:p-10'>
              <h2 className='text-2xl md:text-3xl font-bold text-semi-color-text-0'>
                {t('接入步骤')}
              </h2>
              <div className='mt-6 space-y-4'>
                {steps.map((item, index) => (
                  <div
                    key={item.title}
                    className='rounded-2xl border border-semi-color-border bg-semi-color-bg-1 p-5 text-left flex items-start gap-4'
                  >
                    <div className='flex-shrink-0 w-8 h-8 rounded-full bg-semi-color-primary text-white flex items-center justify-center font-semibold'>
                      {index + 1}
                    </div>
                    <div className='flex-1'>
                      <p className='text-base md:text-lg font-semibold text-semi-color-text-0'>
                        {item.title}
                      </p>
                      <p className='mt-2 text-sm md:text-base text-semi-color-text-1 leading-7'>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className='mt-6 text-center'>
                <Link to='/console/token'>
                  <Button
                    theme='solid'
                    type='primary'
                    size={isMobile ? 'default' : 'large'}
                    className='!rounded-3xl px-8 py-2'
                  >
                    {t('前往控制台生成 API Key')}
                  </Button>
                </Link>
              </div>
            </div>

            <div className='mt-8 rounded-3xl border border-semi-color-border bg-gradient-to-br from-semi-color-bg-0 to-semi-color-bg-1 p-6 md:p-10'>
              <h2 className='text-2xl md:text-3xl font-bold text-semi-color-text-0'>
                {t('cURL 示例')}
              </h2>
              <p className='mt-3 text-sm md:text-base text-semi-color-text-1'>
                {t('使用 cURL 命令快速测试 API 接口：')}
              </p>
              <div className='mt-5 rounded-2xl border border-semi-color-border bg-[#0b1220] p-5 text-left relative'>
                <Button
                  type='tertiary'
                  icon={<IconCopy />}
                  className='absolute top-3 right-3 !text-gray-400 hover:!text-white'
                  onClick={() => handleCopy(curlExample)}
                />
                <pre className='text-sm md:text-base text-[#93c5fd] overflow-x-auto'>
                  <code>{curlExample}</code>
                </pre>
              </div>
              <div className='mt-4 rounded-xl border border-semi-color-border bg-semi-color-bg-0 p-4'>
                <p className='text-sm text-semi-color-text-1'>
                  💡 {t('请将')} <code className='px-2 py-1 rounded bg-semi-color-fill-0 text-semi-color-text-0'>YOUR_API_KEY</code> {t('替换为您在控制台生成的实际 API Key')}
                </p>
              </div>
            </div>

            <div className='mt-8 rounded-3xl border border-semi-color-border bg-semi-color-bg-0 p-6 md:p-10'>
              <h2 className='text-2xl md:text-3xl font-bold text-semi-color-text-0'>
                {t('Python 示例')}
              </h2>
              <p className='mt-3 text-sm md:text-base text-semi-color-text-1'>
                {t('使用 OpenAI Python SDK 调用接口：')}
              </p>
              <div className='mt-5 rounded-2xl border border-semi-color-border bg-[#0b1220] p-5 text-left relative'>
                <Button
                  type='tertiary'
                  icon={<IconCopy />}
                  className='absolute top-3 right-3 !text-gray-400 hover:!text-white'
                  onClick={() => handleCopy(pythonExample)}
                />
                <pre className='text-sm md:text-base text-[#93c5fd] overflow-x-auto'>
                  <code>{pythonExample}</code>
                </pre>
              </div>
              <div className='mt-4 rounded-xl border border-semi-color-border bg-semi-color-bg-1 p-4'>
                <p className='text-sm text-semi-color-text-1'>
                  📦 {t('安装依赖：')}<code className='px-2 py-1 rounded bg-semi-color-fill-0 text-semi-color-text-0'>pip install openai</code>
                </p>
              </div>
            </div>

            <div className='mt-8 rounded-3xl border border-semi-color-border bg-gradient-to-br from-semi-color-bg-0 to-semi-color-bg-1 p-6 md:p-10'>
              <h2 className='text-2xl md:text-3xl font-bold text-semi-color-text-0'>
                {t('Node.js 示例')}
              </h2>
              <p className='mt-3 text-sm md:text-base text-semi-color-text-1'>
                {t('使用 OpenAI Node.js SDK 调用接口：')}
              </p>
              <div className='mt-5 rounded-2xl border border-semi-color-border bg-[#0b1220] p-5 text-left relative'>
                <Button
                  type='tertiary'
                  icon={<IconCopy />}
                  className='absolute top-3 right-3 !text-gray-400 hover:!text-white'
                  onClick={() => handleCopy(nodeExample)}
                />
                <pre className='text-sm md:text-base text-[#93c5fd] overflow-x-auto'>
                  <code>{nodeExample}</code>
                </pre>
              </div>
              <div className='mt-4 rounded-xl border border-semi-color-border bg-semi-color-bg-0 p-4'>
                <p className='text-sm text-semi-color-text-1'>
                  📦 {t('安装依赖：')}<code className='px-2 py-1 rounded bg-semi-color-fill-0 text-semi-color-text-0'>npm install openai</code>
                </p>
              </div>
            </div>

            <div className='mt-8 rounded-3xl border border-semi-color-border bg-gradient-to-r from-cyan-100/70 via-sky-100/60 to-emerald-100/60 dark:from-semi-color-bg-0 dark:via-semi-color-bg-0 dark:to-semi-color-bg-0 p-7 md:p-10 text-center'>
              <h2 className='text-2xl md:text-3xl font-bold text-semi-color-text-0'>
                {t('准备好开始了吗？')}
              </h2>
              <p className='mt-3 text-sm md:text-base text-semi-color-text-1'>
                {t('立即注册账号，免费获取 API Key 开始使用')}
              </p>
              <div className='mt-6 flex flex-row gap-3 md:gap-4 justify-center items-center'>
                <Link to='/register'>
                  <Button
                    theme='solid'
                    type='primary'
                    size={isMobile ? 'default' : 'large'}
                    className='!rounded-3xl px-8 py-2 shadow-sm'
                  >
                    {t('立即注册')}
                  </Button>
                </Link>
                <Link to='/console/token'>
                  <Button
                    size={isMobile ? 'default' : 'large'}
                    className='flex items-center !rounded-3xl px-6 py-2 border border-semi-color-border bg-semi-color-bg-0'
                  >
                    {t('前往控制台')}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Document;
