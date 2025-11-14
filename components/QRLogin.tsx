import React, { useState, useEffect } from 'react';
import { authApi, type QRCodeResponse, type LoginInfo } from '../utils/api';

interface QRLoginProps {
  onLoginSuccess?: (loginInfo: LoginInfo) => void;
  onRefreshStatus?: () => void;
}

export const QRLogin: React.FC<QRLoginProps> = ({ onLoginSuccess, onRefreshStatus }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [authCode, setAuthCode] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'scanning' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [polling, setPolling] = useState<boolean>(false);

  // 生成二维码
  const generateQRCode = async () => {
    setStatus('loading');
    setMessage('正在生成二维码...');

    try {
      // 获取后端服务器地址
      const result = await browser.storage.local.get('backendUrl');
      const backendUrl = result.backendUrl || 'http://localhost:8096';
      
      console.log('🔧 Getting QR code from:', `${backendUrl}/api/v1/auth/qrcode`);
      
      // 直接调用后端API，不通过封装的authApi
      const response = await fetch(`${backendUrl}/api/v1/auth/qrcode`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('QR Code API Response:', data);

      if (data.code === 0) {
        // 拼接完整的二维码图片URL
        let fullQrCodeUrl = data.qr_code_url;
        if (data.qr_code_url.startsWith('/')) {
          // 如果是相对路径，拼接完整的后端地址
          fullQrCodeUrl = `${backendUrl}${data.qr_code_url}`;
        }
        
        console.log('Backend URL:', backendUrl);
        console.log('QR Code Path:', data.qr_code_url);
        console.log('Full QR Code URL:', fullQrCodeUrl);
        
        setQrCodeUrl(fullQrCodeUrl);
        setAuthCode(data.auth_code);
        setStatus('scanning');
        setMessage('请使用 Bilibili 手机客户端扫描二维码');
        startPolling(data.auth_code);
      } else {
        throw new Error(data.message || '生成二维码失败');
      }
    } catch (error) {
      console.error('生成二维码失败:', error);
      setStatus('error');
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setMessage(`生成二维码失败: ${errorMessage}`);
    }
  };

  // 轮询检查登录状态
  const startPolling = (code: string) => {
    if (polling) return;

    setPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        // 直接调用后端API，不通过封装的authApi
        const result = await browser.storage.local.get('backendUrl');
        const backendUrl = result.backendUrl || 'http://localhost:8096';

        const response = await fetch(`${backendUrl}/api/v1/auth/poll`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ auth_code: code }),
        });

        const data = await response.json();
        console.log('Poll response:', data);

        if (data.code === 0 && data.login_info) {
          // 登录成功
          setStatus('success');
          setMessage('登录成功！正在更新状态...');
          setPolling(false);
          clearInterval(pollInterval);

          // 保存登录信息到 storage
          await browser.storage.local.set({
            loginInfo: data.login_info,
            isLoggedIn: true,
          });

          console.log('✅ Login successful, saved to storage:', data.login_info);

          // 延迟调用成功回调，让用户看到成功消息
          setTimeout(() => {
            if (onRefreshStatus) {
              onRefreshStatus(); // 通知主组件刷新登录状态
            }
            
            if (onLoginSuccess) {
              onLoginSuccess(data.login_info);
            }
          }, 1000);
        } else if (response.status === 400 || response.status === 500) {
          // 二维码过期或无效
          setStatus('error');
          setMessage('二维码已过期，请重新生成');
          setPolling(false);
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('检查登录状态失败:', error);
        // 不立即停止轮询，继续尝试
      }
    }, 2000); // 每2秒检查一次

    // 5分钟后自动停止轮询
    setTimeout(() => {
      if (polling) {
        setPolling(false);
        clearInterval(pollInterval);
        if (status === 'scanning') {
          setStatus('error');
          setMessage('二维码已过期，请重新生成');
        }
      }
    }, 300000);
  };

  useEffect(() => {
    generateQRCode();

    return () => {
      setPolling(false);
    };
  }, []);

  const handleRefresh = () => {
    setPolling(false);
    generateQRCode();
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Bilibili 扫码登录</h2>
        <p className="text-sm text-gray-600">使用 Bilibili 手机客户端扫描下方二维码完成登录</p>
      </div>

      <div className="relative">
        {/* 二维码容器 */}
        <div className="w-64 h-64 border-2 border-gray-200 rounded-lg flex items-center justify-center bg-white">
          {status === 'loading' && (
            <div className="flex flex-col items-center space-y-2">
              <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm text-gray-500">生成中...</span>
            </div>
          )}

          {status === 'scanning' && qrCodeUrl && (
            <div className="relative">
              <img
                src={qrCodeUrl}
                alt="登录二维码"
                className="w-60 h-60 rounded"
                onLoad={() => console.log('QR code image loaded successfully')}
                onError={(e) => {
                  console.error('QR code image load error:', e);
                  console.error('Failed to load QR code URL:', qrCodeUrl);
                  setStatus('error');
                  setMessage('二维码图片加载失败，请重试');
                }}
              />
              {/* 显示二维码URL用于调试 */}
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b truncate">
                {qrCodeUrl}
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center space-y-2">
              <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-green-600 font-medium">登录成功</span>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center space-y-2">
              <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-red-600 text-center px-4">{message}</span>
            </div>
          )}
        </div>

        {/* 状态指示器 */}
        {status === 'scanning' && (
          <div className="absolute -top-2 -right-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
          </div>
        )}
      </div>

      {/* 状态消息 */}
      <div className="text-center">
        <p
          className={`text-sm ${
            status === 'success' ? 'text-green-600' : status === 'error' ? 'text-red-600' : 'text-gray-600'
          }`}
        >
          {message}
        </p>
      </div>

      {/* 操作按钮 */}
      <div className="flex space-x-4">
        {(status === 'error' || status === 'idle') && (
          <button
            onClick={handleRefresh}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>重新生成</span>
          </button>
        )}

        {status === 'scanning' && (
          <button
            onClick={handleRefresh}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>刷新二维码</span>
          </button>
        )}
      </div>

      {/* 扫码说明 */}
      <div className="text-xs text-gray-500 text-center max-w-sm">
        <p>打开 Bilibili 手机客户端，点击右上角扫一扫图标， 扫描上方二维码即可快速登录</p>
      </div>
    </div>
  );
};
