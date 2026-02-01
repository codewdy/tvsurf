import { registerRootComponent } from 'expo';
import notifee from '@notifee/react-native';

import App from './App';

// 注册前台服务，用于维持视频下载不中断（必须在 React 组件之外尽早注册）
notifee.registerForegroundService(() => {
  return new Promise(() => {
    // Promise 永不 resolve，由 stopForegroundService 停止服务
  });
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
