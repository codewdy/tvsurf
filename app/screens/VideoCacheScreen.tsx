import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { videoCache, CachedVideo, DownloadTask, DownloadStatus } from '../utils/videoCache';
import { getTVInfos, getTVDetails } from '../api/client-proxy';
import { offlineModeManager } from '../utils/offlineModeManager';
import type { TVInfo, GetTVDetailsResponse } from '../api/types';

interface VideoCacheScreenProps {
    onBack: () => void;
}

export default function VideoCacheScreen({ onBack }: VideoCacheScreenProps) {
    const [loading, setLoading] = useState(true);
    const [cachedVideos, setCachedVideos] = useState<CachedVideo[]>([]);
    const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
    const [totalSize, setTotalSize] = useState(0);
    const [tvInfoMap, setTvInfoMap] = useState<Map<number, TVInfo>>(new Map());
    const [tvDetailsMap, setTvDetailsMap] = useState<Map<number, GetTVDetailsResponse>>(new Map());
    const [collapsedTvs, setCollapsedTvs] = useState<Record<number, boolean>>({});
    const [loadingDetails, setLoadingDetails] = useState<Set<number>>(new Set());
    const [downloadTasksCollapsed, setDownloadTasksCollapsed] = useState(false);

    // 离线模式状态
    const [isOffline, setIsOffline] = useState(false);
    const [pendingChangesCount, setPendingChangesCount] = useState({ watchProgress: 0, tags: 0, total: 0 });

    useEffect(() => {
        loadData(true); // 初始化时加载信息
        loadOfflineStatus(); // 初始化时加载离线状态

        // 设置定时器更新下载任务状态和离线状态
        const interval = setInterval(() => {
            updateDownloadTasks();
            loadOfflineStatus();
        }, 1000);

        // 监听下载完成事件，自动刷新数据
        const unsubscribeComplete = videoCache.onAnyComplete(() => {
            // 下载完成后刷新数据，不重新加载TV信息
            loadData(false);
        });

        // 监听下载错误事件
        const unsubscribeError = videoCache.onAnyError(() => {
            // 下载失败后刷新数据，不重新加载TV信息
            loadData(false);
        });

        // 监听安卓返回按钮
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            onBack();
            return true; // 返回true表示已处理返回事件
        });

        return () => {
            clearInterval(interval);
            unsubscribeComplete();
            unsubscribeError();
            backHandler.remove();
        };
    }, [onBack]);

    // 加载离线模式状态
    const loadOfflineStatus = async () => {
        try {
            const offline = await offlineModeManager.getOfflineMode();
            setIsOffline(offline);

            const count = await offlineModeManager.getPendingChangesCount();
            setPendingChangesCount(count);
        } catch (error) {
            console.error('加载离线模式状态失败:', error);
        }
    };

    const loadData = async (loadInfo: boolean = true) => {
        try {
            // 只在初次加载时显示loading
            if (loadInfo) {
                setLoading(true);
            }

            // 加载缓存视频
            const cached = await videoCache.getAllCachedVideos();
            setCachedVideos(cached);

            // 加载下载任务
            const tasks = videoCache.getAllDownloadTasks();
            setDownloadTasks(tasks);

            // 计算总大小
            const size = await videoCache.getTotalCacheSize();
            setTotalSize(size);

            // 只在需要时加载TV信息（包括缓存视频和下载任务）
            if (loadInfo) {
                const cachedTvIds = cached.map(v => v.tvId);
                const taskTvIds = tasks.map(t => t.tvId);
                const allTvIds = Array.from(new Set([...cachedTvIds, ...taskTvIds]));

                if (allTvIds.length > 0) {
                    try {
                        const response = await getTVInfos({ ids: allTvIds });
                        const map = new Map<number, TVInfo>();
                        response.tvs.forEach(tv => map.set(tv.id, tv));
                        setTvInfoMap(map);
                    } catch (error) {
                        console.error('加载TV信息失败:', error);
                    }

                    // 加载下载任务对应的TV详情，以便显示集的名字
                    const taskTvIdsUnique = Array.from(new Set(taskTvIds));
                    if (taskTvIdsUnique.length > 0) {
                        const detailsMap = new Map<number, GetTVDetailsResponse>();
                        await Promise.all(
                            taskTvIdsUnique.map(async (tvId) => {
                                try {
                                    const details = await getTVDetails({ id: tvId });
                                    detailsMap.set(tvId, details);
                                } catch (error) {
                                    console.error(`加载TV ${tvId} 详情失败:`, error);
                                }
                            })
                        );
                        setTvDetailsMap(detailsMap);
                    }
                }
            }
        } catch (error) {
            console.error('加载缓存数据失败:', error);
            Alert.alert('错误', '加载缓存数据失败');
        } finally {
            if (loadInfo) {
                setLoading(false);
            }
        }
    };

    const updateDownloadTasks = () => {
        const tasks = videoCache.getAllDownloadTasks();
        setDownloadTasks(tasks);
    };

    // 按tvId分组缓存视频
    const groupedCachedVideos = React.useMemo(() => {
        const groups: Record<number, CachedVideo[]> = {};
        cachedVideos.forEach((cached) => {
            if (!groups[cached.tvId]) {
                groups[cached.tvId] = [];
            }
            groups[cached.tvId].push(cached);
        });
        // 每组内按集数排序
        Object.values(groups).forEach(group => {
            group.sort((a, b) => a.episodeId - b.episodeId);
        });
        return groups;
    }, [cachedVideos]);

    // 切换TV折叠状态
    const toggleTvCollapse = async (tvId: number) => {
        const currentlyCollapsed = collapsedTvs[tvId] !== false; // 当前是否折叠
        const willExpand = currentlyCollapsed; // 将要展开

        setCollapsedTvs(prev => ({
            ...prev,
            [tvId]: !willExpand, // 如果将要展开，设为false；如果将要折叠，设为true
        }));

        // 如果展开且还没有加载详情，则加载
        if (willExpand && !tvDetailsMap.has(tvId) && !loadingDetails.has(tvId)) {
            setLoadingDetails(prev => new Set(prev).add(tvId));
            try {
                const details = await getTVDetails({ id: tvId });
                setTvDetailsMap(prev => new Map(prev).set(tvId, details));
            } catch (error) {
                console.error(`加载TV ${tvId} 详情失败:`, error);
            } finally {
                setLoadingDetails(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(tvId);
                    return newSet;
                });
            }
        }
    };

    // 计算每个TV的缓存大小
    const getTvCacheSize = (tvId: number): number => {
        return groupedCachedVideos[tvId]?.reduce((sum, cached) => sum + cached.fileSize, 0) || 0;
    };

    // 获取episode名称
    const getEpisodeName = (tvId: number, episodeId: number): string => {
        const details = tvDetailsMap.get(tvId);
        if (details?.tv.source.episodes[episodeId]) {
            return details.tv.source.episodes[episodeId].name || `第${episodeId + 1}集`;
        }
        return `第${episodeId + 1}集`;
    };

    const handleDeleteCache = async (tvId: number, episodeId: number) => {
        try {
            await videoCache.deleteCache(tvId, episodeId);
            await loadData(false); // 删除缓存不需要重新加载TV信息
        } catch (error) {
            console.error('删除缓存失败:', error);
            Alert.alert('错误', '删除缓存失败');
        }
    };

    const handleClearAllCache = () => {
        Alert.alert(
            '清除所有缓存',
            `确定要清除所有缓存吗？这将删除 ${formatFileSize(totalSize)} 的数据。`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '清除',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await videoCache.clearAllCache();
                            await loadData(false); // 清除缓存不需要重新加载TV信息
                        } catch (error) {
                            console.error('清除缓存失败:', error);
                            Alert.alert('错误', '清除缓存失败');
                        }
                    },
                },
            ]
        );
    };

    const handleClearWatchedCache = async () => {
        // 找出所有已观看的缓存视频
        const watchedVideos: Array<{ tvId: number; episodeId: number; fileSize: number }> = [];

        cachedVideos.forEach((cached) => {
            const tvInfo = tvInfoMap.get(cached.tvId);
            if (tvInfo) {
                // 如果当前集数小于观看进度，说明已经看过了
                if (cached.episodeId < tvInfo.user_data.watch_progress.episode_id) {
                    watchedVideos.push({
                        tvId: cached.tvId,
                        episodeId: cached.episodeId,
                        fileSize: cached.fileSize,
                    });
                }
            }
        });
        try {
            await videoCache.clearWatchedCache(watchedVideos);
            Alert.alert('成功', '已清除已观看缓存');
        } catch (error) {
            console.error('清除已观看缓存失败:', error);
            Alert.alert('错误', '清除已观看缓存失败');
        }
        await loadData(false);
    };

    const handleDeleteTvCache = async (tvId: number) => {
        const tvInfo = tvInfoMap.get(tvId);
        const tvSize = getTvCacheSize(tvId);
        const episodeCount = groupedCachedVideos[tvId]?.length || 0;

        try {
            await videoCache.deleteTvCache(tvId);
            await loadData(false);
        } catch (error) {
            console.error('删除TV缓存失败:', error);
            Alert.alert('错误', '删除TV缓存失败');
        }
    };

    const handleCancelDownload = async (tvId: number, episodeId: number) => {
        try {
            await videoCache.cancelDownloadTask(tvId, episodeId);
            updateDownloadTasks();
        } catch (error) {
            console.error('取消下载失败:', error);
            Alert.alert('错误', '取消下载失败');
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    };

    const getDownloadStatusText = (status: DownloadStatus): string => {
        const statusMap = {
            [DownloadStatus.PENDING]: '等待中',
            [DownloadStatus.DOWNLOADING]: '下载中',
            [DownloadStatus.COMPLETED]: '已完成',
            [DownloadStatus.FAILED]: '失败',
            [DownloadStatus.CANCELLED]: '已取消',
        };
        return statusMap[status] || status;
    };

    const getDownloadStatusColor = (status: DownloadStatus): string => {
        const colorMap = {
            [DownloadStatus.PENDING]: '#FF9500',
            [DownloadStatus.DOWNLOADING]: '#007AFF',
            [DownloadStatus.COMPLETED]: '#34C759',
            [DownloadStatus.FAILED]: '#FF3B30',
            [DownloadStatus.CANCELLED]: '#8E8E93',
        };
        return colorMap[status] || '#8E8E93';
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={onBack}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <View style={styles.titleBarCenter}>
                        <Text style={styles.title}>缓存管理</Text>
                    </View>
                    <View style={styles.titleBarPlaceholder} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>加载中...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={onBack}
                    activeOpacity={0.7}
                >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <View style={styles.titleBarCenter}>
                    <Text style={styles.title}>缓存管理</Text>
                </View>
                <View style={styles.titleBarPlaceholder} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
            >
                {/* 缓存统计 */}
                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>已缓存</Text>
                        <Text style={styles.statValue}>{cachedVideos.length} 个</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>总大小</Text>
                        <Text style={styles.statValue}>{formatFileSize(totalSize)}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>下载中</Text>
                        <Text style={styles.statValue}>
                            {videoCache.getRunningDownloadsCount()}/{videoCache.getTotalDownloadTasksCount()}
                        </Text>
                    </View>
                </View>

                {/* 离线模式状态 */}
                {isOffline && (
                    <View style={styles.offlineStatusContainer}>
                        <View style={styles.offlineStatusHeader}>
                            <Text style={styles.offlineStatusIcon}>✈️</Text>
                            <Text style={styles.offlineStatusTitle}>离线模式</Text>
                        </View>
                        <Text style={styles.offlineStatusText}>
                            当前处于离线模式
                            {pendingChangesCount.total > 0 && (
                                `，有${pendingChangesCount.total}项待同步数据`
                            )}
                        </Text>
                        <Text style={styles.offlineStatusHint}>
                            可在主菜单中切换离线模式
                        </Text>
                    </View>
                )}

                {/* 下载任务 */}
                {downloadTasks.length > 0 && (
                    <View style={styles.section}>
                        <TouchableOpacity
                            style={styles.sectionHeaderCollapsible}
                            onPress={() => setDownloadTasksCollapsed(!downloadTasksCollapsed)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.sectionTitle}>下载任务 ({downloadTasks.length})</Text>
                            <Text style={styles.collapseIcon}>
                                {downloadTasksCollapsed ? '▶' : '▼'}
                            </Text>
                        </TouchableOpacity>

                        {!downloadTasksCollapsed && downloadTasks.map((task) => {
                            const tvInfo = tvInfoMap.get(task.tvId);
                            const episodeName = getEpisodeName(task.tvId, task.episodeId);
                            return (
                                <View key={`${task.tvId}_${task.episodeId}`} style={styles.taskCard}>
                                    <View style={styles.taskInfo}>
                                        <Text style={styles.taskTitle}>
                                            {tvInfo?.name || `TV ${task.tvId}`} - {episodeName}
                                        </Text>
                                        <View style={styles.taskMeta}>
                                            <View
                                                style={[
                                                    styles.statusBadge,
                                                    { backgroundColor: getDownloadStatusColor(task.status) },
                                                ]}
                                            >
                                                <Text style={styles.statusText}>
                                                    {getDownloadStatusText(task.status)}
                                                </Text>
                                            </View>
                                            {task.status === DownloadStatus.DOWNLOADING && (
                                                <Text style={styles.taskProgress}>
                                                    {(task.progress * 100).toFixed(1)}% (
                                                    {formatFileSize(task.downloadedBytes)}/
                                                    {formatFileSize(task.totalBytes)}
                                                    )
                                                </Text>
                                            )}
                                        </View>
                                        {task.status === DownloadStatus.DOWNLOADING && (
                                            <View style={styles.progressBarContainer}>
                                                <View
                                                    style={[
                                                        styles.progressBar,
                                                        { width: `${task.progress * 100}%` },
                                                    ]}
                                                />
                                            </View>
                                        )}
                                        {task.error && (
                                            <Text style={styles.errorText}>{task.error}</Text>
                                        )}
                                    </View>
                                    {(task.status === DownloadStatus.PENDING ||
                                        task.status === DownloadStatus.DOWNLOADING) && (
                                            <TouchableOpacity
                                                style={styles.cancelButton}
                                                onPress={() => handleCancelDownload(task.tvId, task.episodeId)}
                                            >
                                                <Text style={styles.cancelButtonText}>取消</Text>
                                            </TouchableOpacity>
                                        )}
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* 已缓存视频 */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>已缓存视频</Text>
                        {cachedVideos.length > 0 && (
                            <View style={styles.actionButtons}>
                                <TouchableOpacity
                                    onPress={handleClearWatchedCache}
                                    style={styles.actionButton}
                                >
                                    <Text style={styles.clearWatchedText}>清除已观看</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleClearAllCache}>
                                    <Text style={styles.clearAllText}>清除全部</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {Object.keys(groupedCachedVideos).length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>暂无缓存</Text>
                        </View>
                    ) : (
                        Object.entries(groupedCachedVideos).map(([tvIdStr, videos]) => {
                            const tvId = parseInt(tvIdStr);
                            const tvInfo = tvInfoMap.get(tvId);
                            const isCollapsed = collapsedTvs[tvId] !== false; // 默认折叠
                            const tvSize = getTvCacheSize(tvId);

                            return (
                                <View key={tvId} style={styles.tvGroup}>
                                    {/* TV组头部 */}
                                    <View style={styles.tvGroupHeader}>
                                        <TouchableOpacity
                                            style={styles.tvGroupHeaderLeft}
                                            onPress={() => toggleTvCollapse(tvId)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.tvGroupTitle}>
                                                {tvInfo?.name || `TV ${tvId}`}
                                            </Text>
                                            <Text style={styles.tvGroupInfo}>
                                                {videos.length}集 • {formatFileSize(tvSize)}
                                            </Text>
                                            <Text style={styles.collapseIcon}>
                                                {isCollapsed ? '▶' : '▼'}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.deleteTvButton}
                                            onPress={() => handleDeleteTvCache(tvId)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.deleteTvButtonText}>删除</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* TV组内容 */}
                                    {!isCollapsed && (
                                        loadingDetails.has(tvId) ? (
                                            <View style={styles.loadingDetailsContainer}>
                                                <ActivityIndicator size="small" color="#007AFF" />
                                                <Text style={styles.loadingDetailsText}>加载中...</Text>
                                            </View>
                                        ) : (
                                            videos.map((cached) => {
                                                const episodeName = getEpisodeName(cached.tvId, cached.episodeId);
                                                return (
                                                    <View key={`${cached.tvId}_${cached.episodeId}`} style={styles.cacheCard}>
                                                        <View style={styles.cacheInfo}>
                                                            <Text style={styles.cacheTitle}>
                                                                {episodeName}
                                                            </Text>
                                                            <Text style={styles.cacheMeta}>
                                                                {formatFileSize(cached.fileSize)} •{' '}
                                                                {new Date(cached.downloadedAt).toLocaleDateString()}
                                                            </Text>
                                                        </View>
                                                        <TouchableOpacity
                                                            style={styles.deleteButton}
                                                            onPress={() => handleDeleteCache(cached.tvId, cached.episodeId)}
                                                        >
                                                            <Text style={styles.deleteButtonText}>删除</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                );
                                            })
                                        )
                                    )}
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleBarCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
    },
    titleBarPlaceholder: {
        width: 40,
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
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    statsContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
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
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 12,
        color: '#999',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: '#e0e0e0',
    },
    // 离线模式状态
    offlineStatusContainer: {
        backgroundColor: '#FFF3CD',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FFE69C',
    },
    offlineStatusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    offlineStatusIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    offlineStatusTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#856404',
    },
    offlineStatusText: {
        fontSize: 14,
        color: '#856404',
        marginBottom: 4,
    },
    offlineStatusHint: {
        fontSize: 12,
        color: '#856404',
        opacity: 0.7,
    },
    section: {
        marginBottom: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionHeaderCollapsible: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    actionButton: {
        marginRight: 12,
    },
    clearWatchedText: {
        fontSize: 14,
        color: '#FF9500',
        fontWeight: '500',
    },
    clearAllText: {
        fontSize: 14,
        color: '#FF3B30',
        fontWeight: '500',
    },
    taskCard: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    taskInfo: {
        flex: 1,
    },
    taskTitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#333',
        marginBottom: 6,
    },
    taskMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 8,
    },
    statusText: {
        fontSize: 11,
        color: '#fff',
        fontWeight: '500',
    },
    taskProgress: {
        fontSize: 12,
        color: '#666',
    },
    progressBarContainer: {
        height: 4,
        backgroundColor: '#e0e0e0',
        borderRadius: 2,
        overflow: 'hidden',
        marginTop: 6,
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#007AFF',
    },
    errorText: {
        fontSize: 12,
        color: '#FF3B30',
        marginTop: 4,
    },
    cancelButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        backgroundColor: '#FF3B30',
        marginLeft: 8,
    },
    cancelButtonText: {
        fontSize: 13,
        color: '#fff',
        fontWeight: '500',
    },
    cacheCard: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    cacheInfo: {
        flex: 1,
    },
    cacheTitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#333',
        marginBottom: 4,
    },
    cacheMeta: {
        fontSize: 12,
        color: '#999',
    },
    deleteButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        backgroundColor: '#FF3B30',
        marginLeft: 8,
    },
    deleteButtonText: {
        fontSize: 13,
        color: '#fff',
        fontWeight: '500',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#999',
    },
    // TV分组样式
    tvGroup: {
        marginBottom: 12,
    },
    tvGroupHeader: {
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 4,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    tvGroupHeaderLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    tvGroupTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        flex: 1,
    },
    deleteTvButton: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderLeftWidth: 1,
        borderLeftColor: '#f0f0f0',
    },
    deleteTvButtonText: {
        fontSize: 14,
        color: '#FF3B30',
        fontWeight: '500',
    },
    tvGroupInfo: {
        fontSize: 12,
        color: '#999',
        marginRight: 8,
    },
    collapseIcon: {
        fontSize: 12,
        color: '#999',
    },
    loadingDetailsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 4,
    },
    loadingDetailsText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#666',
    },
});
