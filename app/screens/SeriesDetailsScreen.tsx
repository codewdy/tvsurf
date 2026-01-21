import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    BackHandler,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getSeries, getTVInfos, getApiBaseUrl, getApiToken } from '../api/client-proxy';
import type { Series, TVInfo } from '../api/types';

interface SeriesDetailsScreenProps {
    seriesId: number;
    onBack: () => void;
    onTVPress?: (tv: TVInfo) => void;
}

export default function SeriesDetailsScreen({ seriesId, onBack, onTVPress }: SeriesDetailsScreenProps) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [series, setSeries] = useState<Series | null>(null);
    const [tvInfos, setTVInfos] = useState<TVInfo[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [baseUrl, setBaseUrl] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [seriesId]);

    // 监听 Android 后退按钮
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            onBack();
            return true; // 返回true表示已处理返回事件
        });

        return () => backHandler.remove();
    }, [onBack]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const url = await getApiBaseUrl();
            const apiToken = await getApiToken();
            setBaseUrl(url);
            setToken(apiToken);

            if (url && apiToken) {
                // 获取播放列表信息
                const seriesData = await getSeries({ ids: [seriesId] });
                if (seriesData.series.length === 0) {
                    setError('播放列表不存在');
                    return;
                }
                const seriesInfo = seriesData.series[0];
                setSeries(seriesInfo);

                // 获取所有 TV 信息
                if (seriesInfo.tvs.length > 0) {
                    const tvData = await getTVInfos({ ids: seriesInfo.tvs });
                    // 按 TV ID 顺序排序，保持原始顺序
                    const sortedTVs = seriesInfo.tvs
                        .map((tvId) => tvData.tvs.find((tv) => tv.id === tvId))
                        .filter((tv): tv is TVInfo => tv !== undefined);
                    setTVInfos(sortedTVs);
                } else {
                    setTVInfos([]);
                }
            }
        } catch (error) {
            console.error('Error loading series details:', error);
            // 检查是否是401错误
            if (error && typeof error === 'object' && (error as any).status === 401) {
                setError('未授权，请重新登录');
            } else {
                setError(error instanceof Error ? error.message : '加载失败');
            }
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            setError(null);
            // 获取播放列表信息
            const seriesData = await getSeries({ ids: [seriesId] });
            if (seriesData.series.length === 0) {
                setError('播放列表不存在');
                return;
            }
            const seriesInfo = seriesData.series[0];
            setSeries(seriesInfo);

            // 获取所有 TV 信息
            if (seriesInfo.tvs.length > 0) {
                const tvData = await getTVInfos({ ids: seriesInfo.tvs });
                // 按 TV ID 顺序排序，保持原始顺序
                const sortedTVs = seriesInfo.tvs
                    .map((tvId) => tvData.tvs.find((tv) => tv.id === tvId))
                    .filter((tv): tv is TVInfo => tv !== undefined);
                setTVInfos(sortedTVs);
            } else {
                setTVInfos([]);
            }
        } catch (error) {
            console.error('Error refreshing series details:', error);
            // 检查是否是401错误
            if (error && typeof error === 'object' && (error as any).status === 401) {
                setError('未授权，请重新登录');
            } else {
                setError(error instanceof Error ? error.message : '刷新失败');
            }
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

    // 获取标签显示文本
    const getTagText = (tag: string): string => {
        const tagMap: Record<string, string> = {
            watching: '观看中',
            wanted: '想看',
            watched: '已看',
            on_hold: '暂停',
            not_tagged: '未标记',
        };
        return tagMap[tag] || tag;
    };

    // 获取标签颜色
    const getTagColor = (tag: string): string => {
        const colorMap: Record<string, string> = {
            watching: '#4CAF50',
            wanted: '#2196F3',
            watched: '#9E9E9E',
            on_hold: '#FF9800',
            not_tagged: '#757575',
        };
        return colorMap[tag] || '#757575';
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
                    style={styles.backButton}
                    onPress={onBack}
                    activeOpacity={0.7}
                >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <View style={styles.titleBarCenter}>
                    <Text style={styles.titleBarText} numberOfLines={1}>
                        {series?.name || '播放列表详情'}
                    </Text>
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
                    />
                }
            >
                {error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {tvInfos.length === 0 && !error ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="list-outline" size={64} color="#999" />
                        <Text style={styles.emptyText}>该播放列表暂无 TV</Text>
                    </View>
                ) : (
                    <View style={styles.tvList}>
                        {tvInfos.map((tv) => {
                            const coverUrl = tv.cover_url ? getCoverUrl(tv.cover_url) : null;
                            const tagColor = getTagColor(tv.user_data.tag);
                            const progress = tv.user_data.watch_progress;
                            const progressPercent =
                                tv.total_episodes > 0
                                    ? ((progress.episode_id + 1) / tv.total_episodes) * 100
                                    : 0;

                            return (
                                <TouchableOpacity
                                    key={tv.id}
                                    style={styles.tvCard}
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        if (onTVPress) {
                                            onTVPress(tv);
                                        }
                                    }}
                                >
                                    <View style={styles.coverContainer}>
                                        {coverUrl ? (
                                            <ExpoImage
                                                source={{
                                                    uri: coverUrl,
                                                    headers: requestHeaders,
                                                }}
                                                style={styles.coverImage}
                                                contentFit="cover"
                                                cachePolicy="disk"
                                            />
                                        ) : (
                                            <View style={styles.coverPlaceholder}>
                                                <Ionicons name="tv-outline" size={32} color="#999" />
                                            </View>
                                        )}
                                        {/* 标签指示器 */}
                                        <View
                                            style={[
                                                styles.tagIndicator,
                                                { backgroundColor: tagColor },
                                            ]}
                                        />
                                    </View>
                                    <View style={styles.tvInfo}>
                                        <Text style={styles.tvName} numberOfLines={2}>
                                            {tv.name}
                                        </Text>
                                        <View style={styles.tvMeta}>
                                            <View style={styles.tagBadge}>
                                                <View
                                                    style={[
                                                        styles.tagDot,
                                                        { backgroundColor: tagColor },
                                                    ]}
                                                />
                                                <Text style={styles.tagText}>
                                                    {getTagText(tv.user_data.tag)}
                                                </Text>
                                            </View>
                                        </View>
                                        {/* 观看进度条 */}
                                        {tv.total_episodes > 0 && (
                                            <View style={styles.progressContainer}>
                                                <View style={styles.progressBar}>
                                                    <View
                                                        style={[
                                                            styles.progressFill,
                                                            {
                                                                width: `${progressPercent}%`,
                                                                backgroundColor: tagColor,
                                                            },
                                                        ]}
                                                    />
                                                </View>
                                                <Text style={styles.progressText}>
                                                    {progress.episode_id + 1} / {tv.total_episodes}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
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
    titleBarText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
    },
    titleBarPlaceholder: {
        width: 40,
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
        marginTop: 12,
    },
    tvList: {
        gap: 12,
    },
    tvCard: {
        backgroundColor: '#fff',
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
        overflow: 'hidden',
        flexDirection: 'row',
    },
    coverContainer: {
        width: 100,
        aspectRatio: 2 / 3,
        backgroundColor: '#e0e0e0',
        position: 'relative',
    },
    coverImage: {
        width: '100%',
        height: '100%',
    },
    coverPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#e0e0e0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tagIndicator: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#fff',
    },
    tvInfo: {
        flex: 1,
        padding: 12,
        justifyContent: 'space-between',
    },
    tvName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    tvMeta: {
        marginBottom: 8,
    },
    tagBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#f5f5f5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    tagDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    tagText: {
        fontSize: 12,
        color: '#666',
    },
    progressContainer: {
        marginTop: 8,
    },
    progressBar: {
        height: 4,
        backgroundColor: '#e0e0e0',
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 4,
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    progressText: {
        fontSize: 12,
        color: '#666',
    },
});
