import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    RefreshControl,
    Modal,
    Animated,
    TouchableWithoutFeedback,
    Dimensions,
    Alert,
    BackHandler,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTVInfos, getApiBaseUrl, getApiToken, getMonitor, whoami } from '../api/client-proxy';
import { offlineModeManager } from '../utils/offlineModeManager';
import { videoCache } from '../utils/videoCache';
import { checkUpdate, downloadApk, installApk } from '../utils/autoUpdate';
import type { TVInfo, Tag, WhoamiResponse } from '../api/types';
import { getTagName } from '../constants/tagNames';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MENU_WIDTH = Math.min(280, SCREEN_WIDTH * 0.75);

function getWatchedLabel(episodeId: number, time: number, totalEpisodes: number): string {
    const suffix = ` / 共 ${totalEpisodes} 集`;
    if (episodeId === 0 && time === 0) return '未观看' + suffix;
    if (episodeId >= totalEpisodes) return '已看完' + suffix;
    return `第 ${episodeId + 1} 集` + suffix;
}

interface HomeScreenProps {
    onLogout: () => void;
    onTVPress?: (tv: TVInfo) => void;
    onNavigateToCache?: () => void;
    onNavigateToSeriesList?: () => void;
    onNavigateToAddTV?: () => void;
    onNavigateToDownloadMonitor?: () => void;
    onNavigateToErrorManagement?: () => void;
    onNavigateToConfig?: () => void;
    onNavigateToUserManagement?: () => void;
    onNavigateToAccount?: () => void;
}

