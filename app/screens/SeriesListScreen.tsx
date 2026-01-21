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
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getSeries, getTVInfos, getApiBaseUrl, getApiToken } from '../api/client-proxy';
import type { Series, TVInfo } from '../api/types';

interface SeriesListScreenProps {
    onBack: () => void;
    onTVPress?: (tv: TVInfo) => void;
    onSeriesPress?: (seriesId: number) => void;
}

interface SeriesWithTVs extends Series {
    tvInfos: TVInfo[];
}

export default function SeriesListScreen({ onBack, onTVPress, onSeriesPress }: SeriesListScreenProps) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [seriesList, setSeriesList] = useState<SeriesWithTVs[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [baseUrl, setBaseUrl] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

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
                // 获取播放列表列表
                const seriesData = await getSeries({ ids: null });

                // 收集所有 TV ID
                const allTVIds = new Set<number>();
                seriesData.series.forEach((series) => {
                    series.tvs.forEach((tvId) => allTVIds.add(tvId));
                });

                // 获取所有 TV 信息
                const tvData = await getTVInfos({ ids: Array.from(allTVIds) });

                // 创建 TV ID 到 TVInfo 的映射
                const tvMap = new Map<number, TVInfo>();
                tvData.tvs.forEach((tv) => {
                    tvMap.set(tv.id, tv);
                });

                // 组合播放列表和 TV 信息
                const seriesWithTVs: SeriesWithTVs[] = seriesData.series.map((series) => ({
                    ...series,
                    tvInfos: series.tvs
                        .map((tvId) => tvMap.get(tvId))
                        .filter((tv): tv is TVInfo => tv !== undefined),
                }));

                // 根据播放列表中所有 TV 的 last_update、user_data.last_update 和 series.last_update 的最大值进行排序
                const sortedSeries = seriesWithTVs.sort((a, b) => {
                    const getMaxUpdateTime = (series: SeriesWithTVs): number => {
                        const times: number[] = [];

                        // 添加 series 的 last_update
                        if (series.last_update) {
                            times.push(new Date(series.last_update).getTime());
                        }

                        // 添加所有 TV 的 last_update 和 user_data.last_update 的最大值
                        series.tvInfos.forEach((tv) => {
                            const tvUpdateTime = new Date(tv.last_update).getTime();
                            const userUpdateTime = new Date(tv.user_data.last_update).getTime();
                            times.push(Math.max(tvUpdateTime, userUpdateTime));
                        });

                        // 如果没有时间值，返回 0
                        return times.length === 0 ? 0 : Math.max(...times);
                    };

                    const aMaxTime = getMaxUpdateTime(a);
                    const bMaxTime = getMaxUpdateTime(b);

                    // 降序排序，最新的在前
                    return bMaxTime - aMaxTime;
                });

                setSeriesList(sortedSeries);
            }
        } catch (error) {
            console.error('Error loading series list:', error);
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
            // 获取播放列表列表
            const seriesData = await getSeries({ ids: null });

            // 收集所有 TV ID
            const allTVIds = new Set<number>();
            seriesData.series.forEach((series) => {
                series.tvs.forEach((tvId) => allTVIds.add(tvId));
            });

            // 获取所有 TV 信息
            const tvData = await getTVInfos({ ids: Array.from(allTVIds) });

            // 创建 TV ID 到 TVInfo 的映射
            const tvMap = new Map<number, TVInfo>();
            tvData.tvs.forEach((tv) => {
                tvMap.set(tv.id, tv);
            });

            // 组合播放列表和 TV 信息
            const seriesWithTVs: SeriesWithTVs[] = seriesData.series.map((series) => ({
                ...series,
                tvInfos: series.tvs
                    .map((tvId) => tvMap.get(tvId))
                    .filter((tv): tv is TVInfo => tv !== undefined)
                    .sort((a, b) => {
                        // 按更新时间排序，最新的在前
                        return (
                            new Date(b.last_update).getTime() -
                            new Date(a.last_update).getTime()
                        );
                    }),
            }));

            // 根据播放列表中所有 TV 的 last_update、user_data.last_update 和 series.last_update 的最大值进行排序
            const sortedSeries = seriesWithTVs.sort((a, b) => {
                const getMaxUpdateTime = (series: SeriesWithTVs): number => {
                    const times: number[] = [];

                    // 添加 series 的 last_update
                    if (series.last_update) {
                        times.push(new Date(series.last_update).getTime());
                    }

                    // 添加所有 TV 的 last_update 和 user_data.last_update 的最大值
                    series.tvInfos.forEach((tv) => {
                        const tvUpdateTime = new Date(tv.last_update).getTime();
                        const userUpdateTime = new Date(tv.user_data.last_update).getTime();
                        times.push(Math.max(tvUpdateTime, userUpdateTime));
                    });

                    // 如果没有时间值，返回 0
                    return times.length === 0 ? 0 : Math.max(...times);
                };

                const aMaxTime = getMaxUpdateTime(a);
                const bMaxTime = getMaxUpdateTime(b);

                // 降序排序，最新的在前
                return bMaxTime - aMaxTime;
            });

            setSeriesList(sortedSeries);
        } catch (error) {
            console.error('Error refreshing series list:', error);
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
                    <Text style={styles.titleBarText}>播放列表</Text>
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

                {seriesList.length === 0 && !error ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>暂无播放列表</Text>
                    </View>
                ) : (
                    <View style={styles.seriesList}>
                        {seriesList.map((series) => {
                            const firstTV = series.tvInfos[0];
                            const coverUrl = firstTV?.cover_url ? getCoverUrl(firstTV.cover_url) : null;

                            return (
                                <TouchableOpacity
                                    key={series.id}
                                    style={styles.seriesCard}
                                    activeOpacity={0.7}
                                    onPress={() => onSeriesPress?.(series.id)}
                                >
                                    <View style={styles.coverContainer}>
                                        {coverUrl ? (
                                            <ExpoImage
                                                source={{
                                                    uri: coverUrl,
                                                    headers: requestHeaders
                                                }}
                                                style={styles.coverImage}
                                                contentFit="cover"
                                                cachePolicy="disk"
                                            />
                                        ) : (
                                            <View style={styles.coverPlaceholder}>
                                                <Ionicons name="list" size={32} color="#999" />
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.seriesInfo}>
                                        <Text style={styles.seriesName} numberOfLines={2}>
                                            {series.name}
                                        </Text>
                                        <Text style={styles.seriesMeta}>
                                            包含 {series.tvInfos.length} 个 TV
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView >
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
    },
    seriesList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    seriesCard: {
        width: '48%',
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 12,
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
    coverContainer: {
        width: '100%',
        aspectRatio: 2 / 3,
        backgroundColor: '#e0e0e0',
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
    seriesInfo: {
        padding: 10,
    },
    seriesName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    seriesMeta: {
        fontSize: 12,
        color: '#666',
    },
});
