import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    BackHandler,
    Alert,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getConfig, setConfig, whoami } from '../api/client-proxy';
import { offlineModeManager } from '../utils/offlineModeManager';
import type { Config, WhoamiResponse } from '../api/types';

interface ConfigScreenProps {
    onBack: () => void;
}

// 将ISO 8601格式的TimeDelta转换为可读格式
// 例如: "PT1M" -> "1m", "PT1H" -> "1h", "P1D" -> "1d", "P14D" -> "14d", "PT1H30M" -> "1h30m"
function parseTimeDelta(isoString: string): string {
    // 如果已经是简单格式（如"1m", "1h", "1d"），直接返回
    if (!isoString.startsWith("P")) {
        return isoString;
    }

    // ISO 8601 持续时间格式: P[n]D T[n]H[n]M[n]S
    // 完整匹配: P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?
    const fullMatch = isoString.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);

    if (!fullMatch) {
        return isoString; // 如果无法解析，返回原值
    }

    const days = fullMatch[1] ? parseInt(fullMatch[1]) : 0;
    const hours = fullMatch[2] ? parseInt(fullMatch[2]) : 0;
    const minutes = fullMatch[3] ? parseInt(fullMatch[3]) : 0;
    const seconds = fullMatch[4] ? parseInt(fullMatch[4]) : 0;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);

    return parts.length > 0 ? parts.join("") : "0s";
}

