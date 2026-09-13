/**
 * 折叠屏 / 大屏适配的原生声明：
 * 1. 告诉系统（尤其 MIUI）本应用已适配横屏与尺寸变化，避免内屏被塞进平行窗口或信箱模式；
 * 2. 补齐 configChanges，让折叠与展开走 onConfigurationChanged 而不是重建 Activity。
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const META = [
    { name: 'LandscapeForPad', value: 'true' },
    { name: 'android.supports_size_changes', value: 'true' },
    { name: 'miui.supportAppContinuity', value: 'true' },
];

// Expo 默认不含 smallestScreenSize / density，而这两位正是折叠与展开时会变的。
// 只要有一位没声明，Android 就会重建 Activity 而不是回调 onConfigurationChanged，
// 结果是导航状态被清空、RN 也收不到新的窗口尺寸。
const REQUIRED_CONFIG_CHANGES = [
    'keyboard',
    'keyboardHidden',
    'orientation',
    'screenSize',
    'smallestScreenSize',
    'screenLayout',
    'density',
    'uiMode',
];

function mergeConfigChanges(activity) {
    const declared = (activity.$['android:configChanges'] || '').split('|').filter(Boolean);
    for (const flag of REQUIRED_CONFIG_CHANGES) {
        if (!declared.includes(flag)) {
            declared.push(flag);
        }
    }
    activity.$['android:configChanges'] = declared.join('|');
}

function upsertMeta(application, name, value) {
    if (!application['meta-data']) {
        application['meta-data'] = [];
    }
    const existing = application['meta-data'].find((item) => item.$?.['android:name'] === name);
    if (existing) {
        existing.$['android:value'] = value;
        return;
    }
    application['meta-data'].push({
        $: { 'android:name': name, 'android:value': value },
    });
}

function withFoldScreenSupport(config) {
    return withAndroidManifest(config, (config) => {
        const application = config.modResults.manifest.application?.[0];
        if (application) {
            application.$['android:resizeableActivity'] = 'true';
            for (const { name, value } of META) {
                upsertMeta(application, name, value);
            }
            const mainActivity = application.activity?.find(
                (item) => item.$?.['android:name'] === '.MainActivity',
            );
            if (mainActivity) {
                mergeConfigChanges(mainActivity);
            }
        }
        return config;
    });
}

module.exports = withFoldScreenSupport;
