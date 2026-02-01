/**
 * Notifee 前台服务封装，用于视频下载时显示持久通知，维持下载不中断
 */
import notifee, { AndroidImportance, AndroidForegroundServiceType } from '@notifee/react-native';
import { Platform } from 'react-native';

const DOWNLOAD_CHANNEL_ID = 'video-download';
const DOWNLOAD_NOTIFICATION_ID = 'video-download-fgs';

export async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: DOWNLOAD_CHANNEL_ID,
    name: '视频下载',
    importance: AndroidImportance.LOW,
  });
}

export async function startDownloadNotification(totalTasks: number): Promise<void> {
  if (Platform.OS !== 'android') return;
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
  if (Platform.OS !== 'android') return;
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
  if (Platform.OS !== 'android') return;
  await notifee.stopForegroundService();
}
