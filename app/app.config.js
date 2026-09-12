/**
 * Debug / Release 使用不同包名与显示名，可同时安装在同一台设备上。
 * 本地与 EAS development 默认走 debug；EAS production / preview 为正式版。
 */
const DEBUG_PACKAGE = 'com.codewdy.tvsurf.debug';
const RELEASE_PACKAGE = 'com.codewdy.tvsurf';

function isDebugVariant() {
    if (process.env.APP_VARIANT === 'development') return true;
    if (process.env.APP_VARIANT === 'production') return false;
    if (process.env.EAS_BUILD_PROFILE === 'development') return true;
    if (process.env.EAS_BUILD_PROFILE === 'production') return false;
    if (process.env.EAS_BUILD_PROFILE === 'preview') return false;
    // 本地未指定时走 debug，避免覆盖手机上的正式版
    return process.env.EAS_BUILD !== 'true';
}

module.exports = ({ config }) => {
    const isDebug = isDebugVariant();
    const packageName = isDebug ? DEBUG_PACKAGE : RELEASE_PACKAGE;

    const plugins = (config.plugins || []).map((plugin) => {
        if (plugin === 'expo-dev-client') {
            return ['expo-dev-client', { addGeneratedScheme: isDebug }];
        }
        return plugin;
    });

    return {
        ...config,
        name: isDebug ? `${config.name} Debug` : config.name,
        plugins,
        ios: {
            ...config.ios,
            bundleIdentifier: packageName,
        },
        android: {
            ...config.android,
            package: packageName,
        },
    };
};
