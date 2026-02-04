import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Modal,
    FlatList,
    Image,
    Switch,
    BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { searchTV, addTV, getSeries, addSeries, setTVTag, getTVInfos, getApiBaseUrl, getApiToken } from '../api/client-proxy';
import type { Source, SearchError, Tag, Series, TVInfo } from '../api/types';
import { offlineModeManager } from '../utils/offlineModeManager';
import { TAG_NAMES } from '../constants/tagNames';

interface AddTVScreenProps {
    onBack: () => void;
}

export default function AddTVScreen({ onBack }: AddTVScreenProps) {
    const [keyword, setKeyword] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<Source[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [searchErrors, setSearchErrors] = useState<SearchError[]>([]);
    const [addingIds, setAddingIds] = useState<Set<number>>(new Set());
    const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
    const [addError, setAddError] = useState<Map<number, string>>(new Map());
    const [hasSearched, setHasSearched] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmSource, setConfirmSource] = useState<Source | null>(null);
    const [confirmIndex, setConfirmIndex] = useState<number>(-1);
    const [confirmName, setConfirmName] = useState('');
    const [confirmTracking, setConfirmTracking] = useState(false);
    const [confirmSeries, setConfirmSeries] = useState<number[]>([]);
    const [confirmTag, setConfirmTag] = useState<Tag>('not_tagged');
    const [seriesList, setSeriesList] = useState<Series[]>([]);
    const [loadingSeries, setLoadingSeries] = useState(false);
    const [seriesSearchKeyword, setSeriesSearchKeyword] = useState('');
    const [seriesNameError, setSeriesNameError] = useState<string | null>(null);
    const [creatingSeries, setCreatingSeries] = useState(false);
    const [savedTracking, setSavedTracking] = useState(false);
    const [savedSeries, setSavedSeries] = useState<number[]>([]);
    const [savedTag, setSavedTag] = useState<Tag>('not_tagged');
    const [tvList, setTvList] = useState<TVInfo[]>([]);
    const [nameExists, setNameExists] = useState(false);
    const [baseUrl, setBaseUrl] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isOffline, setIsOffline] = useState(false);
    const [episodesDetailIndex, setEpisodesDetailIndex] = useState<number | null>(null);

    useEffect(() => {
        loadConfig();
        loadOfflineStatus();
        fetchTVList();
    }, []);

    // 监听 Android 后退按钮
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            // 如果确认对话框打开，关闭对话框
            if (showConfirmDialog) {
                handleCancelAdd();
                return true; // 返回true表示已处理返回事件
            }
            // 否则返回上一页
            onBack();
            return true; // 返回true表示已处理返回事件
        });

        return () => backHandler.remove();
    }, [onBack, showConfirmDialog]);

    const loadConfig = async () => {
        const url = await getApiBaseUrl();
        const apiToken = await getApiToken();
        setBaseUrl(url);
        setToken(apiToken);
    };

    const loadOfflineStatus = async () => {
        try {
            const offline = await offlineModeManager.getOfflineMode();
            setIsOffline(offline);
        } catch (error) {
            console.error('加载离线模式状态失败:', error);
        }
    };

    const fetchTVList = async () => {
        try {
            const data = await getTVInfos({ ids: null });
            setTvList(data.tvs || []);
        } catch (err) {
            console.error('Fetch TV list error:', err);
        }
    };

    const checkNameExists = (name: string) => {
        if (!name.trim()) {
            setNameExists(false);
            return;
        }
        try {
            const trimmedName = name.trim();
            const exists = tvList.some(
                (tv) => tv.name.trim().toLowerCase() === trimmedName.toLowerCase()
            );
            setNameExists(exists);
        } catch (err) {
            console.error('Check name exists error:', err);
            setNameExists(false);
        }
    };

    const isNameExistsInTVList = (name: string): boolean => {
        if (!name.trim() || tvList.length === 0) {
            return false;
        }
        const trimmedName = name.trim();
        return tvList.some(
            (tv) => tv.name.trim().toLowerCase() === trimmedName.toLowerCase()
        );
    };

    const handleSearch = async () => {
        if (!keyword.trim()) {
            return;
        }

        if (isOffline) {
            Alert.alert('提示', '离线模式下无法搜索TV，请先退出离线模式');
            return;
        }

        setLoading(true);
        setError(null);
        setResults([]);
        setSearchErrors([]);
        setHasSearched(true);

        try {
            const data = await searchTV({ keyword: keyword.trim() });
            setResults(data.source || []);
            setSearchErrors(data.search_error || []);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '搜索时发生错误';
            setError(errorMessage);
            console.error('Search error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSeries = async () => {
        try {
            setLoadingSeries(true);
            const data = await getSeries({ ids: null });
            setSeriesList(data.series || []);
        } catch (err) {
            console.error('Fetch series error:', err);
        } finally {
            setLoadingSeries(false);
        }
    };

    const checkSeriesName = (name: string) => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            setSeriesNameError(null);
            return;
        }
        const exists = seriesList.some(series => series.name === trimmedName);
        if (exists) {
            setSeriesNameError(`播放列表名称 '${trimmedName}' 已存在`);
        } else {
            setSeriesNameError(null);
        }
    };

    const handleCreateSeries = async () => {
        if (!seriesSearchKeyword.trim() || seriesNameError) {
            return;
        }

        try {
            setCreatingSeries(true);
            const data = await addSeries({ name: seriesSearchKeyword.trim() });
            await fetchSeries();
            setConfirmSeries((prev) => [...prev, data.id]);
            setSeriesSearchKeyword('');
            setSeriesNameError(null);
        } catch (err) {
            console.error('Create series error:', err);
            Alert.alert('错误', err instanceof Error ? err.message : '创建播放列表时发生错误');
        } finally {
            setCreatingSeries(false);
        }
    };

    const handleAddTV = (source: Source, index: number) => {
        if (isOffline) {
            Alert.alert('提示', '离线模式下无法添加TV，请先退出离线模式');
            return;
        }

        setConfirmSource(source);
        setConfirmIndex(index);
        setConfirmName(source.name);
        setConfirmTracking(savedTracking);
        setConfirmSeries(savedSeries);
        setConfirmTag(savedTag);
        setNameExists(false);
        setShowConfirmDialog(true);
        fetchSeries();
        checkNameExists(source.name);
    };

    const handleConfirmAdd = async () => {
        if (!confirmSource || confirmIndex === -1) {
            return;
        }

        if (nameExists) {
            return;
        }

        setShowConfirmDialog(false);
        setAddingIds((prev) => new Set(prev).add(confirmIndex));
        setAddError((prev) => {
            const newMap = new Map(prev);
            newMap.delete(confirmIndex);
            return newMap;
        });

        try {
            const data = await addTV({
                name: confirmName.trim(),
                source: confirmSource,
                tracking: confirmTracking,
                series: confirmSeries,
            });
            setAddedIds((prev) => new Set(prev).add(confirmIndex));

            setSavedTracking(confirmTracking);
            setSavedSeries(confirmSeries);
            setSavedTag(confirmTag);

            if (confirmTag !== 'not_tagged') {
                try {
                    await setTVTag({
                        tv_id: data.id,
                        tag: confirmTag,
                    });
                } catch (err) {
                    console.error('Set TV tag error:', err);
                }
            }

            await fetchTVList();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '添加时发生错误';
            setAddError((prev) => new Map(prev).set(confirmIndex, errorMessage));
            console.error('Add TV error:', err);
            Alert.alert('错误', errorMessage);
        } finally {
            setAddingIds((prev) => {
                const newSet = new Set(prev);
                newSet.delete(confirmIndex);
                return newSet;
            });
            setConfirmSource(null);
            setConfirmIndex(-1);
        }
    };

    const handleCancelAdd = () => {
        setSavedTracking(confirmTracking);
        setSavedSeries(confirmSeries);
        setSavedTag(confirmTag);
        setShowConfirmDialog(false);
        setConfirmSource(null);
        setConfirmIndex(-1);
        setConfirmName('');
        setSeriesSearchKeyword('');
        setSeriesNameError(null);
        setNameExists(false);
    };

    const toggleSeries = (seriesId: number) => {
        setConfirmSeries((prev) => {
            if (prev.includes(seriesId)) {
                return prev.filter((id) => id !== seriesId);
            } else {
                return [...prev, seriesId];
            }
        });
    };

    const getCoverUrl = (coverUrl: string): string => {
        if (!coverUrl) return '';
        if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
            return coverUrl;
        }
        if (!baseUrl) return coverUrl;
        const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const path = coverUrl.startsWith('/') ? coverUrl : `/${coverUrl}`;
        return `${base}${path}`;
    };

    const requestHeaders = React.useMemo(() => {
        if (token) {
            return { Cookie: `tvsurf_token=${token}` };
        }
        return undefined;
    }, [token]);

    const filteredAvailableSeries = seriesList.filter(
        (series) =>
            !confirmSeries.includes(series.id) &&
            series.name.toLowerCase().includes(seriesSearchKeyword.toLowerCase())
    );

    const filteredSelectedSeries = seriesList.filter((series) =>
        confirmSeries.includes(series.id)
    );

    const getEpisodesPreview = (episodes: Source['episodes']): string => {
        if (!episodes || episodes.length === 0) return '';
        const total = episodes.length;
        if (total <= 4) {
            // 如果总集数少于等于4集，全部显示
            return episodes.map(ep => ep.name).join('、');
        } else {
            // 显示前两集和最后两集
            const firstTwo = episodes.slice(0, 2).map(ep => ep.name).join('、');
            const lastTwo = episodes.slice(-2).map(ep => ep.name).join('、');
            return `${firstTwo} ... ${lastTwo}（长按查看更多）`;
        }
    };

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
                <Text style={styles.titleBarText}>添加TV</Text>
                <View style={styles.titleBarPlaceholder} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {/* 搜索表单 */}
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        value={keyword}
                        onChangeText={setKeyword}
                        placeholder="输入TV名称..."
                        placeholderTextColor="#999"
                        editable={!loading && !isOffline}
                    />
                    <TouchableOpacity
                        style={[styles.searchButton, (loading || !keyword.trim() || isOffline) && styles.searchButtonDisabled]}
                        onPress={handleSearch}
                        disabled={loading || !keyword.trim() || isOffline}
                        activeOpacity={0.7}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.searchButtonText}>搜索</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* 错误信息 */}
                {error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* 搜索错误信息 */}
                {searchErrors.length > 0 && (
                    <View style={styles.searchErrorContainer}>
                        <Text style={styles.searchErrorTitle}>
                            搜索过程中部分来源出现错误 ({searchErrors.length})
                        </Text>
                        {searchErrors.map((searchError, index) => (
                            <View key={index} style={styles.searchErrorItem}>
                                <Text style={styles.searchErrorSource}>{searchError.source_name}</Text>
                                <Text style={styles.searchErrorText}>{searchError.error}</Text>
                                <Text style={styles.searchErrorKey}>{searchError.source_key}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* 搜索结果 */}
                {results.length > 0 && (
                    <View style={styles.resultsContainer}>
                        <Text style={styles.resultsTitle}>找到 {results.length} 个结果</Text>
                        <View style={styles.resultsList}>
                            {results.map((source, index) => {
                                const isAdding = addingIds.has(index);
                                const isAdded = addedIds.has(index);
                                const hasError = addError.has(index);
                                const exists = isNameExistsInTVList(source.name);

                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.resultCard,
                                            exists && styles.resultCardExists,
                                            (isAdded || isAdding) && styles.resultCardDisabled
                                        ]}
                                        onPress={() => {
                                            if (!isAdded && !isAdding) {
                                                handleAddTV(source, index);
                                            }
                                        }}
                                        onLongPress={() => {
                                            if (source.episodes && source.episodes.length > 0) {
                                                setEpisodesDetailIndex(index);
                                            }
                                        }}
                                        disabled={isAdded || isAdding}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.resultCardImageContainer}>
                                            {source.cover_url ? (
                                                <ExpoImage
                                                    source={{
                                                        uri: getCoverUrl(source.cover_url),
                                                        headers: requestHeaders
                                                    }}
                                                    style={styles.resultCardImage}
                                                    contentFit="cover"
                                                    cachePolicy="disk"
                                                />
                                            ) : (
                                                <View style={styles.resultCardImagePlaceholder}>
                                                    <Text style={styles.resultCardImagePlaceholderText}>无封面</Text>
                                                </View>
                                            )}
                                            {exists && (
                                                <View style={styles.existsBadge}>
                                                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                                                    <Text style={styles.existsBadgeText}>已添加</Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.resultCardInfo}>
                                            <Text style={styles.resultCardName} numberOfLines={1}>
                                                {source.name}
                                            </Text>
                                            <View style={styles.resultCardDetails}>
                                                <Text style={styles.resultCardSource}>
                                                    来源: {source.source.source_name}
                                                </Text>
                                                <Text style={styles.resultCardChannel}>
                                                    频道: {source.source.channel_name}
                                                </Text>
                                                {source.episodes && source.episodes.length > 0 && (
                                                    <Text style={styles.resultCardEpisodes}>
                                                        {source.episodes.length} 集
                                                    </Text>
                                                )}
                                            </View>
                                            {source.episodes && source.episodes.length > 0 && (
                                                <Text style={styles.resultCardEpisodesPreview} numberOfLines={1}>
                                                    {getEpisodesPreview(source.episodes)}
                                                </Text>
                                            )}
                                        </View>
                                        {isAdding && (
                                            <View style={styles.addingIndicator}>
                                                <ActivityIndicator size="small" color="#007AFF" />
                                                <Text style={styles.addingText}>添加中...</Text>
                                            </View>
                                        )}
                                        {hasError && (
                                            <View style={styles.errorIndicator}>
                                                <Text style={styles.errorIndicatorText}>
                                                    {addError.get(index)}
                                                </Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#007AFF" />
                        <Text style={styles.loadingText}>搜索中，可能需要最多1分钟时间</Text>
                    </View>
                )}

                {!loading && results.length === 0 && !error && hasSearched && (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>未找到相关结果，请尝试其他关键词</Text>
                    </View>
                )}

                {!loading && !hasSearched && !error && (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>请输入关键词开始搜索</Text>
                    </View>
                )}
            </ScrollView>

            {/* 确认对话框 */}
            <Modal
                visible={showConfirmDialog}
                transparent
                animationType="fade"
                onRequestClose={handleCancelAdd}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ScrollView
                            style={styles.modalScrollView}
                            contentContainerStyle={styles.modalScrollViewContent}
                        >
                            {/* 名称编辑 */}
                            <View style={styles.modalSection}>
                                <Text style={styles.modalLabel}>名称</Text>
                                <TextInput
                                    style={[
                                        styles.modalInput,
                                        nameExists && styles.modalInputError
                                    ]}
                                    value={confirmName}
                                    onChangeText={(text) => {
                                        setConfirmName(text);
                                        checkNameExists(text);
                                    }}
                                    placeholder="输入TV名称"
                                    placeholderTextColor="#999"
                                />
                                {nameExists && (
                                    <Text style={styles.modalErrorText}>
                                        该名称已存在，请使用其他名称
                                    </Text>
                                )}
                            </View>

                            {/* 追更选项 */}
                            <View style={[styles.modalSection, { paddingVertical: 10 }]}>
                                <View style={[styles.modalSwitchRow, { marginBottom: 0 }]}>
                                    <Text style={[styles.modalLabel, { marginBottom: 0 }]}>追更</Text>
                                    <Switch
                                        value={confirmTracking}
                                        onValueChange={setConfirmTracking}
                                        trackColor={{ false: '#767577', true: '#81b0ff' }}
                                        thumbColor={confirmTracking ? '#007AFF' : '#f4f3f4'}
                                    />
                                </View>
                            </View>

                            {/* Tag选择 */}
                            <View style={styles.modalSection}>
                                <Text style={styles.modalLabel}>标签</Text>
                                <View style={styles.tagSelector}>
                                    {Object.entries(TAG_NAMES).map(([value, label]) => (
                                        <TouchableOpacity
                                            key={value}
                                            style={[
                                                styles.tagOption,
                                                confirmTag === value && styles.tagOptionSelected
                                            ]}
                                            onPress={() => setConfirmTag(value as Tag)}
                                            activeOpacity={0.7}
                                        >
                                            <Text
                                                style={[
                                                    styles.tagOptionText,
                                                    confirmTag === value && styles.tagOptionTextSelected
                                                ]}
                                            >
                                                {label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* 播放列表选择 */}
                            <View style={styles.modalSection}>
                                <Text style={styles.modalLabel}>选择播放列表</Text>

                                {loadingSeries ? (
                                    <ActivityIndicator size="small" color="#007AFF" style={styles.modalLoading} />
                                ) : (
                                    <View style={styles.seriesSelector}>
                                        {/* 搜索框和新建按钮 */}
                                        <View style={styles.seriesSearchContainer}>
                                            <TextInput
                                                style={[
                                                    styles.seriesSearchInput,
                                                    seriesNameError && styles.modalInputError
                                                ]}
                                                value={seriesSearchKeyword}
                                                onChangeText={(text) => {
                                                    setSeriesSearchKeyword(text);
                                                    checkSeriesName(text);
                                                }}
                                                placeholder="搜索播放列表或输入新播放列表名称..."
                                                placeholderTextColor="#999"
                                            />
                                            <TouchableOpacity
                                                style={[
                                                    styles.createSeriesButton,
                                                    (!seriesSearchKeyword.trim() || creatingSeries || !!seriesNameError) && styles.createSeriesButtonDisabled
                                                ]}
                                                onPress={handleCreateSeries}
                                                disabled={!seriesSearchKeyword.trim() || creatingSeries || !!seriesNameError}
                                                activeOpacity={0.7}
                                            >
                                                {creatingSeries ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <Text style={styles.createSeriesButtonText}>新建</Text>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                        {seriesNameError && (
                                            <Text style={styles.modalErrorText}>{seriesNameError}</Text>
                                        )}

                                        {/* 可用播放列表 */}
                                        <View style={styles.seriesListContainer}>
                                            <Text style={styles.seriesListTitle}>可用播放列表</Text>
                                            <ScrollView style={styles.seriesList} nestedScrollEnabled>
                                                {filteredAvailableSeries.map((series) => (
                                                    <TouchableOpacity
                                                        key={series.id}
                                                        style={styles.seriesItem}
                                                        onPress={() => toggleSeries(series.id)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={styles.seriesItemText}>{series.name}</Text>
                                                        <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
                                                    </TouchableOpacity>
                                                ))}
                                                {filteredAvailableSeries.length === 0 && (
                                                    <Text style={styles.seriesListEmpty}>无可用播放列表</Text>
                                                )}
                                            </ScrollView>
                                        </View>

                                        {/* 已选播放列表 */}
                                        <View style={styles.seriesListContainer}>
                                            <Text style={styles.seriesListTitle}>
                                                已选播放列表 ({confirmSeries.length})
                                            </Text>
                                            <ScrollView style={styles.seriesList} nestedScrollEnabled>
                                                {filteredSelectedSeries.map((series) => (
                                                    <TouchableOpacity
                                                        key={series.id}
                                                        style={styles.seriesItem}
                                                        onPress={() => toggleSeries(series.id)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={styles.seriesItemText}>{series.name}</Text>
                                                        <Ionicons name="remove-circle-outline" size={20} color="#FF3B30" />
                                                    </TouchableOpacity>
                                                ))}
                                                {confirmSeries.length === 0 && (
                                                    <Text style={styles.seriesListEmpty}>未选择播放列表</Text>
                                                )}
                                            </ScrollView>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </ScrollView>

                        {/* 按钮 */}
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalButtonCancel}
                                onPress={handleCancelAdd}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.modalButtonCancelText}>取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalButtonConfirm,
                                    (!confirmName.trim() || nameExists) && styles.modalButtonConfirmDisabled
                                ]}
                                onPress={handleConfirmAdd}
                                disabled={!confirmName.trim() || nameExists}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.modalButtonConfirmText}>确认添加</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 集名字详情对话框 */}
            <Modal
                visible={episodesDetailIndex !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setEpisodesDetailIndex(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.episodesModalContent}>
                        <View style={styles.episodesModalHeader}>
                            <Text style={styles.episodesModalTitle}>详细信息</Text>
                            <TouchableOpacity
                                style={styles.episodesModalCloseButton}
                                onPress={() => setEpisodesDetailIndex(null)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.episodesModalScrollView}>
                            {episodesDetailIndex !== null && results[episodesDetailIndex] && (
                                <>
                                    {/* TV信息区域 */}
                                    <View style={styles.episodesModalInfoSection}>
                                        <View style={styles.episodesModalCoverContainer}>
                                            {results[episodesDetailIndex].cover_url ? (
                                                <ExpoImage
                                                    source={{
                                                        uri: getCoverUrl(results[episodesDetailIndex].cover_url),
                                                        headers: requestHeaders
                                                    }}
                                                    style={styles.episodesModalCover}
                                                    contentFit="cover"
                                                    cachePolicy="disk"
                                                />
                                            ) : (
                                                <View style={styles.episodesModalCoverPlaceholder}>
                                                    <Ionicons name="tv-outline" size={40} color="#999" />
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.episodesModalInfo}>
                                            <Text style={styles.episodesModalName}>
                                                {results[episodesDetailIndex].name}
                                            </Text>
                                            <View style={styles.episodesModalMeta}>
                                                <View style={styles.episodesModalMetaItem}>
                                                    <Ionicons name="library-outline" size={16} color="#666" />
                                                    <Text style={styles.episodesModalMetaText}>
                                                        {results[episodesDetailIndex].source.source_name}
                                                    </Text>
                                                </View>
                                                <View style={styles.episodesModalMetaItem}>
                                                    <Ionicons name="tv-outline" size={16} color="#666" />
                                                    <Text style={styles.episodesModalMetaText}>
                                                        {results[episodesDetailIndex].source.channel_name}
                                                    </Text>
                                                </View>
                                                {results[episodesDetailIndex].episodes && results[episodesDetailIndex].episodes.length > 0 && (
                                                    <View style={styles.episodesModalMetaItem}>
                                                        <Ionicons name="list-outline" size={16} color="#666" />
                                                        <Text style={styles.episodesModalMetaText}>
                                                            {results[episodesDetailIndex].episodes.length} 集
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </View>

                                    {/* 剧集列表 */}
                                    {results[episodesDetailIndex].episodes && results[episodesDetailIndex].episodes.length > 0 && (
                                        <View style={styles.episodesModalEpisodesSection}>
                                            <Text style={styles.episodesModalEpisodesTitle}>剧集列表</Text>
                                            <View style={styles.episodesList}>
                                                {results[episodesDetailIndex].episodes.map((episode, epIndex) => (
                                                    <View key={epIndex} style={styles.episodeCapsule}>
                                                        <Text style={styles.episodeCapsuleText}>
                                                            {episode.name}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    )}
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
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
    titleBarText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
        textAlign: 'center',
    },
    titleBarPlaceholder: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 12,
    },
    searchInput: {
        flex: 1,
        height: 44,
        backgroundColor: '#fff',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    searchButton: {
        height: 44,
        paddingHorizontal: 24,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchButtonDisabled: {
        backgroundColor: '#ccc',
    },
    searchButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
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
    searchErrorContainer: {
        backgroundColor: '#fff3cd',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#ffc107',
    },
    searchErrorTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#856404',
        marginBottom: 8,
    },
    searchErrorItem: {
        padding: 8,
        backgroundColor: '#fff',
        borderRadius: 4,
        marginBottom: 8,
    },
    searchErrorSource: {
        fontSize: 14,
        fontWeight: '600',
        color: '#856404',
        marginBottom: 4,
    },
    searchErrorText: {
        fontSize: 12,
        color: '#856404',
        marginBottom: 4,
    },
    searchErrorKey: {
        fontSize: 10,
        color: '#856404',
        backgroundColor: '#ffeaa7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    resultsContainer: {
        marginTop: 16,
    },
    resultsTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
    },
    resultsList: {
    },
    resultCard: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 8,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
        flexDirection: 'row',
        marginBottom: 8,
    },
    resultCardExists: {
        borderWidth: 2,
        borderColor: '#34C759',
    },
    resultCardDisabled: {
        opacity: 0.6,
    },
    resultCardImageContainer: {
        width: 80,
        aspectRatio: 2 / 3,
        backgroundColor: '#e0e0e0',
        position: 'relative',
        flexShrink: 0,
    },
    resultCardImage: {
        width: '100%',
        height: '100%',
    },
    resultCardImagePlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    resultCardImagePlaceholderText: {
        color: '#999',
        fontSize: 10,
    },
    existsBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: '#34C759',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 3,
        gap: 2,
    },
    existsBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '600',
    },
    resultCardInfo: {
        flex: 1,
        padding: 8,
        justifyContent: 'center',
    },
    resultCardName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
        marginBottom: 6,
    },
    resultCardDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    resultCardSource: {
        fontSize: 12,
        color: '#666',
        marginRight: 8,
    },
    resultCardChannel: {
        fontSize: 12,
        color: '#666',
        marginRight: 8,
    },
    resultCardEpisodes: {
        fontSize: 12,
        color: '#007AFF',
    },
    resultCardEpisodesPreview: {
        fontSize: 11,
        color: '#999',
        marginTop: 4,
    },
    addingIndicator: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 8,
    },
    addingText: {
        fontSize: 11,
        color: '#007AFF',
    },
    errorIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 6,
        backgroundColor: '#ffebee',
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
    },
    errorIndicatorText: {
        fontSize: 10,
        color: '#c62828',
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#666',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: '#999',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        width: '90%',
        maxHeight: '90%',
        overflow: 'hidden',
        flexDirection: 'column',
    },
    modalScrollView: {
        width: '100%',
        flexShrink: 1,
    },
    modalScrollViewContent: {
        flexGrow: 1,
    },
    modalSection: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    modalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    modalInput: {
        height: 44,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    modalInputError: {
        borderColor: '#f44336',
    },
    modalErrorText: {
        fontSize: 12,
        color: '#f44336',
        marginTop: 4,
    },
    modalSwitchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    modalHint: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
    },
    tagSelector: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tagOption: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#f5f5f5',
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    tagOptionSelected: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    tagOptionText: {
        fontSize: 12,
        color: '#333',
    },
    tagOptionTextSelected: {
        color: '#fff',
        fontWeight: '600',
    },
    modalLoading: {
        marginVertical: 20,
    },
    seriesSelector: {
        gap: 12,
    },
    seriesSearchContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    seriesSearchInput: {
        flex: 1,
        height: 44,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    createSeriesButton: {
        height: 44,
        paddingHorizontal: 16,
        backgroundColor: '#34C759',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    createSeriesButtonDisabled: {
        backgroundColor: '#ccc',
    },
    createSeriesButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    seriesListContainer: {
        marginTop: 8,
    },
    seriesListTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
    },
    seriesList: {
        maxHeight: 150,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 8,
        backgroundColor: '#f9f9f9',
    },
    seriesItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    seriesItemText: {
        flex: 1,
        fontSize: 14,
        color: '#333',
    },
    seriesListEmpty: {
        padding: 20,
        textAlign: 'center',
        fontSize: 12,
        color: '#999',
    },
    modalButtons: {
        flexDirection: 'row',
        padding: 16,
        paddingBottom: 20,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        backgroundColor: '#fff',
    },
    modalButtonCancel: {
        flex: 1,
        height: 44,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalButtonCancelText: {
        fontSize: 16,
        color: '#333',
    },
    modalButtonConfirm: {
        flex: 1,
        height: 44,
        backgroundColor: '#34C759',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalButtonConfirmDisabled: {
        backgroundColor: '#ccc',
    },
    modalButtonConfirmText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
    episodesModalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        width: '90%',
        maxHeight: '80%',
        overflow: 'hidden',
    },
    episodesModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    episodesModalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        flex: 1,
    },
    episodesModalCloseButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    episodesModalScrollView: {
        maxHeight: 500,
    },
    episodesModalInfoSection: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#f9f9f9',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    episodesModalCoverContainer: {
        width: 100,
        aspectRatio: 2 / 3,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#e0e0e0',
        marginRight: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    episodesModalCover: {
        width: '100%',
        height: '100%',
    },
    episodesModalCoverPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#e0e0e0',
    },
    episodesModalInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    episodesModalName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
    },
    episodesModalMeta: {
    },
    episodesModalMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    episodesModalMetaText: {
        fontSize: 14,
        color: '#666',
        marginLeft: 6,
    },
    episodesModalEpisodesSection: {
        padding: 16,
    },
    episodesModalEpisodesTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
    },
    episodesList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    episodeCapsule: {
        backgroundColor: '#f0f0f0',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 8,
        marginBottom: 8,
    },
    episodeCapsuleText: {
        fontSize: 13,
        color: '#333',
    },
});
