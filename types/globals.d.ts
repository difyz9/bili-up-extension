// 全局类型定义
/// <reference types="@types/webextension-polyfill" />

// 确保 browser API 在全局可用
declare const browser: typeof import('webextension-polyfill');



// WXT 框架自动注入的全局函数
declare function defineBackground(main: () => void): any;
declare function defineContentScript(config: any): any;
declare function defineUnlistedScript(main: () => void): any;
