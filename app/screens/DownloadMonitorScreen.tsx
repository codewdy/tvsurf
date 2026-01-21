import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getDownloadProgress } from '../api/client-proxy';
import type { DownloadProgressWithName, DownloadProgress } from '../api/types';

interface DownloadMonitorScreenProps {
    onBack: () => void;
}

// 格式化字节数
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let size = Math.abs(bytes);

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    if (size >= 100) {
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    } else if (size >= 10) {
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    } else {
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
}

// 格式化速度
function formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond === 0) return '0 B/s';
    return `${formatBytes(bytesPerSecond)}/s`;
}

// 格式化时间
function formatTime(seconds: number): string {
    if (seconds < 0 || !isFinite(seconds)) return '未知';

    if (seconds < 60) {
        return `${Math.floor(seconds)}秒`;
    }

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    if (minutes < 60) {
        return `${minutes}分${secs}秒`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}小时${mins}分${secs}秒`;
}

export default function DownloadMonitorScreen({ onBack }: DownloadMonitorScreenProps) {
    const [progressList, setProgressList] = useState<DownloadProgressWithName[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchProgress = async () => {
        try {
            const data = await getDownloadProgress({});
            setProgressList(data.progress || []);
            setError(null);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '获取进度时发生错误';
            setError(errorMessage);
            console.error('Fetch progress error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // 初始加载和自动刷新
    useEffect(() => {
        fetchProgress();

        const interval = setInterval(fetchProgress, 1000); // 每1秒刷新一次

        // 监听安卓返回按钮
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            onBack();
            return true;
        });

        return () => {
            clearInterval(interval);
            backHandler.remove();
        };
    }, [onBack]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchProgress();
    };

    const getProgressPercentage = (progress: DownloadProgress): number => {
        if (!progress.downloading || progress.total_size <= 0) return 0;
        return Math.min((progress.downloaded_size / progress.total_size) * 100, 100);
    };

    const getRemainingTime = (progress: DownloadProgress): string => {
        if (!progress.downloading || progress.speed <= 0 || progress.total_size <= 0) {
            return '未知';
        }
        const remainingBytes = progress.total_size - progress.downloaded_size;
        if (remainingBytes <= 0) return '完成';
        const remainingSeconds = remainingBytes / progress.speed;
        return formatTime(remainingSeconds);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* 头部 */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#007AFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>下载监控</Text>
                <View style={styles.placeholder} />
            </View>

            {/* 错误信息 */}
            {error && (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={20} color="#EF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {/* 内容 */}
            {loading && progressList.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>加载中...</Text>
                </View>
            ) : progressList.length === 0 ? (
                <ScrollView
                    contentContainerStyle={styles.emptyContainer}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >
                    <Ionicons name="download-outline" size={64} color="#9CA3AF" />
                    <Text style={styles.emptyText}>当前没有下载任务</Text>
                </ScrollView>
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >
                    {progressList.map((item, index) => {
                        const progress = item.progress;
                        const percentage = getProgressPercentage(progress);
                        const remainingTime = getRemainingTime(progress);

                        return (
                            <View key={index} style={styles.progressCard}>
                                {/* 任务名称和状态 */}
                                <View style={styles.cardHeader}>
                                    <View style={styles.titleContainer}>
                                        <Text style={styles.taskName} numberOfLines={2}>
                                            {item.name || '未知任务'}
                                        </Text>
                                        <Text style={styles.statusText}>
                                            状态: <Text style={styles.statusValue}>{progress.status || '未知'}</Text>
                                        </Text>
                                    </View>
                                </View>

                                {/* 进度条 */}
                                {progress.downloading && progress.total_size > 0 && (
                                    <View style={styles.progressContainer}>
                                        <View style={styles.progressInfo}>
                                            <Text style={styles.progressText}>
                                                {formatBytes(progress.downloaded_size)} / {formatBytes(progress.total_size)}
                                            </Text>
                                            <Text style={styles.percentageText}>
                                                {percentage.toFixed(1)}%
                                            </Text>
                                        </View>
                                        <View style={styles.progressBarContainer}>
                                            <View
                                                style={[
                                                    styles.progressBar,
                                                    { width: `${percentage}%` },
                                                ]}
                                            />
                                        </View>
                                    </View>
                                )}

                                {/* 详细信息 */}
                                <View style={styles.detailsContainer}>
                                    <View style={styles.detailItem}>
                                        <Text style={styles.detailLabel}>已下载:</Text>
                                        <Text style={styles.detailValue}>
                                            {formatBytes(progress.downloaded_size)}
                                        </Text>
                                    </View>
                                    {progress.total_size > 0 && (
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>总大小:</Text>
                                            <Text style={styles.detailValue}>
                                                {formatBytes(progress.total_size)}
                                            </Text>
                                        </View>
                                    )}
                                    {progress.downloading && (
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>下载速度:</Text>
                                            <Text style={styles.detailValue}>
                                                {formatSpeed(progress.speed)}
                                            </Text>
                                        </View>
                                    )}
                                    {progress.downloading && progress.total_size > 0 && (
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>剩余时间:</Text>
                                            <Text style={styles.detailValue}>
                                                {remainingTime}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    })}
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
    },
    placeholder: {
        width: 40,
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
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: '#9CA3AF',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    progressCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        marginBottom: 12,
    },
    titleContainer: {
        flex: 1,
    },
    taskName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000000',
        marginBottom: 4,
    },
    statusText: {
        fontSize: 14,
        color: '#666666',
    },
    statusValue: {
        color: '#007AFF',
        fontWeight: '500',
    },
    progressContainer: {
        marginBottom: 12,
    },
    progressInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    progressText: {
        fontSize: 14,
        color: '#666666',
    },
    percentageText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#000000',
    },
    progressBarContainer: {
        width: '100%',
        height: 8,
        backgroundColor: '#E5E5E5',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#007AFF',
        borderRadius: 4,
    },
    detailsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    detailItem: {
        flex: 1,
        minWidth: '45%',
    },
    detailLabel: {
        fontSize: 12,
        color: '#9CA3AF',
        marginBottom: 4,
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#000000',
    },
});