// 将字节数转换为可读格式
// 例如: 1048576 -> "1MB", 512000 -> "500KB"
function parseByteSize(bytes: number | string): string {
    if (typeof bytes === "string") {
        // 如果已经是字符串格式（如"1MB", "512KB"），直接返回
        if (/^\d+(\.\d+)?[KMGT]?B$/i.test(bytes.trim())) {
            return bytes.trim();
        }
        // 尝试解析为数字
        const num = parseInt(bytes);
        if (isNaN(num)) return bytes;
        bytes = num;
    }

    const units = ["B", "KB", "MB", "GB", "TB", "PB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    // 如果是整数，不显示小数
    if (size === Math.floor(size)) {
        return `${Math.floor(size)}${units[unitIndex]}`;
    }
    // 保留最多2位小数，但去掉末尾的0
    return `${parseFloat(size.toFixed(2))}${units[unitIndex]}`;
}

// 转换配置对象，将TimeDelta和ByteSize转换为可读格式
function normalizeConfig(config: Config): Config {
    const normalized = JSON.parse(JSON.stringify(config)); // 深拷贝

    // 转换TimeDelta字段
    normalized.updater.update_interval = parseTimeDelta(normalized.updater.update_interval);
    normalized.updater.tracking_timeout = parseTimeDelta(normalized.updater.tracking_timeout);
    normalized.download.connect_timeout = parseTimeDelta(normalized.download.connect_timeout);
    normalized.download.download_timeout = parseTimeDelta(normalized.download.download_timeout);
    normalized.download.retry_interval = parseTimeDelta(normalized.download.retry_interval);
    normalized.db.save_interval = parseTimeDelta(normalized.db.save_interval);

    // 转换ByteSize字段
    normalized.download.chunk_size = parseByteSize(normalized.download.chunk_size);

    return normalized;
}

export default function ConfigScreen({ onBack }: ConfigScreenProps) {
    const [config, setConfigState] = useState<Config | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isOffline, setIsOffline] = useState(false);
    const [dnsInput, setDnsInput] = useState<string>('');
    const [userInfo, setUserInfo] = useState<WhoamiResponse | null>(null);
    const [checkingPermission, setCheckingPermission] = useState(true);

    useEffect(() => {
        checkPermission();
        loadOfflineStatus();

        // 监听安卓返回按钮
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            onBack();
            return true;
        });

        return () => {
            backHandler.remove();
        };
    }, [onBack]);

    const checkPermission = async () => {
        try {
            setCheckingPermission(true);
            const info = await whoami({});
            setUserInfo(info);
            const isAdmin = info?.user?.group?.includes('admin') ?? false;
            if (!isAdmin) {
                Alert.alert('权限不足', '只有管理员可以访问系统配置页面', [
                    { text: '确定', onPress: onBack }
                ]);
                return;
            }
            // 权限检查通过后加载配置
            await loadConfig();
        } catch (err) {
            console.error('检查权限失败:', err);
            Alert.alert('错误', '无法验证权限，请重试', [
                { text: '确定', onPress: onBack }
            ]);
        } finally {
            setCheckingPermission(false);
        }
    };

    const loadOfflineStatus = async () => {
        try {
            const offline = await offlineModeManager.getOfflineMode();
            setIsOffline(offline);
        } catch (error) {
            console.error('加载离线模式状态失败:', error);
        }
    };

    const loadConfig = async () => {
        try {
            setLoading(true);
            setError(null);
            setSuccess(null);

            const data = await getConfig({});
            // 确保 network 字段存在
            if (!data.config.network) {
                data.config.network = { nameservers: [] };
            }
            // 转换TimeDelta和ByteSize为可读格式
            const normalizedConfig = normalizeConfig(data.config);
            setConfigState(normalizedConfig);
        } catch (err) {
            console.error('获取配置失败:', err);
            const errorMessage = err instanceof Error ? err.message : '获取配置失败';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!config) return;

        if (isOffline) {
            Alert.alert('提示', '离线模式下无法保存配置，请先退出离线模式');
            return;
        }

        Alert.alert(
            '确认保存',
            '确定要保存配置吗？',
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '保存',
                    onPress: async () => {
                        try {
                            setSaving(true);
                            setError(null);
                            setSuccess(null);

                            await setConfig({ config });
                            setSuccess('配置保存成功！');
                            // 3秒后清除成功消息
                            setTimeout(() => setSuccess(null), 3000);
                        } catch (err) {
                            console.error('保存配置失败:', err);
                            const errorMessage = err instanceof Error ? err.message : '保存配置失败';
                            setError(errorMessage);
                        } finally {
                            setSaving(false);
                        }
                    },
                },
            ]
        );
    };

    const handleReset = () => {
        Alert.alert(
            '确认重置',
            '确定要重置为原始配置吗？未保存的更改将丢失。',
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '重置',
                    onPress: () => {
                        loadConfig();
                    },
                },
            ]
        );
    };

    const updateConfig = (path: string[], value: string | number) => {
        if (!config || isOffline) return;

        const newConfig = JSON.parse(JSON.stringify(config)); // 深拷贝
        let current: any = newConfig;

        // 导航到目标对象
        for (let i = 0; i < path.length - 1; i++) {
            current = current[path[i]];
        }

        // 设置值
        const lastKey = path[path.length - 1];
        if (typeof value === 'number') {
            current[lastKey] = value;
        } else {
            current[lastKey] = value;
        }

        setConfigState(newConfig);
    };

    const removeNameserver = (index: number) => {
        if (!config || isOffline) return;
        const newConfig = JSON.parse(JSON.stringify(config));
        if (!newConfig.network || !Array.isArray(newConfig.network.nameservers)) {
            return;
        }
        newConfig.network.nameservers.splice(index, 1);
        setConfigState(newConfig);
    };

    const addNameserverFromInput = () => {
        if (!config || isOffline) return;
        const value = dnsInput.trim();
        if (!value) return;

        const newConfig = JSON.parse(JSON.stringify(config));
        if (!newConfig.network) {
            newConfig.network = { nameservers: [] };
        }

        // 去重：如果已存在则不重复添加
        if (!newConfig.network.nameservers.includes(value)) {
            newConfig.network.nameservers.push(value);
            setConfigState(newConfig);
        }

        setDnsInput('');
    };

    if (checkingPermission || loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#007AFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>系统配置</Text>
                    <View style={styles.headerRight} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>
                        {checkingPermission ? '检查权限中...' : '加载中...'}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // 如果权限检查失败，不显示内容（已经通过Alert提示并返回）
    const isAdmin = userInfo?.user?.group?.includes('admin') ?? false;
    if (!isAdmin) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#007AFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>系统配置</Text>
                    <View style={styles.headerRight} />
                </View>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>权限不足</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error && !config) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#007AFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>系统配置</Text>
                    <View style={styles.headerRight} />
                </View>
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={20} color="#EF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity onPress={loadConfig} style={styles.retryButton}>
                        <Text style={styles.retryButtonText}>重试</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* 头部 */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#007AFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>系统配置</Text>
                <View style={styles.headerRight}>
                    <TouchableOpacity
                        onPress={handleReset}
                        disabled={saving || loading || isOffline}
                        style={[styles.headerButton, (saving || loading || isOffline) && styles.headerButtonDisabled]}
                    >
                        <Text style={[styles.headerButtonText, (saving || loading || isOffline) && styles.headerButtonTextDisabled]}>
                            重置
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving || loading || !config || isOffline}
                        style={[styles.headerButton, (saving || loading || !config || isOffline) && styles.headerButtonDisabled]}
                    >
                        <Text style={[styles.headerButtonText, (saving || loading || !config || isOffline) && styles.headerButtonTextDisabled]}>
                            {saving ? '保存中...' : '保存'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* 错误信息 */}
            {error && (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={20} color="#EF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {/* 成功信息 */}
            {success && (
                <View style={styles.successContainer}>
                    <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                    <Text style={styles.successText}>{success}</Text>
                </View>
            )}

            {/* 离线模式提示 */}
            {isOffline && (
                <View style={styles.offlineContainer}>
                    <Ionicons name="airplane" size={20} color="#FF9500" />
                    <Text style={styles.offlineText}>离线模式下无法编辑和保存配置</Text>
                </View>
            )}

            {/* 内容 */}
            {config && (
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                    {/* 更新器配置 */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>更新器配置 (Updater)</Text>
                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>更新间隔 (TimeDelta格式)</Text>
                            <TextInput
                                style={[styles.input, isOffline && styles.inputDisabled]}
                                value={config.updater.update_interval}
                                onChangeText={(text) => updateConfig(['updater', 'update_interval'], text)}
                                placeholder="1d"
                                editable={!isOffline}
                            />
                            <Text style={styles.fieldHint}>例如: 1d, 1h30m, PT1H</Text>
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>追踪超时 (TimeDelta格式)</Text>
                            <TextInput
                                style={[styles.input, isOffline && styles.inputDisabled]}
                                value={config.updater.tracking_timeout}
                                onChangeText={(text) => updateConfig(['updater', 'tracking_timeout'], text)}
                                placeholder="14d"
                                editable={!isOffline}
                            />
                            <Text style={styles.fieldHint}>例如: 14d, 2w</Text>
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>并行更新数</Text>
                            <TextInput
                                style={[styles.input, isOffline && styles.inputDisabled]}
                                value={config.updater.update_parallel.toString()}
                                onChangeText={(text) => {
                                    const num = parseInt(text) || 0;
                                    updateConfig(['updater', 'update_parallel'], num);
                                }}
                                keyboardType="numeric"
                                editable={!isOffline}
                            />
                        </View>
                    </View>

                    {/* 下载配置 */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>下载配置 (Download)</Text>
                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>连接超时 (TimeDelta格式)</Text>
                            <TextInput
                                style={[styles.input, isOffline && styles.inputDisabled]}
                                value={config.download.connect_timeout}
                                onChangeText={(text) => updateConfig(['download', 'connect_timeout'], text)}
                                placeholder="1m"
                                editable={!isOffline}
                            />
                            <Text style={styles.fieldHint}>例如: 1m, 30s</Text>
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>块大小 (ByteSize格式)</Text>
                            <TextInput
                                style={[styles.input, isOffline && styles.inputDisabled]}
                                value={config.download.chunk_size}
                                onChangeText={(text) => updateConfig(['download', 'chunk_size'], text)}
                                placeholder="1MB"
                                editable={!isOffline}
                            />
                            <Text style={styles.fieldHint}>例如: 1MB, 512KB</Text>
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>最大并发片段数</Text>
                            <TextInput
                                style={[styles.input, isOffline && styles.inputDisabled]}
                                value={config.download.max_concurrent_fragments.toString()}
                                onChangeText={(text) => {
                                    const num = parseInt(text) || 0;
                                    updateConfig(['download', 'max_concurrent_fragments'], num);
                                }}
                                keyboardType="numeric"
                                editable={!isOffline}
                            />
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>最大并发下载数</Text>
                            <TextInput
                                style={[styles.input, isOffline && styles.inputDisabled]}
                                value={config.download.max_concurrent_downloads.toString()}
                                onChangeText={(text) => {
                                    const num = parseInt(text) || 0;
                                    updateConfig(['download', 'max_concurrent_downloads'], num);
                                }}
                                keyboardType="numeric"
                                editable={!isOffline}
                            />
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>最大重试次数</Text>
                            <TextInput
                                style={[styles.input, isOffline && styles.inputDisabled]}
                                value={config.download.max_retries.toString()}
                                onChangeText={(text) => {
                                    const num = parseInt(text) || 0;
                                    updateConfig(['download', 'max_retries'], num);
                                }}
                                keyboardType="numeric"
                                editable={!isOffline}
                            />
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>下载超时 (TimeDelta格式)</Text>
                            <TextInput
                                style={[styles.input, isOffline && styles.inputDisabled]}
                                value={config.download.download_timeout}
                                onChangeText={(text) => updateConfig(['download', 'download_timeout'], text)}
                                placeholder="1h"
                                editable={!isOffline}
                            />
                            <Text style={styles.fieldHint}>例如: 1h, 30m</Text>
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>重试间隔 (TimeDelta格式)</Text>
                            <TextInput
                                style={[styles.input, isOffline && styles.inputDisabled]}
                                value={config.download.retry_interval}
                                onChangeText={(text) => updateConfig(['download', 'retry_interval'], text)}
                                placeholder="1m"
                                editable={!isOffline}
                            />
                            <Text style={styles.fieldHint}>例如: 1m, 30s</Text>
                        </View>
                    </View>

                    {/* 数据库配置 */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>数据库配置 (DB)</Text>
                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>保存间隔 (TimeDelta格式)</Text>
                            <TextInput
                                style={[styles.input, isOffline && styles.inputDisabled]}
                                value={config.db.save_interval}
                                onChangeText={(text) => updateConfig(['db', 'save_interval'], text)}
                                placeholder="10s"
                                editable={!isOffline}
                            />
                            <Text style={styles.fieldHint}>例如: 10s, 1m</Text>
                        </View>
                    </View>

                    {/* 网络配置 */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>网络配置 (Network)</Text>
                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>DNS 服务器</Text>
                            {(config.network?.nameservers ?? []).length === 0 ? (
                                <Text style={styles.emptyHint}>暂未配置 DNS，可在下方输入后添加。</Text>
                            ) : (
                                <View style={styles.dnsList}>
                                    {(config.network?.nameservers ?? []).map((ns, index) => (
                                        <View key={index} style={styles.dnsItem}>
                                            <Text style={styles.dnsItemText}>{ns}</Text>
                                            {!isOffline && (
                                                <TouchableOpacity
                                                    onPress={() => removeNameserver(index)}
                                                    style={styles.dnsRemoveButton}
                                                >
                                                    <Ionicons name="close-circle" size={20} color="#FF3B30" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            )}
                            <View style={styles.dnsInputContainer}>
                                <TextInput
                                    style={[styles.dnsInput, isOffline && styles.inputDisabled]}
                                    value={dnsInput}
                                    onChangeText={setDnsInput}
                                    placeholder="输入 DNS 地址，例如: 8.8.8.8"
                                    editable={!isOffline}
                                    onSubmitEditing={addNameserverFromInput}
                                />
                                <TouchableOpacity
                                    onPress={addNameserverFromInput}
                                    disabled={isOffline || !dnsInput.trim()}
                                    style={[styles.dnsAddButton, (isOffline || !dnsInput.trim()) && styles.dnsAddButtonDisabled]}
                                >
                                    <Text style={[styles.dnsAddButtonText, (isOffline || !dnsInput.trim()) && styles.dnsAddButtonTextDisabled]}>
                                        添加
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5E5',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000000',
        flex: 1,
        textAlign: 'center',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#007AFF',
    },
    headerButtonDisabled: {
        backgroundColor: '#CCCCCC',
    },
    headerButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
    },
    headerButtonTextDisabled: {
        color: '#999999',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        borderColor: '#FCA5A5',
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        margin: 16,
        gap: 8,
    },
    errorText: {
        flex: 1,
        color: '#DC2626',
        fontSize: 14,
    },
    retryButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#DC2626',
        borderRadius: 6,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
    },
    successContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D1FAE5',
        borderColor: '#86EFAC',
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        margin: 16,
        gap: 8,
    },
    successText: {
        flex: 1,
        color: '#059669',
        fontSize: 14,
    },
    offlineContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF3CD',
        borderColor: '#FFE69C',
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        margin: 16,
        gap: 8,
    },
    offlineText: {
        flex: 1,
        color: '#FF9500',
        fontSize: 14,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000000',
        marginBottom: 16,
    },
    field: {
        marginBottom: 16,
    },
    fieldLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333333',
        marginBottom: 8,
    },
    fieldHint: {
        fontSize: 12,
        color: '#999999',
        marginTop: 4,
    },
    input: {
        borderWidth: 1,
        borderColor: '#E5E5E5',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: '#000000',
        backgroundColor: '#FFFFFF',
    },
    inputDisabled: {
        backgroundColor: '#F5F5F5',
        color: '#999999',
    },
    emptyHint: {
        fontSize: 12,
        color: '#999999',
        fontStyle: 'italic',
        marginBottom: 8,
    },
    dnsList: {
        marginBottom: 8,
    },
    dnsItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F0F0F0',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
    },
    dnsItemText: {
        flex: 1,
        fontSize: 14,
        color: '#000000',
    },
    dnsRemoveButton: {
        padding: 4,
    },
    dnsInputContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    dnsInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#E5E5E5',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: '#000000',
        backgroundColor: '#FFFFFF',
    },
    dnsAddButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        justifyContent: 'center',
    },
    dnsAddButtonDisabled: {
        backgroundColor: '#CCCCCC',
    },
    dnsAddButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
    },
    dnsAddButtonTextDisabled: {
        color: '#999999',
    },
});
