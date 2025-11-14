import type { MessagePayload, StoredUrl, StoredSubtitle } from '../types';
import { MessageType, ActionType } from '../types';

// Configuration for the backend server
const BACKEND_URL = 'http://localhost:8096/api/v1/submit';

// 存储视频ID对应的pot参数
const potCache = new Map<string, string>();

export default defineBackground(() => {
  console.log('Bili UP Extension background script loaded', { id: browser.runtime.id });

  // 监听网络请求以获取pot参数（仅在 Chrome/Edge 中可用）
  if (browser.webRequest && browser.webRequest.onBeforeRequest) {
    browser.webRequest.onBeforeRequest.addListener(
      (details) => {
        try {
          const url = new URL(details.url);
          const pot = url.searchParams.get('pot');
          const v = url.searchParams.get('v');

          if (pot && v) {
            potCache.set(v, pot);
            console.log(`Background: Captured pot parameter for video ${v}: ${pot}`);
          }
        } catch (error) {
          console.error('Error parsing URL:', error);
        }
        return undefined; // 不阻止请求
      },
      {
        urls: ['*://www.youtube.com/api/timedtext*'],
      }
    );
  }

  // 监听来自 content script 的消息
  browser.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
    console.log('Background received message:', message);

    // 处理特殊的action格式（兼容原始扩展）
    if (message.action === 'saveUrl') {
      handleSaveUrlToBackend(message)
        .then((result) => sendResponse({ success: true, message: result }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true; // 表示异步响应
    }

    if (message.action === 'getPotParameter') {
      const pot = potCache.get(message.videoId);
      console.log(`Background: Requested pot parameter for video ${message.videoId}: ${pot || 'not found'}`);
      sendResponse({ pot: pot });
      return true;
    }

    if (message.action === 'storePotParameter') {
      if (message.videoId && message.pot) {
        potCache.set(message.videoId, message.pot);
        console.log(`Background: Stored pot parameter from page interceptor for video ${message.videoId}: ${message.pot}`);
      }
      return true;
    }

    // 处理新的MessageType格式
    switch (message.type) {
      case MessageType.SAVE_URL:
        handleSaveUrl(message.data)
          .then((result) => sendResponse({ success: true, data: result }))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;

      case MessageType.SAVE_SUBTITLE:
        handleSaveSubtitle(message.data)
          .then((result) => sendResponse({ success: true, data: result }))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;

      case MessageType.GET_TRANSCRIPT:
        handleGetTranscript(message.data)
          .then((result) => sendResponse({ success: true, data: result }))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
        return true; // 改为 true 以保持一致性
    }
  });
});

/**
 * 保存 URL 到本地存储
 */
async function handleSaveUrl(data: { url: string; title: string }): Promise<StoredUrl> {
  const { url, title } = data;
  const timestamp = Date.now();
  
  const storedUrl: StoredUrl = {
    url,
    title,
    timestamp,
  };

  // 获取现有的 URLs
  const result = await browser.storage.local.get('savedUrls');
  const savedUrls: StoredUrl[] = (result.savedUrls as StoredUrl[] | undefined) || [];
  
  // 添加新的 URL
  savedUrls.unshift(storedUrl);
  
  // 限制保存数量（最多 100 个）
  if (savedUrls.length > 100) {
    savedUrls.pop();
  }
  
  // 保存到存储
  await browser.storage.local.set({ savedUrls });
  
  console.log('URL saved:', storedUrl);
  return storedUrl;
}

/**
 * 保存字幕到本地存储
 */
async function handleSaveSubtitle(data: { url: string; title: string; content: string }): Promise<StoredSubtitle> {
  const { url, title, content } = data;
  const timestamp = Date.now();
  
  const storedSubtitle: StoredSubtitle = {
    url,
    title,
    content,
    timestamp,
  };

  // 获取现有的字幕
  const result = await browser.storage.local.get('savedSubtitles');
  const savedSubtitles: StoredSubtitle[] = (result.savedSubtitles as StoredSubtitle[] | undefined) || [];
  
  // 添加新的字幕
  savedSubtitles.unshift(storedSubtitle);
  
  // 限制保存数量（最多 50 个）
  if (savedSubtitles.length > 50) {
    savedSubtitles.pop();
  }
  
  // 保存到存储
  await browser.storage.local.set({ savedSubtitles });
  
  console.log('Subtitle saved:', storedSubtitle);
  return storedSubtitle;
}

/**
 * 获取视频字幕（YouTube Transcript API）
 */
async function handleGetTranscript(data: { url: string }): Promise<any> {
  // 这里可以实现获取 YouTube 字幕的逻辑
  // 由于 YouTube Transcript API 通常需要在页面上下文中运行
  // 这个功能将在 content script 中实现
  throw new Error('Transcript fetching should be handled in content script');
}

/**
 * 保存URL到后端服务器（兼容原始扩展格式）
 */
async function handleSaveUrlToBackend(message: any): Promise<string> {
  try {
    console.log('保存视频信息到后端:', {
      url: message.url,
      title: message.title,
      description: message.description,
      operationType: message.operationType,
      subtitles: message.subtitles ? `${message.subtitles.length} 条字幕` : '无字幕',
      playlistId: message.playlistId,
    });

    // 获取认证信息
    const authData = await browser.storage.local.get(['authToken', 'username']);

    // 准备请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 添加授权令牌
    if (authData.authToken) {
      headers['Authorization'] = `Bearer ${authData.authToken}`;
    }

    // 准备请求数据
    const requestData = {
      url: message.url,
      title: message.title,
      description: message.description,
      operationType: message.operationType, // "translation" or "download"
      status: 'pending',
      playlistId: message.playlistId,
      subtitles: message.subtitles,
      timestamp: new Date().toISOString(),
    };

    console.log('Sending request to:', BACKEND_URL);
    console.log('Request data:', requestData);

    // 发送请求到后端
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestData),
    });

    console.log('Response status:', response.status);

    // 检查响应状态码 - 200和201都表示成功
    if (!response.ok && response.status !== 201) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      throw new Error(`Server responded with status: ${response.status} - ${errorText}`);
    }

    // 如果是201状态码，表示添加成功
    if (response.status === 201) {
      console.log('Video added successfully with status 201');
    }

    const result = await response.json();
    console.log('Response data:', result);

    const subtitleInfo = message.subtitles ? ` (含 ${message.subtitles.length} 条字幕)` : '';
    return `视频信息已保存到服务器${subtitleInfo}`;
  } catch (error: any) {
    console.error('保存到服务器失败:', error);
    throw new Error(error.message || '网络错误或服务器不可用');
  }
}