export default function HomeScreen({
    onLogout,
    onTVPress,
    onNavigateToCache,
    onNavigateToSeriesList,
    onNavigateToAddTV,
    onNavigateToDownloadMonitor,
    onNavigateToErrorManagement,
    onNavigateToConfig,
    onNavigateToUserManagement,
    onNavigateToAccount
}: HomeScreenProps) {
    const [baseUrl, setBaseUrl] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [tvs, setTvs] = useState<TVInfo[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [menuVisible, setMenuVisible] = useState(false);
    // 折叠状态：默认只有watching展开
    const [collapsedTags, setCollapsedTags] = useState<Record<Tag, boolean>>({
        watching: false,
        wanted: true,
        watched: true,
        on_hold: true,
        not_tagged: true,
    });

    // 离线模式状态
    const [isOffline, setIsOffline] = useState(false);
    const [pendingChangesCount, setPendingChangesCount] = useState({ watchProgress: 0, tags: 0, total: 0 });
    const [offlineModeDialogVisible, setOfflineModeDialogVisible] = useState(false);
    const [offlineOperationProgress, setOfflineOperationProgress] = useState({ current: 0, total: 0, message: '' });
    const [offlineOperationInProgress, setOfflineOperationInProgress] = useState(false);
    // 存储有缓存视频的 TV ID 集合
    const [cachedTVIds, setCachedTVIds] = useState<Set<number>>(new Set());
    // 错误数量
    const [errorCount, setErrorCount] = useState(0);
    // 检查更新 / 下载更新
    const [updateCheckInProgress, setUpdateCheckInProgress] = useState(false);
    const [updateDownloadVisible, setUpdateDownloadVisible] = useState(false);
    const [updateDownloadProgress, setUpdateDownloadProgress] = useState(0);
    // 用户信息
    const [userInfo, setUserInfo] = useState<WhoamiResponse | null>(null);

    // 菜单动画
    const slideAnim = useRef(new Animated.Value(-MENU_WIDTH)).current;
    const overlayOpacity = useRef(new Animated.Value(0)).current;

    // 检查用户是否是admin
    const isAdmin = userInfo?.user?.group?.includes('admin') ?? false;
    // 检查是否是单用户模式
    const isSingleUserMode = userInfo?.single_user_mode ?? false;

    useEffect(() => {
        loadData();
        loadOfflineStatus();
        loadCachedVideos();
        loadErrorCount();
        loadUserInfo();
        handleCheckUpdate(true);
    }, []);

    // 监听 Android 后退按钮
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            // 如果离线模式操作正在进行，不允许返回（防止中断操作）
            if (offlineOperationInProgress) {
                return true; // 返回true表示已处理返回事件，阻止返回
            }
            // 如果更新下载正在进行，不允许返回
            if (updateDownloadVisible) {
                return true;
            }
            // 如果离线模式对话框打开，关闭对话框
            if (offlineModeDialogVisible) {
                setOfflineModeDialogVisible(false);
                setOfflineOperationInProgress(false);
                return true; // 返回true表示已处理返回事件
            }
            // 如果菜单打开，关闭菜单
            if (menuVisible) {
                closeMenu();
                return true; // 返回true表示已处理返回事件
            }
            // 主屏幕通常不需要返回键处理，返回false让系统处理（可能会退出应用）
            return false;
        });

        return () => backHandler.remove();
    }, [menuVisible, offlineModeDialogVisible, offlineOperationInProgress, updateDownloadVisible]);

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

    // 加载缓存的视频信息
    const loadCachedVideos = async () => {
        try {
            const cachedVideos = await videoCache.getAllCachedVideos();
            const tvIdsSet = new Set<number>();
            cachedVideos.forEach(video => {
                tvIdsSet.add(video.tvId);
            });
            setCachedTVIds(tvIdsSet);
        } catch (error) {
            console.error('加载缓存视频信息失败:', error);
        }
    };

    // 加载错误数量
    const loadErrorCount = async () => {
        try {
            const monitor = await getMonitor({});
            setErrorCount(monitor.error_count);
        } catch (error) {
            console.error('加载错误数量失败:', error);
            setErrorCount(0);
        }
    };

    // 加载用户信息
    const loadUserInfo = async () => {
        try {
            const info = await whoami({});
            setUserInfo(info);
        } catch (error) {
            console.error('加载用户信息失败:', error);
            // 如果获取用户信息失败，不设置userInfo，isAdmin会默认为false
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const url = await getApiBaseUrl();
            const apiToken = await getApiToken();
            setBaseUrl(url);
            setToken(apiToken);

            // 加载TV列表
            if (url && apiToken) {
                const response = await getTVInfos({ ids: null });
                setTvs(response.tvs);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            // 检查是否是401错误
            if (error && typeof error === 'object' && (error as any).status === 401) {
                // 401未授权，执行登出
                onLogout();
                return;
            }
            setError(error instanceof Error ? error.message : '加载失败');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            setError(null);
            const response = await getTVInfos({ ids: null });
            setTvs(response.tvs);

            // 刷新缓存信息
            await loadCachedVideos();
            // 刷新错误数量
            await loadErrorCount();
        } catch (error) {
            console.error('Error refreshing TV list:', error);
            // 检查是否是401错误
            if (error && typeof error === 'object' && (error as any).status === 401) {
                // 401未授权，执行登出
                onLogout();
                return;
            }
            setError(error instanceof Error ? error.message : '刷新失败');
        } finally {
            setRefreshing(false);
        }
    };

    // 构建完整的封面 URL
    const getCoverUrl = (coverUrl: string): string => {
        if (!coverUrl) return '';
        if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
            return coverUrl;
        }
        if (!baseUrl) return coverUrl;
        // 确保 baseUrl 不以斜杠结尾，coverUrl 以斜杠开头
        const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const path = coverUrl.startsWith('/') ? coverUrl : `/${coverUrl}`;
        return `${base}${path}`;
    };

    // 构建请求headers
    const requestHeaders = React.useMemo(() => {
        if (token) {
            return { Cookie: `tvsurf_token=${token}` };
        }
        return undefined;
    }, [token]);

    // 按tag分组TV
    const groupedTvs = React.useMemo(() => {
        const groups: Record<Tag, TVInfo[]> = {
            watching: [],
            wanted: [],
            watched: [],
            on_hold: [],
            not_tagged: [],
        };

        tvs.forEach((tv) => {
            const tag = tv.user_data.tag;
            if (groups[tag]) {
                groups[tag].push(tv);
            }
        });

        // 对每个组进行排序：按 TV 更新时间和 User 更新时间较大值排序
        Object.keys(groups).forEach((tag) => {
            groups[tag as Tag].sort((a, b) => {
                const aMaxTime = Math.max(
                    new Date(a.last_update).getTime(),
                    new Date(a.user_data.last_update).getTime()
                );
                const bMaxTime = Math.max(
                    new Date(b.last_update).getTime(),
                    new Date(b.user_data.last_update).getTime()
                );
                return bMaxTime - aMaxTime; // 降序，最新的在前
            });
        });

        return groups;
    }, [tvs]);

    // Tag显示顺序
    const tagOrder: Tag[] = ['watching', 'wanted', 'watched', 'on_hold', 'not_tagged'];

    // 切换tag折叠状态
    const toggleTagCollapse = (tag: Tag) => {
        setCollapsedTags(prev => ({
            ...prev,
            [tag]: !prev[tag],
        }));
    };

    // 打开菜单
    const openMenu = () => {
        setMenuVisible(true);
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(overlayOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    };

    // 关闭菜单
    const closeMenu = () => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: -MENU_WIDTH,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(overlayOpacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setMenuVisible(false);
        });
    };

    // 处理菜单项点击
    const handleMenuItemPress = (action: () => void) => {
        closeMenu();
        // 延迟执行动作，等待菜单关闭动画完成
        setTimeout(action, 300);
    };

    // 切换离线模式
    const handleToggleOfflineMode = () => {
        if (isOffline) {
            // 退出离线模式
            handleExitOfflineMode();
        } else {
            // 进入离线模式
            handleEnterOfflineMode();
        }
    };

    // 进入离线模式
    const handleEnterOfflineMode = async () => {
        setOfflineModeDialogVisible(true);
        setOfflineOperationInProgress(true);
        setOfflineOperationProgress({ current: 0, total: 3, message: '准备下载数据...' });

        try {
            await offlineModeManager.enterOfflineMode((current, total, message) => {
                setOfflineOperationProgress({ current, total, message });
            });

            await loadOfflineStatus();
            setOfflineModeDialogVisible(false);

            // 刷新页面数据
            await onRefresh();
        } catch (error) {
            setOfflineModeDialogVisible(false);
            const errorMsg = error instanceof Error ? error.message : '进入离线模式失败';
            Alert.alert('错误', errorMsg);
        } finally {
            setOfflineOperationInProgress(false);
        }
    };

    // 退出离线模式
    const handleExitOfflineMode = async () => {
        setOfflineModeDialogVisible(true);
        setOfflineOperationInProgress(true);
        setOfflineOperationProgress({ current: 0, total: pendingChangesCount.total || 1, message: '准备上传数据...' });

        try {
            const result = await offlineModeManager.exitOfflineMode((current, total, message) => {
                setOfflineOperationProgress({ current, total, message });
            });

            if (result.success) {
                await loadOfflineStatus();
                setOfflineModeDialogVisible(false);

                // 刷新页面数据
                await onRefresh();
            } else {
                setOfflineModeDialogVisible(false);
                const errorMessages = result.errors.map((e) => {
                    if (e.type === 'watch_progress') {
                        return `TV ${e.tvId} 第${e.episodeId}集观看进度: ${e.error}`;
                    } else {
                        return `TV ${e.tvId} 标签: ${e.error}`;
                    }
                }).join('\n');
                Alert.alert(
                    '上传失败',
                    `无法退出离线模式，以下数据上传失败：\n\n${errorMessages}\n\n请检查网络连接后重试，或选择强制退出（将丢失未同步的数据）。`,
                    [
                        { text: '取消', style: 'cancel' },
                        {
                            text: '强制退出',
                            style: 'destructive',
                            onPress: () => handleForceExitOfflineMode(),
                        },
                    ]
                );
            }
        } catch (error) {
            setOfflineModeDialogVisible(false);
            const errorMsg = error instanceof Error ? error.message : '退出离线模式失败';
            Alert.alert('错误', errorMsg);
        } finally {
            setOfflineOperationInProgress(false);
        }
    };

    // 强制退出离线模式（删除未同步数据）
    const handleForceExitOfflineMode = async () => {
        setOfflineModeDialogVisible(true);
        setOfflineOperationInProgress(true);
        setOfflineOperationProgress({ current: 0, total: 1, message: '强制退出离线模式...' });

        try {
            const result = await offlineModeManager.exitOfflineMode((current, total, message) => {
                setOfflineOperationProgress({ current, total, message });
            }, true); // force = true

            // 无论成功或失败，强制模式下都已经退出了离线模式
            await loadOfflineStatus();
            setOfflineModeDialogVisible(false);

            if (result.success) {
                Alert.alert('成功', '已退出离线模式');
            } else {
                Alert.alert('警告', '已强制退出离线模式，未同步的数据已被删除');
            }

            // 刷新页面数据
            await onRefresh();
        } catch (error) {
            setOfflineModeDialogVisible(false);
            const errorMsg = error instanceof Error ? error.message : '强制退出失败';
            Alert.alert('错误', errorMsg);
        } finally {
            setOfflineOperationInProgress(false);
        }
    };


    // 检查更新（仅 Android）
    const handleCheckUpdate = async (isAutoCheck = false) => {
        if (Platform.OS !== 'android') return;

        // 如果是自动检查，重新获取一次离线状态，确保准确
        let currentIsOffline = isOffline;
        if (isAutoCheck) {
            try {
                currentIsOffline = await offlineModeManager.getOfflineMode();
            } catch { /* ignore */ }
        }

        if (currentIsOffline) {
            if (!isAutoCheck) {
                Alert.alert('提示', '离线模式下无法检查更新，请先退出离线模式');
            }
            return;
        }
        setUpdateCheckInProgress(true);
        try {
            const result = await checkUpdate();
            if (result.available) {
                // 如果是自动检查，且该版本已提示过，则跳过
                if (isAutoCheck) {
                    const lastPrompted = await AsyncStorage.getItem('last_prompted_update_version');
                    if (lastPrompted === result.latestVersion) {
                        return;
                    }
                }

                Alert.alert(
                    '发现新版本',
                    `当前版本 ${result.currentVersion}，服务器版本 ${result.latestVersion}，是否下载更新？`,
                    [
                        {
                            text: '取消',
                            style: 'cancel',
                            onPress: () => {
                                // 自动检查时点击取消，记录该版本已提示，避免重复弹窗
                                if (isAutoCheck) {
                                    AsyncStorage.setItem('last_prompted_update_version', result.latestVersion);
                                }
                            }
                        },
                        {
                            text: '立即更新',
                            onPress: () => {
                                setUpdateDownloadVisible(true);
                                setUpdateDownloadProgress(0);
                                downloadApk((p) => setUpdateDownloadProgress(p))
                                    .then((uri) => {
                                        setUpdateDownloadVisible(false);
                                        return installApk(uri);
                                    })
                                    .catch((err) => {
                                        setUpdateDownloadVisible(false);
                                        Alert.alert('更新失败', err instanceof Error ? err.message : '下载或安装失败');
                                    });
                            },
                        },
                    ]
                );
            } else {
                if (!isAutoCheck) {
                    Alert.alert('检查更新', `当前已是最新版本（${result.currentVersion}）`);
                }
            }
        } catch (err) {
            if (!isAutoCheck) {
                Alert.alert('检查更新失败', err instanceof Error ? err.message : '获取版本信息失败');
            }
        } finally {
            setUpdateCheckInProgress(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>加载中...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.titleBar}>
                <TouchableOpacity
                    style={styles.menuButton}
                    onPress={openMenu}
                    activeOpacity={0.7}
                >
                    <View style={styles.hamburgerIcon}>
                        <View style={styles.hamburgerLine} />
                        <View style={styles.hamburgerLine} />
                        <View style={styles.hamburgerLine} />
                    </View>
                </TouchableOpacity>
                <View style={styles.titleBarCenter}>
                    <Text style={styles.titleBarText}>追番小助手</Text>
                    {isOffline && (
                        <View style={styles.offlineBadge}>
                            <Ionicons name="airplane" size={14} color="#FF9500" />
                        </View>
                    )}
                    {errorCount > 0 && !isOffline && (
                        <TouchableOpacity
                            style={styles.errorBadge}
                            onPress={() => onNavigateToErrorManagement?.()}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="warning" size={14} color="#FF3B30" />
                            <Text style={styles.errorBadgeText}>{errorCount}</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <View style={styles.titleBarPlaceholder} />
            </View>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        enabled={!isOffline}
                    />
                }
            >
                {error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {tvs.length === 0 && !error ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>暂无TV</Text>
                    </View>
                ) : (
                    <View style={styles.tvList}>
                        {tagOrder.map((tag) => {
                            const tvsInGroup = groupedTvs[tag];
                            if (tvsInGroup.length === 0) return null;

                            return (
                                <View key={tag} style={styles.tagGroup}>
                                    <TouchableOpacity
                                        style={styles.tagGroupHeader}
                                        onPress={() => toggleTagCollapse(tag)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.tagGroupTitle}>
                                            {getTagName(tag)}
                                        </Text>
                                        <Text style={styles.tagGroupCount}>
                                            ({tvsInGroup.length})
                                        </Text>
                                        <Text style={styles.collapseIcon}>
                                            {collapsedTags[tag] ? '▶' : '▼'}
                                        </Text>
                                    </TouchableOpacity>
                                    {!collapsedTags[tag] && tvsInGroup.map((tv) => {
                                        const unwatchedEpisodes =
                                            tv.total_episodes - tv.user_data.watch_progress.episode_id;
                                        const hasCachedVideo = cachedTVIds.has(tv.id);
                                        return (
                                            <TouchableOpacity
                                                key={tv.id}
                                                style={styles.tvCard}
                                                onPress={() => onTVPress?.(tv)}
                                                activeOpacity={0.7}
                                            >
                                                <Image
                                                    source={{
                                                        uri: getCoverUrl(tv.cover_url),
                                                        headers: requestHeaders
                                                    }}
                                                    style={styles.coverImage}
                                                    contentFit="cover"
                                                    cachePolicy="disk"
                                                />
                                                <View style={styles.tvInfo}>
                                                    <Text style={styles.tvName} numberOfLines={2}>
                                                        {tv.name}
                                                    </Text>
                                                    <View style={styles.tvMetaRow}>
                                                        <Text style={styles.tvMeta}>
                                                            {getWatchedLabel(
                                                                tv.user_data.watch_progress.episode_id,
                                                                tv.user_data.watch_progress.time,
                                                                tv.total_episodes
                                                            )}
                                                        </Text>
                                                        {hasCachedVideo && (
                                                            <View style={styles.cacheIndicator}>
                                                                <Ionicons name="download" size={12} color="#34C759" />
                                                                <Text style={styles.cacheIndicatorText}>已缓存</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                </View>
                                                {tag === 'watching' && unwatchedEpisodes > 0 && (
                                                    <View style={styles.badge}>
                                                        <Text style={styles.badgeText}>
                                                            {unwatchedEpisodes}
                                                        </Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {/* 侧边菜单 */}
            <Modal
                visible={menuVisible}
                transparent
                animationType="none"
                onRequestClose={closeMenu}
            >
                <View style={styles.menuContainer}>
                    {/* 半透明遮罩 */}
                    <TouchableWithoutFeedback onPress={closeMenu}>
                        <Animated.View
                            style={[
                                styles.menuOverlay,
                                { opacity: overlayOpacity }
                            ]}
                        />
                    </TouchableWithoutFeedback>

                    {/* 菜单内容 */}
                    <Animated.View
                        style={[
                            styles.menuContent,
                            { transform: [{ translateX: slideAnim }] }
                        ]}
                    >
                        <SafeAreaView style={styles.menuSafeArea}>
                            {/* 菜单头部 */}
                            <View style={styles.menuHeader}>
                                <TouchableOpacity
                                    style={styles.menuButton}
                                    onPress={closeMenu}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.closeIcon}>✕</Text>
                                </TouchableOpacity>
                                <Text style={styles.menuTitle}>菜单</Text>
                                <View style={styles.titleBarPlaceholder} />
                            </View>

                            {/* 菜单项 */}
                            <View style={styles.menuItems}>
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => handleMenuItemPress(() => onNavigateToAddTV?.())}
                                    activeOpacity={0.7}
                                    disabled={isOffline}
                                >
                                    <Ionicons 
                                        name="add-circle-outline" 
                                        size={22} 
                                        color={isOffline ? '#999' : '#007AFF'} 
                                        style={styles.menuItemIconComponent}
                                    />
                                    <Text style={[
                                        styles.menuItemText,
                                        isOffline && styles.menuItemTextDisabled
                                    ]}>添加TV</Text>
                                    <Text style={styles.menuItemArrow}>›</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => handleMenuItemPress(() => onNavigateToSeriesList?.())}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons 
                                        name="list-outline" 
                                        size={22} 
                                        color="#007AFF" 
                                        style={styles.menuItemIconComponent}
                                    />
                                    <Text style={styles.menuItemText}>播放列表</Text>
                                    <Text style={styles.menuItemArrow}>›</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => handleMenuItemPress(() => onNavigateToCache?.())}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons 
                                        name="folder-outline" 
                                        size={22} 
                                        color="#007AFF" 
                                        style={styles.menuItemIconComponent}
                                    />
                                    <Text style={styles.menuItemText}>缓存管理</Text>
                                    <Text style={styles.menuItemArrow}>›</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => handleMenuItemPress(() => onNavigateToDownloadMonitor?.())}
                                    activeOpacity={0.7}
                                    disabled={isOffline}
                                >
                                    <Ionicons 
                                        name="download-outline" 
                                        size={22} 
                                        color={isOffline ? '#999' : '#007AFF'} 
                                        style={styles.menuItemIconComponent}
                                    />
                                    <Text style={[
                                        styles.menuItemText,
                                        isOffline && styles.menuItemTextDisabled
                                    ]}>下载监控</Text>
                                    <Text style={styles.menuItemArrow}>›</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => handleMenuItemPress(handleToggleOfflineMode)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons 
                                        name="airplane-outline" 
                                        size={22} 
                                        color="#007AFF" 
                                        style={styles.menuItemIconComponent}
                                    />
                                    <View style={styles.menuItemContent}>
                                        <Text style={styles.menuItemText}>
                                            {isOffline ? '退出离线模式' : '进入离线模式'}
                                        </Text>
                                    </View>
                                    <Text style={styles.menuItemArrow}>›</Text>
                                </TouchableOpacity>

                                {isAdmin && (
                                    <>
                                        <TouchableOpacity
                                            style={[styles.menuItem, isOffline && styles.menuItemDisabled]}
                                            onPress={() => handleMenuItemPress(() => onNavigateToConfig?.())}
                                            activeOpacity={0.7}
                                            disabled={isOffline}
                                        >
                                            <Ionicons 
                                                name="settings-outline" 
                                                size={22} 
                                                color={isOffline ? '#999' : '#007AFF'} 
                                                style={styles.menuItemIconComponent}
                                            />
                                            <View style={styles.menuItemContent}>
                                                <Text style={[
                                                    styles.menuItemText,
                                                    isOffline && styles.menuItemTextDisabled
                                                ]}>系统配置</Text>
                                            </View>
                                            <Text style={styles.menuItemArrow}>›</Text>
                                        </TouchableOpacity>
                                        {isAdmin && !isSingleUserMode && (
                                            <TouchableOpacity
                                                style={[styles.menuItem, isOffline && styles.menuItemDisabled]}
                                                onPress={() => handleMenuItemPress(() => onNavigateToUserManagement?.())}
                                                activeOpacity={0.7}
                                                disabled={isOffline}
                                            >
                                                <Ionicons 
                                                    name="people-outline" 
                                                    size={22} 
                                                    color={isOffline ? '#999' : '#007AFF'} 
                                                    style={styles.menuItemIconComponent}
                                                />
                                                <View style={styles.menuItemContent}>
                                                    <Text style={[
                                                        styles.menuItemText,
                                                        isOffline && styles.menuItemTextDisabled
                                                    ]}>用户管理</Text>
                                                </View>
                                                <Text style={styles.menuItemArrow}>›</Text>
                                            </TouchableOpacity>
                                        )}
                                    </>
                                )}

                                {Platform.OS === 'android' && (
                                    <TouchableOpacity
                                        style={[styles.menuItem, isOffline && styles.menuItemDisabled]}
                                        onPress={() => handleMenuItemPress(() => handleCheckUpdate(false))}
                                        activeOpacity={0.7}
                                        disabled={isOffline || updateCheckInProgress}
                                    >
                                        <Ionicons 
                                            name="refresh-outline" 
                                            size={22} 
                                            color={(isOffline || updateCheckInProgress) ? '#999' : '#007AFF'} 
                                            style={styles.menuItemIconComponent}
                                        />
                                        <Text style={[
                                            styles.menuItemText,
                                            (isOffline || updateCheckInProgress) && styles.menuItemTextDisabled
                                        ]}>
                                            {updateCheckInProgress ? '检查中...' : '检查版本'}
                                        </Text>
                                        <Text style={styles.menuItemArrow}>›</Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => handleMenuItemPress(() => onNavigateToAccount?.())}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons 
                                        name="person-outline" 
                                        size={22} 
                                        color="#007AFF" 
                                        style={styles.menuItemIconComponent}
                                    />
                                    <Text style={styles.menuItemText}>我的账户</Text>
                                    <Text style={styles.menuItemArrow}>›</Text>
                                </TouchableOpacity>
                            </View>
                        </SafeAreaView>
                    </Animated.View>
                </View>
            </Modal>

            {/* 离线模式操作进度对话框 */}
            <Modal
                visible={offlineModeDialogVisible}
                transparent
                animationType="fade"
            >
                <View style={styles.progressDialogOverlay}>
                    <View style={styles.progressDialogContainer}>
                        <Text style={styles.progressDialogTitle}>
                            {isOffline ? '退出离线模式' : '进入离线模式'}
                        </Text>
                        <ActivityIndicator size="large" color="#007AFF" style={styles.progressIndicator} />
                        <Text style={styles.progressMessage}>{offlineOperationProgress.message}</Text>
                        <Text style={styles.progressText}>
                            {offlineOperationProgress.current} / {offlineOperationProgress.total}
                        </Text>
                    </View>
                </View>
            </Modal>

            {/* 更新下载进度对话框 */}
            <Modal visible={updateDownloadVisible} transparent animationType="fade">
                <View style={styles.progressDialogOverlay}>
                    <View style={styles.progressDialogContainer}>
                        <Text style={styles.progressDialogTitle}>正在下载更新</Text>
                        <ActivityIndicator size="large" color="#007AFF" style={styles.progressIndicator} />
                        <Text style={styles.progressMessage}>
                            {Math.round(updateDownloadProgress * 100)}%
                        </Text>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}


// 获取标签样式
function getTagStyle(tag: string) {
    const tagStyles: Record<string, { backgroundColor: string }> = {
        watching: { backgroundColor: '#007AFF' },
        wanted: { backgroundColor: '#FF9500' },
        watched: { backgroundColor: '#34C759' },
        on_hold: { backgroundColor: '#FF3B30' },
        not_tagged: { backgroundColor: '#8E8E93' },
    };
    return tagStyles[tag] || tagStyles.not_tagged;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    titleBar: {
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
    menuButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hamburgerIcon: {
        width: 20,
        height: 14,
        justifyContent: 'space-between',
    },
    hamburgerLine: {
        width: '100%',
        height: 2,
        backgroundColor: '#333',
        borderRadius: 1,
    },
    titleBarCenter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleBarText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
    },
    offlineBadge: {
        marginLeft: 8,
        padding: 4,
        backgroundColor: '#FFF3CD',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorBadge: {
        marginLeft: 8,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 4,
        backgroundColor: '#FFEBEE',
        borderRadius: 12,
    },
    errorBadgeText: {
        marginLeft: 4,
        fontSize: 12,
        fontWeight: '600',
        color: '#FF3B30',
    },
    titleBarPlaceholder: {
        width: 40,
    },
    offlineIndicator: {
        marginLeft: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    offlineIcon: {
        fontSize: 16,
    },
    pendingBadge: {
        marginLeft: 4,
        backgroundColor: '#FF3B30',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        fontSize: 11,
        color: '#fff',
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 12,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    errorContainer: {
        backgroundColor: '#ffebee',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#f44336',
    },
    errorText: {
        color: '#c62828',
        fontSize: 14,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
    },
    tvList: {
        marginBottom: 12,
    },
    tagGroup: {
        marginBottom: 20,
    },
    tagGroupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        paddingHorizontal: 4,
        paddingVertical: 4,
    },
    tagGroupTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginRight: 6,
    },
    tagGroupCount: {
        fontSize: 14,
        color: '#999',
    },
    collapseIcon: {
        fontSize: 12,
        color: '#999',
        marginLeft: 'auto',
    },
    tvCard: {
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 10,
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
        overflow: 'hidden',
    },
    coverImage: {
        width: 80,
        height: 112,
        backgroundColor: '#e0e0e0',
    },
    tvInfo: {
        flex: 1,
        padding: 10,
        justifyContent: 'center',
    },
    tvName: {
        fontSize: 17,
        fontWeight: '600',
        color: '#333',
        marginBottom: 6,
    },
    tvMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    tvMeta: {
        fontSize: 13,
        color: '#666',
    },
    cacheIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: '#E8F5E9',
        borderRadius: 4,
    },
    cacheIndicatorText: {
        fontSize: 11,
        color: '#34C759',
        marginLeft: 4,
        fontWeight: '500',
    },
    badge: {
        backgroundColor: '#FF3B30',
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        paddingHorizontal: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    badgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    // 菜单样式
    menuContainer: {
        flex: 1,
        flexDirection: 'row',
    },
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    menuContent: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: MENU_WIDTH,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: {
            width: 2,
            height: 0,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    menuSafeArea: {
        flex: 1,
    },
    menuHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    menuTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
        flex: 1,
    },
    menuCloseButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuCloseText: {
        fontSize: 24,
        color: '#666',
        lineHeight: 24,
    },
    closeIcon: {
        fontSize: 24,
        color: '#333',
        fontWeight: '300',
    },
    menuItems: {
        paddingTop: 8,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#f0f0f0',
    },
    menuItemDisabled: {
        opacity: 0.5,
    },
    menuItemIconComponent: {
        marginRight: 12,
        width: 22,
        textAlign: 'center',
    },
    menuItemText: {
        flex: 1,
        fontSize: 16,
        color: '#333',
    },
    menuItemTextDisabled: {
        color: '#999',
    },
    menuItemTextDanger: {
        color: '#FF3B30',
    },
    menuItemArrow: {
        fontSize: 20,
        color: '#999',
    },
    menuItemContent: {
        flex: 1,
    },
    menuItemSubtext: {
        fontSize: 12,
        color: '#999',
        marginTop: 2,
    },
    menuItemHint: {
        fontSize: 12,
        color: '#999',
    },
    // 进度对话框样式
    progressDialogOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressDialogContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 24,
        minWidth: 280,
        alignItems: 'center',
    },
    progressDialogTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 20,
    },
    progressIndicator: {
        marginVertical: 16,
    },
    progressMessage: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginTop: 12,
    },
    progressText: {
        fontSize: 13,
        color: '#999',
        marginTop: 8,
    },
});
