import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Image,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTVInfos, getApiBaseUrl, getApiToken } from '../api/client-proxy';
import type { TVInfo, Tag } from '../api/types';

interface HomeScreenProps {
    onLogout: () => void;
    onTVPress?: (tv: TVInfo) => void;
}

export default function HomeScreen({ onLogout, onTVPress }: HomeScreenProps) {
    const [baseUrl, setBaseUrl] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [tvs, setTvs] = useState<TVInfo[]>([]);
    const [error, setError] = useState<string | null>(null);
    // 折叠状态：默认只有watching展开
    const [collapsedTags, setCollapsedTags] = useState<Record<Tag, boolean>>({
        watching: false,
        wanted: true,
        watched: true,
        on_hold: true,
        not_tagged: true,
    });

    useEffect(() => {
        loadData();
    }, []);

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
                <Text style={styles.titleBarText}>追番小助手</Text>
            </View>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
                                                    source={{ uri: getCoverUrl(tv.cover_url) }}
                                                    style={styles.coverImage}
                                                    resizeMode="cover"
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
        alignItems: 'center',
    },
    titleBarText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
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
});
