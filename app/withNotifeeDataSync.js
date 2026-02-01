/**
 * Expo config plugin: 为 Notifee 前台服务添加 dataSync 类型
 * Notifee 默认使用 shortService (0x800)，我们需用 dataSync (0x1) 以支持长时间下载
 * 通过 tools:replace 覆盖 manifest 中的 foregroundServiceType
 */
const { withAndroidManifest } = require('@expo/config-plugins');

function withNotifeeDataSync(config) {
  return withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;

    // 添加 tools 命名空间（用于 tools:replace）
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    // 添加权限
    const permissions = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
    ];
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }
    const existingPermissions = manifest['uses-permission'];
    for (const permission of permissions) {
      const alreadyExists = existingPermissions.some(
        (item) => item.$?.['android:name'] === permission
      );
      if (!alreadyExists) {
        existingPermissions.push({ $: { 'android:name': permission } });
      }
    }

    // 添加 service 声明，覆盖 Notifee 的 foregroundServiceType (shortService -> dataSync)
    const application = manifest.application?.[0];
    if (application) {
      if (!application.service) {
        application.service = [];
      }
      // 查找是否已有 Notifee 服务的覆盖声明
      const notifeeService = application.service.find(
        (s) => s.$?.['android:name'] === 'app.notifee.core.ForegroundService'
      );
      if (notifeeService) {
        notifeeService.$['android:foregroundServiceType'] = 'dataSync';
        notifeeService.$['tools:replace'] = 'android:foregroundServiceType';
      } else {
        application.service.push({
          $: {
            'android:name': 'app.notifee.core.ForegroundService',
            'android:foregroundServiceType': 'dataSync',
            'android:exported': 'false',
            'tools:replace': 'android:foregroundServiceType',
          },
        });
      }
    }

    return config;
  });
}

module.exports = withNotifeeDataSync;
