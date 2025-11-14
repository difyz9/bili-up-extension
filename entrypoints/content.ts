import React from 'react';
import ReactDOM from 'react-dom/client';
import toast, { Toaster } from 'react-hot-toast';

import { VideoDataExtractor } from '../utils/video-data';
import { videoApi } from '../utils/api';
import type { VideoSubmissionData } from '../utils/api';
import './content-styles.css';

// WXT 全局函数声明（如果类型声明缺失）
declare global {
  function defineContentScript(config: any): any;
}

const browser: any = (globalThis as any).browser || (globalThis as any).chrome;

export default defineContentScript({
  matches: ['*://*.youtube.com/*', '*://*.bilibili.com/*'],
  main() {
    console.log('Bili UP Extension content script loaded');
    
    // 创建通知容器并渲染 Toaster
    const notificationContainer = document.createElement('div');
    notificationContainer.id = 'bili-up-extension-notifications';
    document.body.appendChild(notificationContainer);

    // 使用 react-hot-toast 的 Toaster 组件
    const toasterRoot = ReactDOM.createRoot(notificationContainer);
    toasterRoot.render(React.createElement(Toaster, {
      position: 'top-right',
      toastOptions: {
        duration: 4000,
        style: {
          background: '#363636',
          color: '#fff',
        },
        success: {
          duration: 3000,
          iconTheme: {
            primary: '#4ade80',
            secondary: '#fff',
          },
        },
        error: {
          duration: 5000,
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff',
          },
        },
      },
    }));

    // 监听页面拦截器发送的 pot 参数消息
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      
      if (event.data.type === 'WEB_EXTENSION_POT_INTERCEPTED' && 
          event.data.source === 'page-interceptor') {
        const { videoId, pot } = event.data.data;
        if (videoId && pot) {
          // 转发到 background script 存储
          browser.runtime.sendMessage({
            action: 'storePotParameter',
            videoId: videoId,
            pot: pot
          });
          console.log(`[Content Script] 转发 pot 参数到 background: videoId=${videoId}, pot=${pot}`);
        }
      }
    });

    // 根据页面类型注入相应的按钮
    if (window.location.hostname.includes('youtube.com')) {
      // 等待 YouTube 播放器加载完成后注入按钮
      injectYouTubePlayerButton();
    } else if (window.location.hostname.includes('bilibili.com')) {
      // 等待 Bilibili 播放器加载完成后注入按钮
      injectBilibiliPlayerButton();
    }


  },
});

    // 旧的getYouTubeVideoData函数已被VideoDataExtractor.extractFromCurrentPage()替代





/**
 * 下载文件的辅助函数
 * @param content 文件内容
 * @param fileName 文件名
 * @param mimeType MIME 类型
 */
function downloadFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // 延迟清理 URL 对象
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * 显示通知 - 使用 react-hot-toast
 */
function showNotification({ message, type }: { message: string; type: 'success' | 'error' | 'loading' }): void {
  switch (type) {
    case 'success':
      toast.success(message, { duration: 4000 });
      break;
    case 'error':
      toast.error(message, { duration: 5000 });
      break;
    case 'loading':
      toast.loading(message);
      break;
  }
}

/**
 * 注入按钮到 YouTube 播放器控制栏
 */
