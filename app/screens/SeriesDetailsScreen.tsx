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
    Modal,
    Alert,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { getSeries, getTVInfos, getApiBaseUrl, getApiToken, updateSeriesTVs } from '../api/client-proxy';
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

    // 编辑模式相关状态
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedTVs, setEditedTVs] = useState<TVInfo[]>([]);
    const [showAddTVModal, setShowAddTVModal] = useState(false);
    const [allTVs, setAllTVs] = useState<TVInfo[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

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

    // 进入编辑模式
    const enterEditMode = async () => {
        setIsEditMode(true);
        setEditedTVs([...tvInfos]);
        setHasChanges(false);
        // 加载所有 TV
        try {
            const data = await getTVInfos({ ids: null });
            setAllTVs(data.tvs);
        } catch (error) {
            console.error('Error loading all TVs:', error);
        }
    };

    // 删除 TV
    const deleteTV = (tvId: number) => {
        setEditedTVs(prev => prev.filter(tv => tv.id !== tvId));
        setHasChanges(true);
    };

    // 添加 TV
    const addTV = (tv: TVInfo) => {
        setEditedTVs(prev => [...prev, tv]);
        setHasChanges(true);
        // 不关闭模态框，允许连续添加
    };

    // 拖拽排序
    const onDragEnd = ({ data }: { data: TVInfo[] }) => {
        setEditedTVs(data);
        setHasChanges(true);
    };

    // 保存更改
    const saveChanges = async () => {
        try {
            setSaving(true);
            const tvIds = editedTVs.map(tv => tv.id);
            await updateSeriesTVs({ id: seriesId, tvs: tvIds });
            setTVInfos(editedTVs);
            setIsEditMode(false);
            setHasChanges(false);
        } catch (error) {
            console.error('Error saving changes:', error);
            Alert.alert('保存失败', error instanceof Error ? error.message : '未知错误');
        } finally {
            setSaving(false);
        }
    };

    // 取消编辑
    const cancelEdit = () => {
        if (hasChanges) {
            Alert.alert(
                '放弃更改',
                '您有未保存的更改，确定要放弃吗？',
                [
                    { text: '取消', style: 'cancel' },
                    {
                        text: '确定',
                        onPress: () => {
                            setIsEditMode(false);
                            setHasChanges(false);
                        }
                    }
                ]
            );
        } else {
            setIsEditMode(false);
        }
    };

    // 获取可添加的 TV 列表（过滤掉已添加的，并支持搜索）
    const getAvailableTVs = (): TVInfo[] => {
        const editedTVIds = new Set(editedTVs.map(tv => tv.id));
        let availableTVs = allTVs.filter(tv => !editedTVIds.has(tv.id));

        // 如果有搜索关键词，进行过滤
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            availableTVs = availableTVs.filter(tv =>
                tv.name.toLowerCase().includes(query)
            );
        }

        return availableTVs;
    };

    // 渲染 TV 卡片
    const renderTVCard = (tv: TVInfo, drag?: () => void, isActive?: boolean) => {
        const coverUrl = tv.cover_url ? getCoverUrl(tv.cover_url) : null;
        const tagColor = getTagColor(tv.user_data.tag);
        const progress = tv.user_data.watch_progress;
        const progressPercent =
            tv.total_episodes > 0
                ? ((progress.episode_id + 1) / tv.total_episodes) * 100
                : 0;

        const cardContent = (
            <>
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
            </>
        );

        return (
            <View style={[styles.tvCard, isActive && styles.tvCardActive]}>
                {isEditMode && drag ? (
                    <TouchableOpacity
                        style={styles.tvCardContent}
                        activeOpacity={0.7}
                        onLongPress={drag}
                        delayLongPress={100}
                    >
                        {cardContent}
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={styles.tvCardContent}
                        activeOpacity={0.7}
                        onPress={() => {
                            if (onTVPress) {
                                onTVPress(tv);
                            }
                        }}
                    >
                        {cardContent}
                    </TouchableOpacity>
                )}
                {isEditMode && (
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => deleteTV(tv.id)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="close-circle" size={28} color="#f44336" />
                    </TouchableOpacity>
                )}
            </View>
        );
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
        <>
            <SafeAreaView style={styles.container}>
                <View style={styles.titleBar}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={isEditMode ? cancelEdit : onBack}
                        activeOpacity={0.7}
                    >
                        <Ionicons name={isEditMode ? "close" : "arrow-back"} size={24} color="#333" />
                    </TouchableOpacity>
                    <View style={styles.titleBarCenter}>
                        <Text style={styles.titleBarText} numberOfLines={1}>
                            {series?.name || '播放列表详情'}
                        </Text>
                    </View>
                    {!isEditMode ? (
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={enterEditMode}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="create-outline" size={24} color="#007AFF" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={saveChanges}
                            activeOpacity={0.7}
                            disabled={saving || !hasChanges}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#007AFF" />
                            ) : (
                                <Text style={[
                                    styles.saveButtonText,
                                    (!hasChanges) && styles.saveButtonTextDisabled
                                ]}>保存</Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
                {!isEditMode ? (
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
                                {tvInfos.map((tv) => (
                                    <View key={tv.id}>
                                        {renderTVCard(tv)}
                                    </View>
                                ))}
                            </View>
                        )}
                    </ScrollView>
                ) : (
                    <DraggableFlatList
                        data={editedTVs}
                        onDragEnd={onDragEnd}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={({ item, drag, isActive }: RenderItemParams<TVInfo>) => (
                            <ScaleDecorator>
                                {renderTVCard(item, drag, isActive)}
                            </ScaleDecorator>
                        )}
                        contentContainerStyle={styles.content}
                        containerStyle={styles.scrollView}
                        ListFooterComponent={
                            <TouchableOpacity
                                style={styles.addButton}
                                onPress={() => setShowAddTVModal(true)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="add-circle-outline" size={32} color="#007AFF" />
                                <Text style={styles.addButtonText}>添加 TV</Text>
                            </TouchableOpacity>
                        }
                    />
                )}
            </SafeAreaView>

            {/* 添加 TV 的 Modal - 移到外部确保正确显示 */}
            <Modal
                visible={showAddTVModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => {
                    setShowAddTVModal(false);
                    setSearchQuery('');
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>添加 TV</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowAddTVModal(false);
                                    setSearchQuery('');
                                }}
                                style={styles.modalCloseButton}
                            >
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        {/* 搜索框 */}
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="搜索 TV..."
                                placeholderTextColor="#999"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => setSearchQuery('')}
                                    style={styles.clearButton}
                                >
                                    <Ionicons name="close-circle" size={20} color="#999" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <ScrollView style={styles.modalContent}>
                            {getAvailableTVs().length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="checkmark-circle-outline" size={64} color="#999" />
                                    <Text style={styles.emptyText}>所有 TV 都已添加</Text>
                                </View>
                            ) : (
                                <View style={styles.modalTVGrid}>
                                    {getAvailableTVs().map((tv) => {
                                        const coverUrl = tv.cover_url ? getCoverUrl(tv.cover_url) : null;
                                        const tagColor = getTagColor(tv.user_data.tag);

                                        return (
                                            <TouchableOpacity
                                                key={tv.id}
                                                style={styles.modalTVCardVertical}
                                                onPress={() => addTV(tv)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={styles.modalCoverContainerVertical}>
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
                                                </View>
                                                <View style={styles.modalTVInfoVertical}>
                                                    <Text style={styles.modalTVName} numberOfLines={2}>
                                                        {tv.name}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </>
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
    saveButton: {
        paddingHorizontal: 16,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#007AFF',
    },
    saveButtonTextDisabled: {
        color: '#ccc',
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
        overflow: 'visible',
        marginBottom: 12,
        position: 'relative',
    },
    tvCardActive: {
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 6,
    },
    tvCardContent: {
        flexDirection: 'row',
        overflow: 'hidden',
        borderRadius: 8,
    },
    deleteButton: {
        position: 'absolute',
        top: -8,
        right: -8,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        zIndex: 10,
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
    addButton: {
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#007AFF',
        borderStyle: 'dashed',
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        marginBottom: 12,
    },
    addButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#007AFF',
        marginTop: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '80%',
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    modalCloseButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        marginHorizontal: 16,
        marginBottom: 12,
        paddingHorizontal: 12,
        height: 40,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        padding: 0,
    },
    clearButton: {
        padding: 4,
    },
    modalContent: {
        flex: 1,
    },
    modalTVGrid: {
        padding: 12,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
    },
    modalTVCardVertical: {
        width: '23%',
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        marginBottom: 12,
        marginRight: '2%',
        overflow: 'hidden',
    },
    modalCoverContainerVertical: {
        width: '100%',
        aspectRatio: 2 / 3,
        backgroundColor: '#e0e0e0',
        position: 'relative',
    },
    addIconOverlay: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 12,
        padding: 1,
    },
    modalTVInfoVertical: {
        padding: 8,
    },
    modalTVName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333',
        lineHeight: 18,
    },
});
