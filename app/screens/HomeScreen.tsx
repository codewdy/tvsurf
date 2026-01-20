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
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getTVInfos, getApiBaseUrl, getApiToken } from '../api/client-proxy';
import { offlineModeManager } from '../utils/offlineModeManager';
import type { TVInfo, Tag } from '../api/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MENU_WIDTH = Math.min(280, SCREEN_WIDTH * 0.75);

interface HomeScreenProps {
    onLogout: () => void;
    onTVPress?: (tv: TVInfo) => void;
    onNavigateToCache?: () => void;
}

export default function HomeScreen({ onLogout, onTVPress, onNavigateToCache }: HomeScreenProps) {
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

    // 菜单动画
    const slideAnim = useRef(new Animated.Value(-MENU_WIDTH)).current;
    const overlayOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        loadData();
        loadOfflineStatus();
    }, []);

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
                                        const unwatchedEpisodes = tv.total_episodes - tv.user_data.watch_progress.episode_id;
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
                                                    <Text style={styles.tvMeta}>
                                                        {tv.user_data.watch_progress.episode_id} / {tv.total_episodes} 集
                                                    </Text>
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
                                    onPress={() => handleMenuItemPress(() => onNavigateToCache?.())}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.menuItemIcon}>📦</Text>
                                    <Text style={styles.menuItemText}>缓存管理</Text>
                                    <Text style={styles.menuItemArrow}>›</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => handleMenuItemPress(handleToggleOfflineMode)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.menuItemIcon}>✈️</Text>
                                    <View style={styles.menuItemContent}>
                                        <Text style={styles.menuItemText}>
                                            {isOffline ? '退出离线模式' : '进入离线模式'}
                                        </Text>
                                    </View>
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
        </SafeAreaView>
    );
}

// 获取标签名称
function getTagName(tag: string): string {
    const tagNames: Record<string, string> = {
        watching: '在看',
        wanted: '想看',
        watched: '看完',
        on_hold: '搁置',
        not_tagged: '未标记',
    };
    return tagNames[tag] || tag;
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
    tvMeta: {
        fontSize: 13,
        color: '#666',
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
    menuItemIcon: {
        fontSize: 22,
        marginRight: 12,
    },
    menuItemText: {
        flex: 1,
        fontSize: 16,
        color: '#333',
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