function injectYouTubePlayerButton() {
  const checkAndInject = () => {
    // YouTube 播放器右侧控制按钮容器的选择器
    const rightControls = document.querySelector('.ytp-right-controls');
    
    if (rightControls && !document.getElementById('bili-up-extension-button')) {
      // 创建按钮容器
      const buttonContainer = document.createElement('div');
      buttonContainer.id = 'bili-up-extension-button';
      buttonContainer.className = 'ytp-button';
      buttonContainer.style.cssText = 'position: relative; display: inline-block;';
      
      // 创建主按钮
      const mainButton = document.createElement('button');
      mainButton.className = 'ytp-button';
      mainButton.setAttribute('aria-label', 'Bili UP001 Extension');
      mainButton.setAttribute('title', 'Bili UP001 Extension');
      mainButton.style.cssText = `
        width: 48px; 
        height: 100%; 
        padding: 0;
        opacity: 0.9;
        transition: opacity 0.2s;
      `;
      mainButton.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="pointer-events: none; margin: auto; display: block;">
          <path d="M7 17L17 7M7 7h10v10" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="7" cy="17" r="1.5" fill="currentColor"/>
        </svg>
      `;
      mainButton.onmouseenter = () => mainButton.style.opacity = '1';
      mainButton.onmouseleave = () => mainButton.style.opacity = '0.9';
      
      // 主按钮点击事件 - 获取数据并提交到后端
      mainButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        try {
          showNotification({
            message: '正在获取视频信息和字幕...',
            type: 'loading'
          });

          const { videoData, subtitles } = await VideoDataExtractor.extractFromCurrentPage();
          
          console.group('🎬 视频信息提取');
          console.log('📋 基本信息:');
          console.table({
            '视频ID': videoData.videoId,
            '标题': videoData.title,
            '平台': videoData.platform,
            '时长': videoData.duration ? `${Math.floor(videoData.duration / 60)}:${String(Math.floor(videoData.duration % 60)).padStart(2, '0')}` : '未知',
            '上传者': videoData.uploader?.name || '未知',
            'URL': videoData.url
          });
          
          if (subtitles.body && subtitles.body.length > 0) {
            console.log('📜 字幕统计:');
            console.log(`🌐 语言: ${subtitles.language} (${subtitles.languageCode})`);
            console.log(`📊 总计 ${subtitles.body.length} 条字幕`);
            console.log('前3条字幕预览:', subtitles.body.slice(0, 3));
          } else {
            console.log('❌ 未找到字幕');
          }
          console.groupEnd();

          // 准备提交数据
          const submissionData: VideoSubmissionData = {
            platform: videoData.platform,
            video_id: videoData.videoId,
            title: videoData.title,
            description: videoData.description,
            duration: videoData.duration,
            uploader_name: videoData.uploader?.name,
            uploader_id: videoData.uploader?.id,
            url: videoData.url,
            thumbnail_url: videoData.thumbnailUrl,
            subtitles: {
              title: subtitles.title,
              language: subtitles.language,
              language_code: subtitles.languageCode,
              content: subtitles.body
            },
            timestamp: new Date().toISOString(),
            source: 'bili-up-extension'
          };

          showNotification({
            message: '正在提交数据到后端...',
            type: 'loading'
          });

          // 提交到后端API
          const result = await videoApi.submitVideoData(submissionData);
          
          if (result.success) {
            console.log('✅ 数据提交成功:', result);
            showNotification({
              message: `提交成功！${result.task_id ? `任务ID: ${result.task_id}` : ''}`,
              type: 'success'
            });
          } else {
            console.error('❌ 数据提交失败:', result.message);
            showNotification({
              message: `提交失败: ${result.message}`,
              type: 'error'
            });
          }
          
        } catch (error) {
          console.error('处理失败:', error);
          showNotification({
            message: error instanceof Error ? error.message : String(error),
            type: 'error'
          });
        }
      });
      
      // 创建菜单
      const menu = document.createElement('div');
      menu.id = 'bili-up-extension-menu';
      menu.style.cssText = `
        display: none;
        position: absolute;
        bottom: 60px;
        right: 0;
        background: rgba(28, 28, 28, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        min-width: 220px;
        z-index: 9999;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.1);
      `;


      
      buttonContainer.appendChild(mainButton);
      
      // 插入到播放器控制栏的最左边（在设置按钮之前）
      rightControls.insertBefore(buttonContainer, rightControls.firstChild);
      
      console.log('✓ Bili UP Extension button injected into YouTube player');
    }
  };
  
  // 初始检查
  checkAndInject();
  
  // 使用 MutationObserver 监听 DOM 变化，以处理页面动态加载
  const observer = new MutationObserver(() => {
    checkAndInject();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  // 监听 YouTube 的页面导航（单页应用）
  let lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      // URL 变化时重新注入
      setTimeout(checkAndInject, 500);
    }
  }).observe(document.querySelector('title')!, {
    childList: true,
  });
}

/**
 * 注入按钮到 Bilibili 播放器控制栏
 */
function injectBilibiliPlayerButton() {
  const checkAndInject = () => {
    // Bilibili 播放器右侧控制按钮容器的选择器
    const rightControls = document.querySelector('.bpx-player-ctrl-btn-group.right') || 
                         document.querySelector('.bilibili-player-video-control-bottom-right');
    
    if (rightControls && !document.getElementById('bili-up-extension-button')) {
      // 创建按钮容器
      const buttonContainer = document.createElement('div');
      buttonContainer.id = 'bili-up-extension-button';
      buttonContainer.className = 'bpx-player-ctrl-btn';
      buttonContainer.style.cssText = 'position: relative; display: inline-block;';
      
      // 创建主按钮
      const mainButton = document.createElement('button');
      mainButton.className = 'bpx-player-ctrl-btn';
      mainButton.setAttribute('aria-label', 'Bili UP Extension');
      mainButton.setAttribute('title', 'Bili UP Extension');
      mainButton.style.cssText = `
        width: 40px; 
        height: 40px; 
        padding: 8px;
        opacity: 0.9;
        transition: opacity 0.2s;
        background: transparent;
        border: none;
        cursor: pointer;
        color: #fff;
      `;
      mainButton.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="pointer-events: none; margin: auto; display: block;">
          <path d="M7 17L17 7M7 7h10v10" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="7" cy="17" r="1.5" fill="currentColor"/>
        </svg>
      `;
      mainButton.onmouseenter = () => mainButton.style.opacity = '1';
      mainButton.onmouseleave = () => mainButton.style.opacity = '0.9';
      
      // 主按钮点击事件 - 获取Bilibili视频信息并提交到后端
      mainButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        try {
          showNotification({
            message: '正在获取Bilibili视频信息...',
            type: 'loading'
          });

          const { videoData, subtitles } = await VideoDataExtractor.extractFromCurrentPage();
          
          console.group('🎬 Bilibili视频信息提取');
          console.log('📋 基本信息:');
          console.table({
            '视频ID': videoData.videoId,
            '标题': videoData.title,
            '平台': videoData.platform,
            '时长': videoData.duration ? `${Math.floor(videoData.duration / 60)}:${String(Math.floor(videoData.duration % 60)).padStart(2, '0')}` : '未知',
            '上传者': videoData.uploader?.name || '未知',
            'URL': videoData.url
          });
          
          console.log('📝 描述:', videoData.description || '无描述');
          console.log('📜 字幕状态: 不获取Bilibili字幕（仅获取视频基本信息）');
          console.groupEnd();

          // 准备提交数据
          const submissionData: VideoSubmissionData = {
            platform: videoData.platform,
            video_id: videoData.videoId,
            title: videoData.title,
            description: videoData.description,
            duration: videoData.duration,
            uploader_name: videoData.uploader?.name,
            uploader_id: videoData.uploader?.id,
            url: videoData.url,
            thumbnail_url: videoData.thumbnailUrl,
            subtitles: {
              title: subtitles.title,
              language: subtitles.language,
              language_code: subtitles.languageCode,
              content: subtitles.body
            },
            timestamp: new Date().toISOString(),
            source: 'bili-up-extension'
          };

          showNotification({
            message: '正在提交视频数据到后端...',
            type: 'loading'
          });

          // 提交到后端API
          const result = await videoApi.submitVideoData(submissionData);
          
          if (result.success) {
            console.log('✅ Bilibili视频数据提交成功:', result);
            showNotification({
              message: `Bilibili视频提交成功！${result.task_id ? `任务ID: ${result.task_id}` : ''}`,
              type: 'success'
            });
          } else {
            console.error('❌ Bilibili视频数据提交失败:', result.message);
            showNotification({
              message: `提交失败: ${result.message}`,
              type: 'error'
            });
          }
          
        } catch (error) {
          console.error('处理Bilibili视频失败:', error);
          showNotification({
            message: error instanceof Error ? error.message : String(error),
            type: 'error'
          });
        }
      });
      
      buttonContainer.appendChild(mainButton);
      
      // 插入到播放器控制栏的右侧
      rightControls.appendChild(buttonContainer);
      
      console.log('✓ Bili UP Extension button injected into Bilibili player');
    }
  };
  
  // 初始检查
  checkAndInject();
  
  // 使用 MutationObserver 监听 DOM 变化，以处理页面动态加载
  const observer = new MutationObserver(() => {
    checkAndInject();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  // 监听 Bilibili 的页面导航
  let lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      // URL 变化时重新注入
      setTimeout(checkAndInject, 500);
    }
  }).observe(document.querySelector('title')!, {
    childList: true,
  });
}

/**
 * 创建菜单按钮
 */
function createMenuButton(icon: string, text: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.style.cssText = `
    width: 100%;
    padding: 12px 16px;
    text-align: left;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    font-family: "YouTube Sans", "Roboto", sans-serif;
    color: #fff;
    transition: all 0.2s;
    font-weight: 400;
  `;
  button.innerHTML = `${icon}<span>${text}</span>`;
  button.onmouseenter = () => {
    button.style.background = 'rgba(255, 255, 255, 0.1)';
    button.style.transform = 'translateX(2px)';
  };
  button.onmouseleave = () => {
    button.style.background = 'transparent';
    button.style.transform = 'translateX(0)';
  };
  button.onclick = onClick;
  return button;
}
