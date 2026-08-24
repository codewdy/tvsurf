/**
 * Expo config plugin: 增大 Gradle JVM Metaspace，避免本地/EAS Android 构建 OOM。
 */
const { withGradleProperties } = require('@expo/config-plugins');

const GRADLE_JVM_ARGS =
    '-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8';

function upsertGradleProperty(items, key, value) {
    const index = items.findIndex((item) => item.type === 'property' && item.key === key);
    const entry = { type: 'property', key, value };
    if (index >= 0) {
        items[index] = entry;
    } else {
        items.push(entry);
    }
}

function withGradleJvmArgs(config) {
    return withGradleProperties(config, (config) => {
        upsertGradleProperty(config.modResults, 'org.gradle.jvmargs', GRADLE_JVM_ARGS);
        upsertGradleProperty(config.modResults, 'org.gradle.parallel', 'true');
        return config;
    });
}

module.exports = withGradleJvmArgs;
