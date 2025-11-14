import React, { useState, useEffect } from 'react';
import { QRLogin } from '../../components/QRLogin';
import { authApi, configApi, type LoginInfo } from '../../utils/api';

interface Settings {
  deepseekApiKey: string;
  backendUrl: string;
  autoSaveSubtitles: boolean;
  // 网络代理设置
  useProxy: boolean;
  proxyHost: string; // 格式: http://127.0.0.1:7890 或 socks5://127.0.0.1:1080
}

interface UserInfo {
  mid: string;
  uname: string;
  face: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<'general' | 'account' | 'about'>('general');
  const [settings, setSettings] = useState<Settings>({
    deepseekApiKey: '',
    backendUrl: 'http://localhost:8096/api/v1',
    autoSaveSubtitles: true,
    // 代理默认设置
    useProxy: false,
    proxyHost: '', // 例如: http://127.0.0.1:7890
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // 加载设置
  useEffect(() => {
    loadSettings();
    checkLoginStatus();

    // 监听存储变化，实时更新登录状态
    const handleStorageChange = (changes: { [key: string]: any }) => {
      if (changes.isLoggedIn || changes.loginInfo) {
        console.log('Storage changed, updating login status...');
        checkLoginStatus();
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const loadSettings = async () => {
    const result = await browser.storage.local.get([
      'deepseekApiKey',
      'backendUrl',
      'autoSaveSubtitles',
      'useProxy',
      'proxyHost',
    ]);

    const loadedSettings: Settings = {
      deepseekApiKey: (result.deepseekApiKey as string | undefined) || '',
      backendUrl: (result.backendUrl as string | undefined) || 'http://localhost:8096',
      autoSaveSubtitles: (result.autoSaveSubtitles as boolean | undefined) !== false,
      // 代理设置
      useProxy: (result.useProxy as boolean | undefined) || false,
      proxyHost: (result.proxyHost as string | undefined) || '',
    };

    // 尝试从后端同步DeepSeek配置
    try {
      const backendConfig = await configApi.getDeepSeekConfig();
      if (backendConfig && backendConfig.api_key && backendConfig.api_key !== '***') {
        // 如果后端有配置且不是掩码格式，优先使用后端配置
        if (!loadedSettings.deepseekApiKey) {
          loadedSettings.deepseekApiKey = backendConfig.api_key;
          // 同步回本地存储
          await browser.storage.local.set({ deepseekApiKey: backendConfig.api_key });
        }
      }
    } catch (error) {
      console.warn('Failed to load DeepSeek config from backend:', error);
    }

    // 尝试从后端同步代理配置
    try {
      const proxyConfig = await configApi.getProxyConfig();
      if (proxyConfig) {
        // 优先使用后端配置
        loadedSettings.useProxy = proxyConfig.useProxy || false;
        loadedSettings.proxyHost = proxyConfig.proxyHost || '';
        // 同步回本地存储
        await browser.storage.local.set({ 
          useProxy: loadedSettings.useProxy,
          proxyHost: loadedSettings.proxyHost
        });
      }
    } catch (error) {
      console.warn('Failed to load proxy config from backend:', error);
    }

    setSettings(loadedSettings);
  };

  const checkLoginStatus = async () => {
    try {
      // 优先使用后端 API 检查登录状态
      const status = await authApi.getUserStatus();
      
      if (status && status.code === 0 && status.is_logged_in && status.user) {
        console.log('✅ 后端登录状态检查成功:', status.user);
        setIsLoggedIn(true);
        setUserInfo({
          mid: status.user.mid,
          uname: status.user.name,
          face: status.user.avatar,
        });
        
        // 同步到本地存储
        await browser.storage.local.set({
          isLoggedIn: true,
          loginInfo: {
            token_info: {
              mid: parseInt(status.user.mid),
              uname: status.user.name,
              face: status.user.avatar,
            }
          }
        });
        return;
      }
    } catch (error) {
      console.warn('⚠️ 后端登录状态检查失败，回退到本地存储:', error);
    }

    // 回退：检查本地存储
    const result = await browser.storage.local.get(['loginInfo', 'isLoggedIn']);
    if (result.isLoggedIn && result.loginInfo) {
      console.log('📱 使用本地存储的登录状态');
      const loginInfo = result.loginInfo as any;
      setIsLoggedIn(true);
      setUserInfo({
        mid: loginInfo.token_info?.mid?.toString() || '',
        uname: loginInfo.token_info?.uname || 'Bilibili用户',
        face: loginInfo.token_info?.face || '',
      });
    } else {
      // 都没有登录信息
      setIsLoggedIn(false);
      setUserInfo(null);
    }
  };

  const handleSaveSettings = async () => {
    setSaveStatus('saving');

    try {
      // 保存到本地存储
      await browser.storage.local.set({
        deepseekApiKey: settings.deepseekApiKey,
        backendUrl: settings.backendUrl,
        autoSaveSubtitles: settings.autoSaveSubtitles,
        // 代理设置
        useProxy: settings.useProxy,
        proxyHost: settings.proxyHost,
      });

      // 同步DeepSeek API Key到后端服务器
      if (settings.deepseekApiKey.trim()) {
        try {
          await configApi.updateDeepSeekConfig({
            enabled: true,
            api_key: settings.deepseekApiKey.trim(),
          });
          console.log('✅ DeepSeek API Key synced to backend successfully');
        } catch (error) {
          console.warn('⚠️ Failed to sync DeepSeek API Key to backend:', error);
          // 不阻塞保存流程，只是记录警告
        }
      }

      // 同步代理配置到后端服务器
      try {
        await configApi.updateProxyConfig({
          useProxy: settings.useProxy,
          proxyHost: settings.proxyHost.trim(),
        });
        console.log('✅ Proxy config synced to backend successfully');
      } catch (error) {
        console.warn('⚠️ Failed to sync proxy config to backend:', error);
        // 不阻塞保存流程，只是记录警告
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('idle');
    }
  };

  const handleLogout = async () => {
    await authApi.logout();
    await browser.storage.local.remove(['loginInfo', 'isLoggedIn']);
    setIsLoggedIn(false);
    setUserInfo(null);
  };

  const handleLoginSuccess = (loginInfo: LoginInfo) => {
    console.log('✅ Login successful, updating UI state:', loginInfo);
    setShowLogin(false);
    
    // 延迟更新状态，确保存储已更新
    setTimeout(() => {
      checkLoginStatus();
    }, 100);
  };

  const handleRefreshStatus = async () => {
    // 重新检查登录状态，用于二维码登录成功后的状态同步
    await checkLoginStatus();
  };

  return (
    <div className="min-h-screen  bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Bili UP Extension</h1>
              <a
                href="http://127.0.0.1:8096"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-500 hover:text-blue-700 hover:underline cursor-pointer flex items-center space-x-1"
              >
                <span>任务列表</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="bg-white rounded-lg shadow-sm">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('general')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'general'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                通用设置
              </button>
              <button
                onClick={() => setActiveTab('account')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'account'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                账号管理
              </button>
              <button
                onClick={() => setActiveTab('about')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'about'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                关于
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {activeTab === 'general' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">API 配置</h3>

                  {/* DeepSeek API Key */}
                  <div className="space-y-2">
                    <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
                      DeepSeek API Key
                    </label>
                    <input
                      type="password"
                      id="apiKey"
                      value={settings.deepseekApiKey}
                      onChange={(e) => setSettings({ ...settings, deepseekApiKey: e.target.value })}
                      placeholder="sk-xxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500">
                      用于 AI 字幕翻译功能。获取 API Key:{' '}
                      <a
                        href="https://platform.deepseek.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        https://platform.deepseek.com
                      </a>
                    </p>
                  </div>

                  {/* Backend URL */}
                  <div className="space-y-2 mt-3">
                    <label htmlFor="backendUrl" className="block text-sm font-medium text-gray-700">
                      后端服务器地址
                    </label>
                    <input
                      type="url"
                      id="backendUrl"
                      value={settings.backendUrl}
                      onChange={(e) => setSettings({ ...settings, backendUrl: e.target.value })}
                      placeholder="http://localhost:8096"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500">视频和字幕数据将提交到此服务器</p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">网络代理</h3>
                  
                  {/* Enable Proxy Toggle */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        启用网络代理
                      </label>
                      <p className="text-xs text-gray-500">用于视频下载时的网络连接</p>
                    </div>
                    <button
                      onClick={() => setSettings({ ...settings, useProxy: !settings.useProxy })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.useProxy ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.useProxy ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Proxy Configuration */}
                  {settings.useProxy && (
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                      {/* Proxy Host */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          代理地址
                        </label>
                        <input
                          type="text"
                          value={settings.proxyHost}
                          onChange={(e) => setSettings({ ...settings, proxyHost: e.target.value })}
                          placeholder="http://127.0.0.1:7890"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500">
                          💡 支持 HTTP/HTTPS/SOCKS5 代理，格式如：http://127.0.0.1:7890 或 socks5://127.0.0.1:1080
                        </p>
                      </div>

                      {/* Proxy Actions */}
                      <div className="pt-3 border-t border-gray-200">
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={() => setSettings({ ...settings, proxyHost: '' })}
                            className="text-xs px-3 py-1 bg-gray-50 text-gray-600 rounded border border-gray-200 hover:bg-gray-100 transition-colors"
                          >
                            清空配置
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

   
                {/* Save Button */}
                <div className="border-t border-gray-200 pt-4">
                  <button
                    onClick={handleSaveSettings}
                    disabled={saveStatus === 'saving'}
                    className={`px-6 py-2 rounded-md font-medium transition-colors ${
                      saveStatus === 'saved'
                        ? 'bg-green-500 text-white'
                        : saveStatus === 'saving'
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '已保存 ✓' : '保存设置'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'account' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Bilibili 账号</h3>

                  {!isLoggedIn ? (
                    <div className="text-center py-8">
                      {!showLogin ? (
                        <div className="space-y-4">
                          <div className="w-20 h-5 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                            <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                          </div>
                          <p className="text-gray-600">尚未登录 Bilibili 账号</p>
                          <button
                            onClick={() => setShowLogin(true)}
                            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                          >
                            扫码登录
                          </button>
                        </div>
                      ) : (
                        <QRLogin 
                          onLoginSuccess={handleLoginSuccess}
                          onRefreshStatus={handleRefreshStatus}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        {userInfo?.face && (
                          <img src={userInfo.face} alt="头像" className="w-12 h-12 rounded-full" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{userInfo?.uname}</p>
                          <p className="text-sm text-gray-500">UID: {userInfo?.mid}</p>
                        </div>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        退出登录
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">关于扩展</h3>
                  <div className="space-y-3 text-sm text-gray-600">
                    <p>
                      <strong>Bili UP Extension</strong> 是一个现代化的浏览器扩展，用于保存 YouTube 和 Bilibili 视频
                      URL 及字幕。
                    </p>
                    <p>
                      <strong>版本:</strong> 1.0.0
                    </p>
                    <p>
                      <strong>技术栈:</strong> WXT + React + TypeScript + Tailwind CSS
                    </p>
                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <p className="font-medium text-gray-900 mb-2">功能特性:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>一键保存视频 URL 和字幕</li>
                        <li>支持 YouTube 和 Bilibili 双平台</li>
                        <li>快捷键支持 (Ctrl/Cmd + Shift + S/T)</li>
                        <li>AI 字幕翻译 (DeepSeek)</li>
                        <li>本地存储和后端同步</li>
                      </ul>
                    </div>
                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <p className="font-medium text-gray-900 mb-2">相关链接:</p>
                      <ul className="space-y-0.5">
                        <li>
                          <a
                            href="https://github.com/wxt-dev/wxt"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                          >
                            WXT 文档
                          </a>
                        </li>
                        <li>
                          <a
                            href="https://platform.deepseek.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                          >
                            DeepSeek Platform
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
