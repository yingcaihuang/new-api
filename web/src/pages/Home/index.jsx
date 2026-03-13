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

import React, { useContext, useEffect, useState } from 'react';
import {
  Button,
  Input,
  ScrollList,
  ScrollItem,
} from '@douyinfe/semi-ui';
import { API, showError, copy, showSuccess } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { API_ENDPOINTS } from '../../constants/common.constant';
import { StatusContext } from '../../context/Status';
import { useActualTheme } from '../../context/Theme';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import { IconPlay, IconFile, IconCopy } from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';
import NoticeModal from '../../components/layout/NoticeModal';
import {
  Moonshot,
  OpenAI,
  XAI,
  Zhipu,
  Volcengine,
  Cohere,
  Claude,
  Gemini,
  Suno,
  Minimax,
  Wenxin,
  Spark,
  Qingyan,
  DeepSeek,
  Qwen,
  Midjourney,
  Grok,
  AzureAI,
  Hunyuan,
  Xinference,
} from '@lobehub/icons';

const Home = () => {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const actualTheme = useActualTheme();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;
  const serverAddress =
    statusState?.status?.server_address || `${window.location.origin}`;
  const endpointItems = API_ENDPOINTS.map((e) => ({ value: e }));
  const [endpointIndex, setEndpointIndex] = useState(0);
  const coreValues = [
    {
      title: '统一接口标准',
      desc: '兼容 OpenAI API 协议，无需改动现有业务代码。',
    },
    {
      title: '多供应商聚合',
      desc: '支持接入多家主流大模型服务商，灵活选择最优模型。',
    },
    {
      title: '自动故障切换',
      desc: '智能调度与故障转移，保障业务持续稳定运行。',
    },
    {
      title: '成本优化',
      desc: '多 Key 管理与动态调度，帮助企业降低模型调用成本。',
    },
  ];
  const productionFeatures = [
    '多模型统一管理',
    '负载均衡与高可用架构',
    '细粒度 API Key 管控',
    '调用数据统计与监控',
    '支持私有化部署',
    '兼容现有 SDK 生态',
  ];
  const techStacks = [
    'OpenAI SDK',
    'LangChain',
    'LlamaIndex',
    '各类 AI 应用框架',
  ];
  const riskPoints = [
    '不再被单一厂商绑定',
    '避免价格波动风险',
    '避免服务中断风险',
    '避免 API 变更风险',
  ];

  const displayHomePageContent = async () => {
    setHomePageContent(localStorage.getItem('home_page_content') || '');
    const res = await API.get('/api/home_page_content');
    const { success, message, data } = res.data;
    if (success) {
      let content = data;
      if (!data.startsWith('https://')) {
        content = marked.parse(data);
      }
      setHomePageContent(content);
      localStorage.setItem('home_page_content', content);

      // 如果内容是 URL，则发送主题模式
      if (data.startsWith('https://')) {
        const iframe = document.querySelector('iframe');
        if (iframe) {
          iframe.onload = () => {
            iframe.contentWindow.postMessage({ themeMode: actualTheme }, '*');
            iframe.contentWindow.postMessage({ lang: i18n.language }, '*');
          };
        }
      }
    } else {
      showError(message);
      setHomePageContent('加载首页内容失败...');
    }
    setHomePageContentLoaded(true);
  };

  const handleCopyBaseURL = async () => {
    const ok = await copy(serverAddress);
    if (ok) {
      showSuccess(t('已复制到剪切板'));
    }
  };

  useEffect(() => {
    const checkNoticeAndShow = async () => {
      const lastCloseDate = localStorage.getItem('notice_close_date');
      const today = new Date().toDateString();
      if (lastCloseDate !== today) {
        try {
          const res = await API.get('/api/notice');
          const { success, data } = res.data;
          if (success && data && data.trim() !== '') {
            setNoticeVisible(true);
          }
        } catch (error) {
          console.error('获取公告失败:', error);
        }
      }
    };

    checkNoticeAndShow();
  }, []);

  useEffect(() => {
    displayHomePageContent().then();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setEndpointIndex((prev) => (prev + 1) % endpointItems.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [endpointItems.length]);

  return (
    <div className='w-full overflow-x-hidden'>
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />
      {homePageContentLoaded && homePageContent === '' ? (
        <div className='w-full overflow-x-hidden'>
          <div className='w-full relative overflow-x-hidden pb-16 md:pb-24'>
            <div className='blur-ball blur-ball-indigo' />
            <div className='blur-ball blur-ball-teal' />
            <div className='absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(45,212,191,0.20),transparent_38%),radial-gradient(circle_at_82%_8%,rgba(56,189,248,0.16),transparent_34%),linear-gradient(to_bottom,rgba(240,249,255,0.6),transparent_55%)] pointer-events-none dark:bg-none' />

            <div className='mt-8 px-4 md:px-8 lg:px-10'>
              <div className='max-w-6xl mx-auto'>
                <div className='rounded-[28px] border border-semi-color-border bg-semi-color-bg-0/90 backdrop-blur-md shadow-[0_20px_70px_rgba(2,132,199,0.08)] p-6 md:p-10 lg:p-12 text-center'>
                  <h1 className='text-3xl md:text-5xl lg:text-6xl font-bold text-semi-color-text-0 leading-tight'>
                    统一大模型接口网关
                  </h1>
                  <p className='mt-4 text-lg md:text-2xl text-semi-color-text-1 font-medium'>
                    一次接入，全面掌控所有模型
                  </p>
                  <p className='mt-3 text-base md:text-lg text-semi-color-text-2'>
                    更低成本 · 更高稳定性 · 更自由切换
                  </p>

                  <p className='mt-8 text-sm md:text-base text-semi-color-text-1'>
                    只需将模型 Base URL 替换为：
                  </p>

                  <div className='mt-4 max-w-2xl mx-auto rounded-2xl border border-semi-color-border bg-semi-color-bg-1/80 p-3 md:p-4'>
                    <Input
                      readonly
                      value={serverAddress}
                      className='flex-1 !rounded-full !bg-semi-color-bg-0'
                      size={isMobile ? 'default' : 'large'}
                      suffix={
                        <div className='flex items-center gap-2'>
                          <ScrollList
                            bodyHeight={32}
                            style={{ border: 'unset', boxShadow: 'unset' }}
                          >
                            <ScrollItem
                              mode='wheel'
                              cycled={true}
                              list={endpointItems}
                              selectedIndex={endpointIndex}
                              onSelect={({ index }) => setEndpointIndex(index)}
                            />
                          </ScrollList>
                          <Button
                            type='primary'
                            onClick={handleCopyBaseURL}
                            icon={<IconCopy />}
                            className='!rounded-full'
                          />
                        </div>
                      }
                    />
                  </div>

                  <p className='mt-4 text-sm md:text-base text-semi-color-text-1'>
                    即可接入多家主流大模型供应商。
                  </p>

                  <div className='mt-7 flex flex-row gap-3 md:gap-4 justify-center items-center'>
                    <Link to='/'>
                      <Button
                        theme='solid'
                        type='primary'
                        size={isMobile ? 'default' : 'large'}
                        className='!rounded-3xl px-8 py-2 shadow-sm'
                        icon={<IconPlay />}
                      >
                        立即接入
                      </Button>
                    </Link>
                    <Button
                      size={isMobile ? 'default' : 'large'}
                      className='flex items-center !rounded-3xl px-6 py-2 border border-semi-color-border bg-semi-color-bg-1'
                      icon={<IconFile />}
                      onClick={() => window.open('/', '_blank')}
                    >
                      查看文档
                    </Button>
                  </div>
                </div>

                <div className='mt-8 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-11 gap-3 rounded-2xl border border-semi-color-border bg-semi-color-bg-1/70 p-4'>
                  <div className='h-12 flex items-center justify-center rounded-xl border border-semi-color-border bg-semi-color-bg-0'>
                    <Moonshot size={36} />
                  </div>
                  <div className='h-12 flex items-center justify-center rounded-xl border border-semi-color-border bg-semi-color-bg-0'>
                    <OpenAI size={36} />
                  </div>
                  <div className='h-12 flex items-center justify-center rounded-xl border border-semi-color-border bg-semi-color-bg-0'>
                    <XAI size={36} />
                  </div>
                  <div className='h-12 flex items-center justify-center rounded-xl border border-semi-color-border bg-semi-color-bg-0'>
                    <Zhipu.Color size={36} />
                  </div>
                  <div className='h-12 flex items-center justify-center rounded-xl border border-semi-color-border bg-semi-color-bg-0'>
                    <Volcengine.Color size={36} />
                  </div>
                  <div className='h-12 flex items-center justify-center rounded-xl border border-semi-color-border bg-semi-color-bg-0'>
                    <Cohere.Color size={36} />
                  </div>
                  <div className='h-12 flex items-center justify-center rounded-xl border border-semi-color-border bg-semi-color-bg-0'>
                    <Claude.Color size={36} />
                  </div>
                  <div className='h-12 flex items-center justify-center rounded-xl border border-semi-color-border bg-semi-color-bg-0'>
                    <Gemini.Color size={36} />
                  </div>
                  <div className='h-12 flex items-center justify-center rounded-xl border border-semi-color-border bg-semi-color-bg-0'>
                    <DeepSeek.Color size={36} />
                  </div>
                  <div className='h-12 flex items-center justify-center rounded-xl border border-semi-color-border bg-semi-color-bg-0'>
                    <Qwen.Color size={36} />
                  </div>
                  <div className='h-12 flex items-center justify-center rounded-xl border border-semi-color-border bg-semi-color-bg-0 text-semi-color-text-1 font-semibold text-lg'>
                    30+
                  </div>
                </div>

                <div className='mt-10 rounded-3xl border border-semi-color-border bg-semi-color-bg-0 p-6 md:p-10'>
                  <h2 className='text-2xl md:text-3xl font-bold text-semi-color-text-0'>
                    为什么选择我们的网关？
                  </h2>
                  <div className='mt-6 grid grid-cols-1 md:grid-cols-2 gap-4'>
                    {coreValues.map((item) => (
                      <div
                        key={item.title}
                        className='rounded-2xl border border-semi-color-border bg-semi-color-bg-1 p-5 text-left'
                      >
                        <p className='text-base md:text-lg font-semibold text-semi-color-text-0'>
                          🔹 {item.title}
                        </p>
                        <p className='mt-2 text-sm md:text-base text-semi-color-text-1 leading-7'>
                          {item.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className='mt-8 rounded-3xl border border-semi-color-border bg-gradient-to-br from-semi-color-bg-0 to-semi-color-bg-1 p-6 md:p-10'>
                  <h2 className='text-2xl md:text-3xl font-bold text-semi-color-text-0'>
                    为生产环境而设计
                  </h2>
                  <div className='mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
                    {productionFeatures.map((item) => (
                      <div
                        key={item}
                        className='rounded-xl border border-semi-color-border bg-semi-color-bg-0 px-4 py-3 text-sm md:text-base text-semi-color-text-1'
                      >
                        ✅ {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className='mt-8 rounded-3xl border border-semi-color-border bg-semi-color-bg-0 p-6 md:p-10'>
                  <h2 className='text-2xl md:text-3xl font-bold text-semi-color-text-0'>
                    开发者零迁移成本
                  </h2>
                  <p className='mt-4 text-sm md:text-base text-semi-color-text-1'>
                    如果你正在使用：
                  </p>
                  <div className='mt-4 flex flex-wrap gap-2'>
                    {techStacks.map((item) => (
                      <span
                        key={item}
                        className='px-3 py-1.5 rounded-full text-sm bg-semi-color-fill-0 border border-semi-color-border text-semi-color-text-1'
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                  <p className='mt-5 text-sm md:text-base text-semi-color-text-1'>
                    只需修改：
                  </p>
                  <div className='mt-3 rounded-2xl border border-semi-color-border bg-[#0b1220] px-5 py-4 text-left'>
                    <code className='text-sm md:text-base text-[#93c5fd]'>
                      base_url = "http://localhost:3000"
                    </code>
                  </div>
                  <p className='mt-4 text-sm md:text-base text-semi-color-text-1'>
                    无需重构代码，即可实现多模型调度能力。
                  </p>
                </div>

                <div className='mt-8 rounded-3xl border border-semi-color-border bg-semi-color-bg-0 p-6 md:p-10'>
                  <h2 className='text-2xl md:text-3xl font-bold text-semi-color-text-0'>
                    统一网关，让模型选择权回到你手中。
                  </h2>
                  <div className='mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3'>
                    {riskPoints.map((item) => (
                      <div
                        key={item}
                        className='rounded-xl border border-semi-color-border bg-semi-color-bg-1 px-4 py-3 text-sm md:text-base text-semi-color-text-1'
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className='mt-8 rounded-3xl border border-semi-color-border bg-gradient-to-r from-cyan-100/70 via-sky-100/60 to-emerald-100/60 dark:from-semi-color-bg-0 dark:via-semi-color-bg-0 dark:to-semi-color-bg-0 p-7 md:p-10 text-center'>
                  <h2 className='text-2xl md:text-3xl font-bold text-semi-color-text-0'>
                    准备好统一你的模型入口了吗？
                  </h2>
                  <p className='mt-3 text-sm md:text-base text-semi-color-text-1'>
                    现在开始，仅需 1 分钟完成接入。
                  </p>
                  <div className='mt-6 flex flex-row gap-3 md:gap-4 justify-center items-center'>
                    <Link to='/'>
                      <Button
                        theme='solid'
                        type='primary'
                        size={isMobile ? 'default' : 'large'}
                        className='!rounded-3xl px-8 py-2 shadow-sm'
                      >
                        免费开始
                      </Button>
                    </Link>
                    <Button
                      size={isMobile ? 'default' : 'large'}
                      className='flex items-center !rounded-3xl px-6 py-2 border border-semi-color-border bg-semi-color-bg-0'
                      icon={<IconFile />}
                      onClick={() => window.open('/', '_blank')}
                    >
                      查看部署指南
                    </Button>
                  </div>
                </div>

                <div className='mt-10 w-full'>
                  <p className='text-center text-sm md:text-base text-semi-color-text-2 mb-4'>
                    支持众多的大模型供应商
                  </p>
                  <div className='flex flex-wrap items-center justify-center gap-3'>
                    <Suno size={28} />
                    <Minimax.Color size={28} />
                    <Wenxin.Color size={28} />
                    <Spark.Color size={28} />
                    <Qingyan.Color size={28} />
                    <Midjourney size={28} />
                    <Grok size={28} />
                    <AzureAI.Color size={28} />
                    <Hunyuan.Color size={28} />
                    <Xinference.Color size={28} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className='overflow-x-hidden w-full'>
          {homePageContent.startsWith('https://') ? (
            <iframe
              src={homePageContent}
              className='w-full h-screen border-none'
            />
          ) : (
            <div
              className='mt-[60px]'
              dangerouslySetInnerHTML={{ __html: homePageContent }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
