/**
 * Notifee 前台服务封装，用于视频下载时显示持久通知，维持下载不中断
 * 在 Expo Go 环境下不加载 Notifee，所有接口为 no-op，避免报错
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DOWNLOAD_CHANNEL_ID = 'video-download';
const DOWNLOAD_NOTIFICATION_ID = 'video-download-fgs';

// Expo Go 下不加载 notifee，避免原生模块不可用报错（executionEnvironment === 'storeClient' 表示 Expo Go）
let notifeeModule: typeof import('@notifee/react-native') | null = null;
if (Constants.executionEnvironment !== 'storeClient') {
  try {
    notifeeModule = require('@notifee/react-native');
  } catch {
    notifeeModule = null;
  }
}

export async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android' || !notifeeModule) return;
  const { AndroidImportance } = notifeeModule;
  await notifeeModule.default.createChannel({
    id: DOWNLOAD_CHANNEL_ID,
    name: '视频下载',
    importance: AndroidImportance.LOW,
  });
}

export async function startDownloadNotification(totalTasks: number): Promise<void> {
  if (Platform.OS !== 'android' || !notifeeModule) return;
  const notifee = notifeeModule.default;
  const { AndroidForegroundServiceType } = notifeeModule;
  await ensureChannel();
  await notifee.displayNotification({
    id: DOWNLOAD_NOTIFICATION_ID,
    title: '追番小助手',
    body: `正在下载 ${totalTasks} 个视频`,
    android: {
      channelId: DOWNLOAD_CHANNEL_ID,
      asForegroundService: true,
      foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_DATA_SYNC],
      pressAction: { id: 'default' }, // 点击通知打开应用
    },
  });
}

export async function updateDownloadNotification(
  totalTasks: number
): Promise<void> {
  if (Platform.OS !== 'android' || !notifeeModule) return;
  const notifee = notifeeModule.default;
  const { AndroidForegroundServiceType } = notifeeModule;
  await ensureChannel();
  await notifee.displayNotification({
    id: DOWNLOAD_NOTIFICATION_ID,
    title: '追番小助手',
    body: `正在下载 ${totalTasks} 个视频`,
    android: {
      channelId: DOWNLOAD_CHANNEL_ID,
      asForegroundService: true,
      foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_DATA_SYNC],
      pressAction: { id: 'default' }, // 点击通知打开应用
    },
  });
}

export async function stopDownloadNotification(): Promise<void> {
  if (Platform.OS !== 'android' || !notifeeModule) return;
  await notifeeModule.default.stopForegroundService();
}
