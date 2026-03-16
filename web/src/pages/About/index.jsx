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
import { API, showError } from '../../helpers';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../hooks/common/useIsMobile';

const About = () => {
  const { t } = useTranslation();
  const [about, setAbout] = useState('');
  const [aboutLoaded, setAboutLoaded] = useState(false);
  const isMobile = useIsMobile();
  const currentYear = new Date().getFullYear();

  const displayAbout = async () => {
    setAbout(localStorage.getItem('about') || '');
    const res = await API.get('/api/about');
    const { success, message, data } = res.data;
    if (success) {
      let aboutContent = data;
      if (!data.startsWith('https://')) {
        aboutContent = marked.parse(data);
      }
      setAbout(aboutContent);
      localStorage.setItem('about', aboutContent);
    } else {
      showError(message);
      setAbout(t('加载关于内容失败...'));
    }
    setAboutLoaded(true);
  };

  useEffect(() => {
    displayAbout().then();
  }, []);

  const features = [
    {
      title: t('统一接口标准'),
      desc: t('兼容主流 API 协议，提供统一的接口规范，简化开发流程。'),
    },
    {
      title: t('高性能架构'),
      desc: t('采用现代化技术栈，支持高并发访问，保障系统稳定运行。'),
    },
    {
      title: t('灵活扩展'),
      desc: t('模块化设计，支持自定义配置，轻松满足不同业务需求。'),
    },
    {
      title: t('专业服务'),
      desc: t('提供完善的技术支持，持续更新迭代，保障服务质量。'),
    },
  ];

  const advantages = [
    {
      title: t('稳定可靠'),
      desc: t('7×24小时稳定运行，完善的监控和告警机制。'),
    },
    {
      title: t('安全保障'),
      desc: t('多重安全防护措施，保护数据安全和隐私。'),
    },
    {
      title: t('快速响应'),
      desc: t('专业技术团队支持，快速响应和解决问题。'),
    },
    {
      title: t('持续优化'),
      desc: t('根据用户反馈持续改进，不断提升用户体验。'),
    },
  ];

  return (
    <div className='w-full overflow-x-hidden'>
      {aboutLoaded && about === '' ? (
        <div className='w-full overflow-x-hidden pb-16 md:pb-24'>
          <div className='blur-ball blur-ball-indigo' />
          <div className='blur-ball blur-ball-teal' />
          <div className='absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(45,212,191,0.20),transparent_38%),radial-gradient(circle_at_82%_8%,rgba(56,189,248,0.16),transparent_34%),linear-gradient(to_bottom,rgba(240,249,255,0.6),transparent_55%)] pointer-events-none dark:bg-none' />

          <div className='mt-8 px-4 md:px-8 lg:px-10'>
            <div className='max-w-6xl mx-auto'>
              <div className='rounded-[28px] border border-semi-color-border bg-semi-color-bg-0/90 backdrop-blur-md shadow-[0_20px_70px_rgba(2,132,199,0.08)] p-6 md:p-10 lg:p-12 text-center'>
                <h1 className='text-3xl md:text-5xl font-bold text-semi-color-text-0 leading-tight'>
                  {t('关于我们')}
                </h1>
                <p className='mt-4 text-base md:text-lg text-semi-color-text-1 max-w-3xl mx-auto leading-relaxed'>
                  {t('我们致力于打造一个强大、易用的开源平台，为开发者提供优质的服务和工具，帮助企业和个人开发者更高效地构建应用。')}
                </p>
              </div>

              <div className='mt-8 rounded-3xl border border-semi-color-border bg-semi-color-bg-0 p-6 md:p-10'>
                <h2 className='text-2xl md:text-3xl font-bold text-semi-color-text-0'>
                  {t('核心特性')}
                </h2>
                <div className='mt-6 grid grid-cols-1 md:grid-cols-2 gap-4'>
                  {features.map((item) => (
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
                  {t('服务优势')}
                </h2>
                <div className='mt-6 grid grid-cols-1 md:grid-cols-2 gap-4'>
                  {advantages.map((item) => (
                    <div
                      key={item.title}
                      className='rounded-2xl border border-semi-color-border bg-semi-color-bg-0 p-5 text-left'
                    >
                      <p className='text-base md:text-lg font-semibold text-semi-color-text-0'>
                        ✨ {item.title}
                      </p>
                      <p className='mt-2 text-sm md:text-base text-semi-color-text-1 leading-7'>
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className='mt-8 rounded-3xl border border-semi-color-border bg-semi-color-bg-0 p-6 md:p-10'>
                <h2 className='text-2xl md:text-3xl font-bold text-semi-color-text-0 text-center'>
                  {t('平台介绍')}
                </h2>
                <div className='mt-5 space-y-4'>
                  <div className='rounded-xl border border-semi-color-border bg-semi-color-bg-1 p-5'>
                    <p className='text-sm md:text-base text-semi-color-text-1 leading-relaxed text-center'>
                      {t('我们专注于为企业和开发者提供高效、稳定的 API 服务解决方案。通过先进的技术架构和完善的服务体系，助力用户快速构建和部署应用。')}
                    </p>
                  </div>

                  <div className='rounded-xl border border-semi-color-border bg-semi-color-bg-1 p-5'>
                    <p className='text-sm md:text-base text-semi-color-text-1 leading-relaxed text-center'>
                      {t('平台经过长期的技术积累和优化，已服务众多企业客户，在性能、安全性和稳定性方面得到了充分验证。')}
                    </p>
                  </div>

                  {/* <div className='rounded-xl border border-semi-color-border bg-semi-color-bg-1 p-5 text-center'>
                    <p className='text-sm md:text-base text-semi-color-text-2'>
                      © {currentYear} 版权所有
                    </p>
                  </div> */}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {about.startsWith('https://') ? (
            <iframe
              src={about}
              style={{ width: '100%', height: '100vh', border: 'none' }}
            />
          ) : (
            <div
              className='mt-[60px] px-4 md:px-8 lg:px-10'
              style={{ fontSize: 'larger' }}
              dangerouslySetInnerHTML={{ __html: about }}
            ></div>
          )}
        </>
      )}
    </div>
  );
};

export default About;
