/**
 * API 工具模块 - 与后端服务器通信
 */

import type { Video, VideoDetail, User, AuthStatusResponse } from '../types';

// 从 storage 获取后端 URL
async function getBackendUrl(): Promise<string> {
  try {
    const browserApi = (globalThis as any).browser || (globalThis as any).chrome;
    const result = await browserApi.storage.local.get('backendUrl');
    const baseUrl = result.backendUrl || 'http://localhost:8096';
    // 确保URL格式正确，添加/api/v1前缀
    return baseUrl.replace(/\/api\/v1$/, '') + '/api/v1';
  } catch {
    return 'http://localhost:8096/api/v1';
  }
}

export interface ApiResponse<T = any> {
  code: number;
  message?: string;
  data?: T;
}

export interface QRCodeResponse {
  qr_code_url: string;
  auth_code: string;
}

export interface LoginInfo {
  token_info?: {
    mid?: number;
    uname?: string;
    face?: string;
    access_token?: string;
    refresh_token?: string;
  };
}

export interface LoginStatus {
  login_info?: LoginInfo;
  is_logged_in?: boolean;
}

export interface VideoListResponse {
  videos: Video[];
  total: number;
  page: number;
  limit: number;
}

/**
 * API 请求封装
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const API_BASE_URL = await getBackendUrl();
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

/**
 * 认证相关 API
 */
export const authApi = {
  /**
   * 获取登录二维码
   */
  async getQRCode(): Promise<QRCodeResponse> {
    const response = await request<QRCodeResponse>('/auth/qrcode');
    console.log('getQRCode response:', response);
    
    // 后端可能返回的格式：
    // 1. { code: 0, data: { qr_code_url, auth_code } }
    // 2. { code: 0, message: "success", qr_code_url, auth_code } (数据在根层级)
    
    if (response.code === 0) {
      // 如果数据在 data 字段中
      if (response.data && response.data.qr_code_url) {
        return response.data;
      }
      // 如果数据在根层级（兼容处理）
      if ((response as any).qr_code_url) {
        return {
          qr_code_url: (response as any).qr_code_url,
          auth_code: (response as any).auth_code,
        };
      }
    }
    
    throw new Error(response.message || '获取二维码失败');
  },

  /**
   * 轮询检查登录状态
   */
  async pollLoginStatus(authCode: string): Promise<LoginStatus | null> {
    try {
      const response = await request<{ login_info?: LoginInfo }>('/auth/poll', {
        method: 'POST',
        body: JSON.stringify({ auth_code: authCode }),
      });
      
      if (response.code === 0 && response.data?.login_info) {
        // 后端返回的结构是 { login_info: {...} }
        // 转换为前端期望的 LoginStatus 结构
        return {
          login_info: response.data.login_info,
          is_logged_in: true
        };
      }
      return null;
    } catch (error) {
      console.error('Poll login status failed:', error);
      return null;
    }
  },

  /**
   * 获取当前用户状态
   */
  async getUserStatus(): Promise<AuthStatusResponse | null> {
    try {
      const response = await request<AuthStatusResponse>('/auth/status');
      
      // 如果数据在 data 字段中
      if (response && response.data && (response.code === 0 || response.code === 200)) {
        return {
          code: response.code,
          message: response.message || 'success',
          is_logged_in: response.data.is_logged_in || false,
          user: response.data.user
        };
      }
      
      // 如果数据直接在响应根层级（这种情况下response本身就是AuthStatusResponse）
      if (response && (response as any).is_logged_in !== undefined) {
        return response as AuthStatusResponse;
      }
      
      return {
        code: response?.code || -1,
        message: response?.message || '获取用户状态失败',
        is_logged_in: false
      };
    } catch (error) {
      console.error('Get user status failed:', error);
      return null;
    }
  },

  /**
   * 退出登录
   */
  async logout(): Promise<boolean> {
    try {
      const response = await request('/auth/logout', {
        method: 'POST',
      });
      return response.code === 0;
    } catch (error) {
      console.error('Logout failed:', error);
      return false;
    }
  },
};

// 提交视频数据的接口类型
export interface VideoSubmissionData {
  platform: 'youtube' | 'bilibili';
  video_id: string;
  title: string;
  description?: string;
  duration?: number;
  uploader_name?: string;
  uploader_id?: string;
  url: string;
  thumbnail_url?: string;
  subtitles?: {
    title: string;
    language: string;
    language_code: string;
    content: Array<{
      text: string;
      duration: number;
      offset: number;
      lang: string;
    }>;
  };
  timestamp?: string;
  source?: string;
}

