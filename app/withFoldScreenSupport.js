/**
 * 小米折叠屏 / 大屏：声明已适配横屏与尺寸变化，避免内屏全屏时进入平行窗口或信箱模式。
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const META = [
    { name: 'LandscapeForPad', value: 'true' },
    { name: 'android.supports_size_changes', value: 'true' },
    { name: 'miui.supportAppContinuity', value: 'true' },
];

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
        }
        return config;
    });
}

module.exports = withFoldScreenSupport;
