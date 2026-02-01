import { registerRootComponent } from 'expo';
import Constants from 'expo-constants';

import App from './App';

// 仅在非 Expo Go 环境下注册 Notifee 前台服务（Expo Go 无原生 Notifee，不加载避免报错）
if (Constants.executionEnvironment !== 'storeClient') {
  try {
    const notifee = require('@notifee/react-native').default;
    notifee.registerForegroundService(() => {
      return new Promise(() => {
        // Promise 永不 resolve，由 stopForegroundService 停止服务
      });
    });
  } catch {
    // 原生模块未链接或不可用时静默忽略
  }
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