export interface VideoSubmissionResponse {
  success: boolean;
  message: string;
  task_id?: string;
  data?: any;
}

/**
 * 视频相关 API
 */
export const videoApi = {
  /**
   * 提交视频和字幕数据
   */
  async submitVideoData(data: VideoSubmissionData): Promise<VideoSubmissionResponse> {
    try {
      console.log('[API提交] 开始提交数据到后端...');
      console.log('[API提交] 提交数据:', data);

      // 转换为后端期望的格式
      const backendData = {
        url: data.url,
        title: data.title,
        description: data.description || '',
        operationType: 'submit_from_extension',
        subtitles: data.subtitles?.content || [],
        playlistId: '',
        timestamp: data.timestamp || new Date().toISOString(),
        savedAt: new Date().toISOString()
      };

      console.log('[API提交] 转换后的数据:', backendData);

      const response = await request<any>('/submit', {
        method: 'POST',
        body: JSON.stringify(backendData),
      });

      console.log('[API提交] 后端响应:', response);

      if ((response as any).success === true) {
        return {
          success: true,
          message: response.message || '提交成功',
          task_id: (response as any).data?.id?.toString() || undefined,
          data: (response as any).data
        };
      } else {
        return {
          success: false,
          message: response.message || (response as any).message || '提交失败'
        };
      }
    } catch (error) {
      console.error('[API提交] 提交失败:', error);
      return {
        success: false,
        message: `提交失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },

  /**
   * 获取视频列表
   */
  async getVideoList(page = 1, limit = 10): Promise<VideoListResponse> {
    const response = await request<VideoListResponse>(`/videos?page=${page}&limit=${limit}`);
    if (response.code === 200 || response.code === 0) {
      return response.data || { videos: [], total: 0, page, limit };
    }
    throw new Error(response.message || '获取视频列表失败');
  },

  /**
   * 获取视频详情
   */
  async getVideoDetail(videoId: string): Promise<VideoDetail> {
    const response = await request<VideoDetail>(`/videos/${videoId}`);
    if (response.code === 200 || response.code === 0) {
      if (!response.data) {
        throw new Error('视频不存在');
      }
      return response.data;
    }
    throw new Error(response.message || '获取视频详情失败');
  },

  /**
   * 重试任务步骤
   */
  async retryTaskStep(videoId: string, stepName: string): Promise<boolean> {
    const response = await request(`/videos/${videoId}/steps/${stepName}/retry`, {
      method: 'POST',
    });
    return response.code === 200 || response.code === 0;
  },
};

/**
 * 配置相关 API
 */
export const configApi = {
  /**
   * 获取DeepSeek配置
   */
  async getDeepSeekConfig(): Promise<any> {
    const response = await request('/config/deepseek');
    if (response.code === 200) {
      return response.data;
    }
    throw new Error(response.message || '获取配置失败');
  },

  /**
   * 更新DeepSeek配置
   */
  async updateDeepSeekConfig(config: {
    enabled?: boolean;
    api_key?: string;
    model?: string;
    endpoint?: string;
    timeout?: number;
    max_tokens?: number;
  }): Promise<boolean> {
    const response = await request('/config/deepseek', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
    return response.code === 200;
  },

  /**
   * 获取代理配置
   */
  async getProxyConfig(): Promise<any> {
    const response = await request('/config/proxy');
    if (response.code === 200 || response.code === 0) {
      return response.data;
    }
    throw new Error(response.message || '获取代理配置失败');
  },

  /**
   * 更新代理配置
   */
  async updateProxyConfig(config: {
    useProxy?: boolean;
    proxyHost?: string;
  }): Promise<boolean> {
    const response = await request('/config/proxy', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
    return response.code === 200 || response.code === 0;
  },
};

/**
 * 便捷函数：检查用户是否已登录
 */
export async function checkLoginStatus(): Promise<{ 
  isLoggedIn: boolean; 
  user?: User;
  error?: string;
}> {
  try {
    const status = await authApi.getUserStatus();
    if (!status) {
      return { 
        isLoggedIn: false, 
        error: '无法连接到服务器' 
      };
    }
    
    if (status.code === 0 && status.is_logged_in && status.user) {
      return {
        isLoggedIn: true,
        user: status.user
      };
    }
    
    return {
      isLoggedIn: false,
      error: status.message || '用户未登录'
    };
  } catch (error) {
    console.error('检查登录状态失败:', error);
    return {
      isLoggedIn: false,
      error: '检查登录状态失败'
    };
  }
}

export default {
  authApi,
  videoApi,
  configApi,
  checkLoginStatus,
};

