import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    BackHandler,
    Platform,
    StatusBar,
    Modal,
    Alert,
    TextInput,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { Ionicons } from '@expo/vector-icons';
import VideoPlayer from '../components/VideoPlayer';
import { getTVDetails, setWatchProgress, setTVTag, setTVTracking, getApiToken, getApiBaseUrl, getSeries, searchTV, updateTVSource, updateEpisodeSource } from '../api/client-proxy';
import type { GetTVDetailsResponse, Tag, Series, Source, SearchError } from '../api/types';
import { videoCache } from '../utils/videoCache';
import { offlineModeManager } from '../utils/offlineModeManager';

interface TVDetailsScreenProps {
    tv: {
        id: number;
        name: string;
        cover_url: string;
    };
    onBack: () => void;
    onSeriesPress?: (seriesId: number) => void;
}

export default function TVDetailsScreen({ tv, onBack, onSeriesPress }: TVDetailsScreenProps) {
    const [token, setToken] = useState<string | null>(null);
    const [baseUrl, setBaseUrl] = useState<string | null>(null);
    const [details, setDetails] = useState<GetTVDetailsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedEpisode, setSelectedEpisode] = useState<number>(0);
    const [resumeTime, setResumeTime] = useState<number>(0);
    const [autoPlay, setAutoPlay] = useState(false);
    const [playbackState, setPlaybackState] = useState({
        currentTime: 0,
        duration: 0,
        isPlaying: false,
    });
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showTagSelector, setShowTagSelector] = useState(false);
    const [showCacheSelector, setShowCacheSelector] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showTagDropdown, setShowTagDropdown] = useState(false);
    const [showSourceSelector, setShowSourceSelector] = useState(false);
    const [seriesList, setSeriesList] = useState<Series[]>([]);
    const [selectedEpisodesForCache, setSelectedEpisodesForCache] = useState<Set<number>>(new Set());
    const lastUpdateTimeRef = useRef<number>(-1);
    const lastUpdateEpisodeRef = useRef<number>(-1);

    // 缓存相关状态
    const [cachedEpisodes, setCachedEpisodes] = useState<Set<number>>(new Set());
    const [downloadingEpisodes, setDownloadingEpisodes] = useState<Map<number, number>>(new Map());
    const [pendingEpisodes, setPendingEpisodes] = useState<Set<number>>(new Set()); // 排队中的剧集
    const [failedDownloads, setFailedDownloads] = useState<Map<number, string>>(new Map()); // 存储下载失败的剧集和错误信息
    const [currentEpisodeLocalUri, setCurrentEpisodeLocalUri] = useState<string | null>(null);

    // 离线模式状态
    const [isOffline, setIsOffline] = useState(false);

    // 追更状态更新中
    const [updatingTracking, setUpdatingTracking] = useState(false);

    // 换源相关状态
    const [sourceSearchKeyword, setSourceSearchKeyword] = useState('');
    const [sourceSearchLoading, setSourceSearchLoading] = useState(false);
    const [sourceSearchResults, setSourceSearchResults] = useState<Source[]>([]);
    const [sourceSearchErrors, setSourceSearchErrors] = useState<SearchError[]>([]);
    const [selectedSourceIndex, setSelectedSourceIndex] = useState<number | null>(null);
    const [updatingSource, setUpdatingSource] = useState(false);
    const [sourceType, setSourceType] = useState<'tv' | 'episode'>('tv'); // 换源类型：整体换源 or 按集换源
    const [selectedEpisodeForSource, setSelectedEpisodeForSource] = useState<number>(0); // 当前要换源的剧集索引
    const [selectedEpisodeInNewSource, setSelectedEpisodeInNewSource] = useState<number>(0); // 在新源中选择的剧集索引

    // 存储取消订阅函数
    const unsubscribersRef = useRef<Array<() => void>>([]);

    // 获取 token 和 baseUrl
    useEffect(() => {
        const fetchConfig = async () => {
            const apiToken = await getApiToken();
            const url = await getApiBaseUrl();
            setToken(apiToken);
            setBaseUrl(url);
        };
        fetchConfig();
    }, []);

    // 构建请求headers
    const requestHeaders = React.useMemo(() => {
        if (token) {
            return { Cookie: `tvsurf_token=${token}` };
        }
        return undefined;
    }, [token]);

    // 获取当前视频 URL
    const currentVideoUrl = details?.episodes[selectedEpisode] || null;
    const hasVideo = currentVideoUrl !== null;

    // 监听 Android 后退按钮
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (isFullscreen) {
                setIsFullscreen(false);
                return true;
            }
            onBack();
            return true; // 阻止默认行为
        });

        return () => backHandler.remove();
    }, [onBack, isFullscreen]);

    // 加载 TV 详情
    useEffect(() => {
        loadTVDetails();
        loadCacheStatus();
        loadDownloadingTasks();
        loadOfflineStatus();

        // 清理函数：组件卸载时清除所有监听器
        return () => {
            unsubscribersRef.current.forEach(unsubscribe => unsubscribe());
            unsubscribersRef.current = [];
        };
    }, [tv.id]);

    // 加载播放列表信息
    useEffect(() => {
        if (showDetailsModal && details) {
            loadSeriesInfo();
        }
    }, [showDetailsModal, details]);

    // 当换源弹窗打开时，如果有关键词则自动搜索
    useEffect(() => {
        if (showSourceSelector && sourceSearchKeyword.trim() && !sourceSearchLoading) {
            const performSearch = async () => {
                setSourceSearchLoading(true);
                setSourceSearchResults([]);
                setSourceSearchErrors([]);
                setSelectedSourceIndex(null);

                try {
                    const data = await searchTV({ keyword: sourceSearchKeyword.trim() });
                    setSourceSearchResults(data.source || []);
                    setSourceSearchErrors(data.search_error || []);
                } catch (err) {
                    console.error('Auto search error:', err);
                } finally {
                    setSourceSearchLoading(false);
                }
            };

            // 延迟一点执行，让UI先渲染
            const timer = setTimeout(() => {
                performSearch();
            }, 300);

            return () => clearTimeout(timer);
        }
    }, [showSourceSelector, sourceSearchKeyword]);

    const loadSeriesInfo = async () => {
        if (!details || details.info.series.length === 0) {
            setSeriesList([]);
            return;
        }
        try {
            const response = await getSeries({ ids: details.info.series });
            setSeriesList(response.series);
        } catch (err) {
            console.error('Error loading series info:', err);
            setSeriesList([]);
        }
    };

    // 加载离线模式状态
    const loadOfflineStatus = async () => {
        try {
            const offline = await offlineModeManager.getOfflineMode();
            setIsOffline(offline);
        } catch (error) {
            console.error('加载离线模式状态失败:', error);
        }
    };

    // 加载缓存状态
    const loadCacheStatus = async () => {
        if (!details) return;

        const cached = new Set<number>();
        for (let i = 0; i < details.episodes.length; i++) {
            const isCached = await videoCache.isCached(tv.id, i);
            if (isCached) {
                cached.add(i);
            }
        }
        setCachedEpisodes(cached);
    };

    // 加载正在下载的任务并注册监听器
    const loadDownloadingTasks = async () => {
        // 获取所有下载任务
        const allTasks = videoCache.getAllDownloadTasks();

        // 过滤出属于当前 TV 的任务
        const currentTvTasks = allTasks.filter(task => task.tvId === tv.id);

        // 为每个任务注册监听器
        currentTvTasks.forEach(task => {
            const { episodeId } = task;

            // 更新初始状态
            if (task.status === 'pending') {
                // 排队中
                setPendingEpisodes(prev => new Set(prev).add(episodeId));
            } else if (task.status === 'downloading') {
                // 下载中
                setDownloadingEpisodes(prev => {
                    const newMap = new Map(prev);
                    newMap.set(episodeId, task.progress);
                    return newMap;
                });
            }

            // 注册进度监听器
            const unsubscribeProgress = videoCache.onProgress(tv.id, episodeId, (updatedTask) => {
                // 如果任务状态从 pending 变为 downloading，从 pending 集合中移除
                if (updatedTask.status === 'downloading') {
                    setPendingEpisodes(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(episodeId);
                        return newSet;
                    });
                }

                // 更新下载进度
                setDownloadingEpisodes(prev => {
                    const newMap = new Map(prev);
                    newMap.set(episodeId, updatedTask.progress);
                    return newMap;
                });
            });

            // 注册完成监听器
            const unsubscribeComplete = videoCache.onComplete(tv.id, episodeId, async (completedTask) => {
                setDownloadingEpisodes(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(episodeId);
                    return newMap;
                });

                setPendingEpisodes(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(episodeId);
                    return newSet;
                });

                setCachedEpisodes(prev => new Set(prev).add(episodeId));

                // 如果是当前剧集，更新本地URI
                if (episodeId === selectedEpisode) {
                    const localUri = await videoCache.getCachedVideoUri(tv.id, episodeId);
                    setCurrentEpisodeLocalUri(localUri);
                }

                // 清理监听器
                unsubscribeProgress();
                unsubscribeComplete();
                unsubscribeError();
            });

            // 注册错误监听器
            const unsubscribeError = videoCache.onError(tv.id, episodeId, (failedTask) => {
                setDownloadingEpisodes(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(episodeId);
                    return newMap;
                });

                setPendingEpisodes(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(episodeId);
                    return newSet;
                });

                // 记录失败信息
                setFailedDownloads(prev => {
                    const newMap = new Map(prev);
                    newMap.set(episodeId, failedTask.error || '未知错误');
                    return newMap;
                });

                // 清理监听器
                unsubscribeProgress();
                unsubscribeComplete();
                unsubscribeError();
            });

            // 存储取消订阅函数
            unsubscribersRef.current.push(unsubscribeProgress, unsubscribeComplete, unsubscribeError);
        });
    };

    // 初始化选中的剧集
    useEffect(() => {
        if (details) {
            const savedEpisode = details.info.user_data.watch_progress.episode_id;
            setSelectedEpisode(savedEpisode);
            setResumeTime(details.info.user_data.watch_progress.time);
            setAutoPlay(false);
            lastUpdateEpisodeRef.current = savedEpisode;
            lastUpdateTimeRef.current = details.info.user_data.watch_progress.time;
        }
    }, [details?.info.user_data.watch_progress.episode_id, details?.info.user_data.watch_progress.time]);

    // 当选中剧集变化时，检查是否有本地缓存
    useEffect(() => {
        const checkLocalCache = async () => {
            const localUri = await videoCache.getCachedVideoUri(tv.id, selectedEpisode);
            setCurrentEpisodeLocalUri(localUri);
        };
        checkLocalCache();
    }, [tv.id, selectedEpisode]);

    const loadTVDetails = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getTVDetails({ id: tv.id });
            setDetails(data);

            // 加载缓存状态
            const cached = new Set<number>();
            for (let i = 0; i < data.episodes.length; i++) {
                const isCached = await videoCache.isCached(tv.id, i);
                if (isCached) {
                    cached.add(i);
                }
            }
            setCachedEpisodes(cached);
        } catch (err) {
            console.error('Error loading TV details:', err);
            setError(err instanceof Error ? err.message : '加载失败');
        } finally {
            setLoading(false);
        }
    };

    const updateWatchProgress = useCallback(async (episodeId: number, time: number) => {
        if (!details) return;
        if (lastUpdateEpisodeRef.current === episodeId && Math.abs(lastUpdateTimeRef.current - time) < 0.2) return;

        try {
            await setWatchProgress({
                tv_id: details.tv.id,
                episode_id: episodeId,
                time: time,
            });
            lastUpdateEpisodeRef.current = episodeId;
            lastUpdateTimeRef.current = time;
        } catch (err) {
            console.error('Update watch progress error:', err);
        }
    }, [details]);

    const handleEpisodeSelect = useCallback((episodeIndex: number, autoPlay: boolean) => {
        // 更新观看进度为当前集数的第0秒
        updateWatchProgress(episodeIndex, 0);
        setSelectedEpisode(episodeIndex);
        setResumeTime(0);
        setAutoPlay(autoPlay);
    }, [details, updateWatchProgress, setResumeTime, setSelectedEpisode]);

    // 监听播放进度并定期更新
    useEffect(() => {
        if (!details) return;
        if (playbackState.duration === 0) return;
        updateWatchProgress(selectedEpisode, playbackState.currentTime);
    }, [details, selectedEpisode, playbackState, updateWatchProgress]);

    useEffect(() => {
        if (!isFullscreen) {
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => null);
            return;
        }
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => null);
    }, [isFullscreen]);

    useEffect(() => {
        StatusBar.setHidden(isFullscreen, 'fade');
        return () => StatusBar.setHidden(false, 'fade');
    }, [isFullscreen]);

    useEffect(() => {
        if (Platform.OS !== 'android') return;

        const syncNavigationBar = async () => {
            try {
                if (isFullscreen) {
                    await NavigationBar.setVisibilityAsync('hidden');
                } else {
                    await NavigationBar.setVisibilityAsync('visible');
                }
            } catch (err) {
                console.error('Update navigation bar error:', err);
            }
        };

        syncNavigationBar();
    }, [isFullscreen]);

    useEffect(() => {
        return () => {
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => null);
            if (Platform.OS === 'android') {
                NavigationBar.setVisibilityAsync('visible').catch(() => null);
            }
        };
    }, []);

    const handleToggleFullscreen = useCallback(() => {
        setIsFullscreen((prev) => !prev);
    }, []);

    const handleTagChange = useCallback(async (tag: Tag) => {
        if (!details) return;

        try {
            await setTVTag({ tv_id: details.tv.id, tag });
            details.info.user_data.tag = tag;
            setShowTagSelector(false);
            setShowMenu(false);
            setShowTagDropdown(false);
        } catch (err) {
            console.error('Error setting tag:', err);
        }
    }, [details]);

    // 切换追更状态
    const handleTrackingChange = useCallback(async () => {
        if (!details || updatingTracking) return;

        const newTracking = !details.tv.track.tracking;

        try {
            setUpdatingTracking(true);
            await setTVTracking({ tv_id: details.tv.id, tracking: newTracking });
            // 更新本地状态
            details.tv.track.tracking = newTracking;
            details.tv.track.last_update = new Date().toISOString();
            setDetails({ ...details });
        } catch (err) {
            console.error('Error setting tracking:', err);
            Alert.alert('错误', '更新追更状态失败，请稍后重试');
        } finally {
            setUpdatingTracking(false);
        }
    }, [details, updatingTracking]);

    // 批量缓存选中的剧集
    const handleBatchDownload = useCallback(async () => {
        if (selectedEpisodesForCache.size === 0) {
            Alert.alert('提示', '请至少选择一集');
            return;
        }

        if (!details || !baseUrl || !token) {
            Alert.alert('错误', '无法缓存视频');
            return;
        }

        // 关闭选择器
        setShowCacheSelector(false);

        // 提交所有下载任务
        const episodesToCache = Array.from(selectedEpisodesForCache);
        let submittedCount = 0;

        const unsubscribers: Array<() => void> = [];

        // 清除选中剧集的失败状态
        setFailedDownloads(prev => {
            const newMap = new Map(prev);
            episodesToCache.forEach(index => newMap.delete(index));
            return newMap;
        });

        for (const episodeIndex of episodesToCache) {
            try {
                // 检查是否已缓存
                const isCached = await videoCache.isCached(tv.id, episodeIndex);
                const isDownloading = videoCache.isDownloading(tv.id, episodeIndex);
                if (isCached || isDownloading) {
                    continue;
                }

                const videoUrl = details.episodes[episodeIndex];
                if (!videoUrl) {
                    continue;
                }

                // 构建完整URL
                const fullUrl = videoUrl.startsWith('http')
                    ? videoUrl
                    : `${baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl}${videoUrl}`;

                // 提交下载任务
                await videoCache.submitDownload(
                    tv.id,
                    episodeIndex,
                    fullUrl,
                    { Cookie: `tvsurf_token=${token}` }
                );

                // 任务初始状态为 pending（排队中）
                setPendingEpisodes(prev => new Set(prev).add(episodeIndex));

                // 注册进度监听器
                const unsubProgress = videoCache.onProgress(tv.id, episodeIndex, (task) => {
                    // 如果任务状态从 pending 变为 downloading，从 pending 集合中移除
                    if (task.status === 'downloading') {
                        setPendingEpisodes(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(episodeIndex);
                            return newSet;
                        });
                    }

                    setDownloadingEpisodes(prev => {
                        const newMap = new Map(prev);
                        newMap.set(episodeIndex, task.progress);
                        return newMap;
                    });
                });

                // 注册完成监听器
                const unsubComplete = videoCache.onComplete(tv.id, episodeIndex, async (task) => {
                    setDownloadingEpisodes(prev => {
                        const newMap = new Map(prev);
                        newMap.delete(episodeIndex);
                        return newMap;
                    });

                    setPendingEpisodes(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(episodeIndex);
                        return newSet;
                    });

                    setCachedEpisodes(prev => new Set(prev).add(episodeIndex));

                    // 如果是当前剧集，更新本地URI
                    if (episodeIndex === selectedEpisode) {
                        const localUri = await videoCache.getCachedVideoUri(tv.id, episodeIndex);
                        setCurrentEpisodeLocalUri(localUri);
                    }
                });

                // 注册错误监听器
                const unsubError = videoCache.onError(tv.id, episodeIndex, (task) => {
                    setDownloadingEpisodes(prev => {
                        const newMap = new Map(prev);
                        newMap.delete(episodeIndex);
                        return newMap;
                    });

                    setPendingEpisodes(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(episodeIndex);
                        return newSet;
                    });

                    // 记录失败信息
                    setFailedDownloads(prev => {
                        const newMap = new Map(prev);
                        newMap.set(episodeIndex, task.error || '未知错误');
                        return newMap;
                    });
                });

                unsubscribers.push(unsubProgress, unsubComplete, unsubError);
                submittedCount++;
            } catch (err) {
                console.error(`提交第 ${episodeIndex + 1} 集下载失败:`, err);
                // 记录失败信息
                setFailedDownloads(prev => {
                    const newMap = new Map(prev);
                    newMap.set(episodeIndex, err instanceof Error ? err.message : '未知错误');
                    return newMap;
                });
            }
        }

        // 将所有取消订阅函数添加到 ref
        unsubscribersRef.current.push(...unsubscribers);

        // 清空选择
        setSelectedEpisodesForCache(new Set());
    }, [selectedEpisodesForCache, details, baseUrl, token, tv.id, selectedEpisode]);

    // 切换剧集选择
    const toggleEpisodeSelection = useCallback((episodeIndex: number) => {
        setSelectedEpisodesForCache(prev => {
            const newSet = new Set(prev);
            if (newSet.has(episodeIndex)) {
                newSet.delete(episodeIndex);
            } else {
                newSet.add(episodeIndex);
            }
            return newSet;
        });
    }, []);

    // 全选/取消全选
    const toggleSelectAll = useCallback(() => {
        if (!details) return;

        if (selectedEpisodesForCache.size === details.episodes.length) {
            // 取消全选
            setSelectedEpisodesForCache(new Set());
        } else {
            // 全选所有可缓存的剧集
            const allIndices = new Set<number>();
            for (let i = 0; i < details.episodes.length; i++) {
                if (details.episodes[i]) {
                    allIndices.add(i);
                }
            }
            setSelectedEpisodesForCache(allIndices);
        }
    }, [details, selectedEpisodesForCache]);

    // 从当前集开始选择
    const selectFromCurrent = useCallback(() => {
        if (!details) return;

        const fromCurrentIndices = new Set<number>();
        for (let i = selectedEpisode; i < details.episodes.length; i++) {
            if (details.episodes[i]) {
                fromCurrentIndices.add(i);
            }
        }
        setSelectedEpisodesForCache(fromCurrentIndices);
    }, [details, selectedEpisode]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>加载中...</Text>
            </View>
        );
    }

    if (error && !details) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!details) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>未找到电视剧详情</Text>
                </View>
            </SafeAreaView>
        );
    }

    const currentEpisode = details.tv.source.episodes[selectedEpisode] || null;
    const storageEp = details.tv.storage.episodes[selectedEpisode] || null;
    const isWatched =
        details.info.user_data.watch_progress.episode_id > selectedEpisode ||
        (details.info.user_data.watch_progress.episode_id === selectedEpisode &&
            details.info.user_data.watch_progress.time > 0);


    return (
        <SafeAreaView style={styles.container}>
            {!isFullscreen && (
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
                            {details.tv.name || ''}
                        </Text>
                        {isOffline && (
                            <View style={styles.offlineBadge}>
                                <Ionicons name="airplane" size={14} color="#FF9500" />
                            </View>
                        )}
                    </View>
                    <TouchableOpacity
                        style={styles.menuButton}
                        onPress={() => setShowMenu(true)}
                    >
                        <Ionicons name="ellipsis-vertical" size={24} color="#333" />
                    </TouchableOpacity>
                </View>
            )}

            <View style={[styles.playerContainer, isFullscreen && styles.playerContainerFullscreen]}>
                {hasVideo ? (
                    <VideoPlayer
                        videoUrl={currentVideoUrl}
                        headers={requestHeaders}
                        resumeTime={resumeTime}
                        autoPlay={autoPlay}
                        onPlaybackState={setPlaybackState}
                        onPlayToEnd={() => handleEpisodeSelect(selectedEpisode + 1, true)}
                        isFullscreen={isFullscreen}
                        onToggleFullscreen={handleToggleFullscreen}
                        localUri={currentEpisodeLocalUri}
                    />
                ) : (
                    <View style={styles.noVideoContainer}>
                        {selectedEpisode >= details.episodes.length ? (
                            <Text style={styles.noVideoText}>已全部播放完毕</Text>
                        ) : storageEp?.status === 'running' ? (
                            <Text style={styles.noVideoText}>该集正在缓存中...</Text>
                        ) : storageEp?.status === 'failed' ? (
                            <Text style={styles.noVideoText}>该集缓存失败</Text>
                        ) : (
                            <Text style={styles.noVideoText}>该集尚未缓存</Text>
                        )}
                        {currentEpisode ? (
                            <Text style={styles.noVideoSubtext}>{currentEpisode.name || ''}</Text>
                        ) : null}
                    </View>
                )}
            </View>

            {!isFullscreen && (
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                    {error && (
                        <View style={styles.errorBanner}>
                            <Text style={styles.errorBannerText}>{error}</Text>
                        </View>
                    )}

                    {/* 剧集列表 */}
                    <View style={styles.episodesSection}>
                        <Text style={styles.sectionTitle}>剧集列表</Text>
                        <View style={styles.episodesGrid}>
                            {details.tv.source.episodes.map((episode, index) => {
                                const epStorage = details.tv.storage.episodes[index];
                                const hasDownloaded = epStorage?.status === 'success';
                                const isDownloading = epStorage?.status === 'running';
                                const isFailed = epStorage?.status === 'failed';
                                const isSelected = index === selectedEpisode;
                                const epIsWatched =
                                    details.info.user_data.watch_progress.episode_id > index ||
                                    (details.info.user_data.watch_progress.episode_id === index &&
                                        details.info.user_data.watch_progress.time > 0);

                                // 本地缓存状态
                                const isCached = cachedEpisodes.has(index);
                                const isPending = pendingEpisodes.has(index);
                                const downloadProgress = downloadingEpisodes.get(index);
                                const isDownloadingToLocal = downloadProgress !== undefined;
                                const downloadError = failedDownloads.get(index);

                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.episodeCard,
                                            isSelected && styles.episodeCardSelected,
                                            { marginHorizontal: 2, marginBottom: 6 },
                                        ]}
                                        onPress={() => handleEpisodeSelect(index, false)}
                                        disabled={!hasDownloaded && !isDownloading && !isCached}
                                    >
                                        <Text
                                            style={[
                                                styles.episodeName,
                                                (!hasDownloaded && !isDownloading && !isCached) &&
                                                styles.episodeNameDisabled,
                                            ]}
                                            numberOfLines={2}
                                        >
                                            {episode.name || ''}
                                        </Text>
                                        <View style={styles.episodeStatusContainer}>
                                            {/* 服务器状态 */}
                                            <View style={styles.episodeStatus}>
                                                {hasDownloaded ? (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                                        <Ionicons name="cloud-done" size={10} color="#4CAF50" />
                                                        <Text style={styles.episodeStatusText}>✓</Text>
                                                    </View>
                                                ) : isDownloading ? (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                                        <Ionicons name="cloud-download" size={10} color="#FF9800" />
                                                        <Text style={styles.episodeStatusTextDownloading}>中</Text>
                                                    </View>
                                                ) : isFailed ? (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                                        <Ionicons name="cloud-offline" size={10} color="#f44336" />
                                                        <Text style={styles.episodeStatusTextFailed}>×</Text>
                                                    </View>
                                                ) : (
                                                    <Text style={styles.episodeStatusText}>-</Text>
                                                )}
                                            </View>
                                            {/* 本地缓存状态 */}
                                            <View style={styles.episodeStatus}>
                                                {isPending ? (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                                        <Ionicons name="time-outline" size={10} color="#9E9E9E" />
                                                        <Text style={styles.episodeStatusTextPending}>
                                                            排队中
                                                        </Text>
                                                    </View>
                                                ) : isDownloadingToLocal ? (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                                        <Ionicons name="phone-portrait" size={10} color="#FF9800" />
                                                        <Text style={styles.episodeStatusTextDownloading}>
                                                            缓存下载中：{Math.round(downloadProgress * 100)}%
                                                        </Text>
                                                    </View>
                                                ) : isCached ? (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                                        <Ionicons name="phone-portrait" size={10} color="#007AFF" />
                                                        <Text style={styles.episodeStatusText}>已缓存</Text>
                                                    </View>
                                                ) : downloadError ? (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                                        <Ionicons name="phone-portrait" size={10} color="#f44336" />
                                                        <Text style={styles.episodeStatusTextFailed}>失败</Text>
                                                    </View>
                                                ) : (
                                                    <Text style={styles.episodeStatusText}>-</Text>
                                                )}
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                </ScrollView>
            )}

            {/* 菜单弹窗 */}
            <Modal
                visible={showMenu}
                transparent
                animationType="fade"
                onRequestClose={() => setShowMenu(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMenu(false)}
                >
                    <View style={styles.menuContainer}>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                                setShowMenu(false);
                                setShowDetailsModal(true);
                            }}
                        >
                            <Ionicons name="information-circle-outline" size={20} color="#333" />
                            <Text style={styles.menuItemText}>详情</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.menuItem,
                                isOffline && styles.menuItemDisabled
                            ]}
                            onPress={() => {
                                if (isOffline) {
                                    Alert.alert('提示', '离线模式下无法添加新的缓存');
                                    return;
                                }
                                setShowMenu(false);
                                setShowCacheSelector(true);
                                setSelectedEpisodesForCache(new Set());
                            }}
                            disabled={isOffline}
                        >
                            <Ionicons name="download-outline" size={20} color={isOffline ? "#999" : "#333"} />
                            <Text style={[
                                styles.menuItemText,
                                isOffline && styles.menuItemTextDisabled
                            ]}>添加缓存</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>


            {/* 缓存选择器弹窗 */}
            <Modal
                visible={showCacheSelector}
                transparent
                animationType="slide"
                onRequestClose={() => setShowCacheSelector(false)}
            >
                <View style={styles.cacheSelectorOverlay}>
                    <View style={styles.cacheSelectorContainer}>
                        <View style={styles.cacheSelectorHeader}>
                            <Text style={styles.cacheSelectorTitle}>选择要缓存的剧集</Text>
                            <TouchableOpacity
                                onPress={() => setShowCacheSelector(false)}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.cacheSelectorActions}>
                            <View style={styles.cacheSelectorActionButtons}>
                                <TouchableOpacity
                                    style={styles.selectAllButton}
                                    onPress={toggleSelectAll}
                                >
                                    <Text style={styles.selectAllButtonText}>
                                        {selectedEpisodesForCache.size === details?.episodes.length ? '取消全选' : '全选'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.selectFromCurrentButton}
                                    onPress={selectFromCurrent}
                                >
                                    <Text style={styles.selectFromCurrentButtonText}>
                                        当前集开始
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.selectedCount}>
                                已选择 {selectedEpisodesForCache.size} 集
                            </Text>
                        </View>

                        <ScrollView style={styles.cacheSelectorEpisodeList}>
                            <View style={styles.cacheSelectorEpisodesGrid}>
                                {details?.tv.source.episodes.map((episode, index) => {
                                    const epStorage = details.tv.storage.episodes[index];
                                    const hasDownloaded = epStorage?.status === 'success';
                                    const isSelected = selectedEpisodesForCache.has(index);
                                    const isCached = cachedEpisodes.has(index);
                                    const isPending = pendingEpisodes.has(index);
                                    const isDownloadingToLocal = downloadingEpisodes.has(index);
                                    const canCache = hasDownloaded && !isCached && !isPending && !isDownloadingToLocal;

                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            style={[
                                                styles.cacheSelectorEpisodeCard,
                                                isSelected && styles.cacheSelectorEpisodeCardSelected,
                                                !canCache && styles.cacheSelectorEpisodeCardDisabled,
                                            ]}
                                            onPress={() => canCache && toggleEpisodeSelection(index)}
                                            disabled={!canCache}
                                        >
                                            <View style={styles.cacheSelectorEpisodeInfo}>
                                                <Text
                                                    style={[
                                                        styles.cacheSelectorEpisodeName,
                                                        !canCache && styles.cacheSelectorEpisodeNameDisabled,
                                                    ]}
                                                    numberOfLines={2}
                                                >
                                                    {episode.name || ''}
                                                </Text>
                                                {isCached && (
                                                    <Text style={styles.cacheSelectorEpisodeTag}>已缓存</Text>
                                                )}
                                                {isPending && (
                                                    <Text style={styles.cacheSelectorEpisodeTagPending}>排队中</Text>
                                                )}
                                                {isDownloadingToLocal && (
                                                    <Text style={styles.cacheSelectorEpisodeTag}>缓存中</Text>
                                                )}
                                                {!hasDownloaded &&
                                                    !isCached &&
                                                    !isPending &&
                                                    !isDownloadingToLocal && (
                                                        <Text style={styles.cacheSelectorEpisodeTagDisabled}>
                                                            不可用
                                                        </Text>
                                                    )}
                                            </View>
                                            {canCache && isSelected && (
                                                <View style={styles.cacheSelectorCheckmark}>
                                                    <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>

                        <View style={styles.cacheSelectorFooter}>
                            <TouchableOpacity
                                style={styles.cacheSelectorCancelButton}
                                onPress={() => setShowCacheSelector(false)}
                            >
                                <Text style={styles.cacheSelectorCancelButtonText}>取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.cacheSelectorConfirmButton,
                                    selectedEpisodesForCache.size === 0 && styles.cacheSelectorConfirmButtonDisabled,
                                ]}
                                onPress={handleBatchDownload}
                                disabled={selectedEpisodesForCache.size === 0}
                            >
                                <Text style={styles.cacheSelectorConfirmButtonText}>
                                    开始缓存 ({selectedEpisodesForCache.size})
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 换源弹窗 */}
            <Modal
                visible={showSourceSelector}
                transparent
                animationType="slide"
                onRequestClose={() => setShowSourceSelector(false)}
            >
                <View style={styles.sourceSelectorOverlay}>
                    <View style={styles.sourceSelectorContainer}>
                        <View style={styles.sourceSelectorHeader}>
                            <Text style={styles.sourceSelectorTitle}>更换源</Text>
                            <TouchableOpacity
                                onPress={() => setShowSourceSelector(false)}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.sourceSelectorContent}>
                            {/* 换源类型选择 */}
                            <View style={styles.sourceTypeContainer}>
                                <Text style={styles.sourceTypeLabel}>换源类型</Text>
                                <View style={styles.sourceTypeOptions}>
                                    <TouchableOpacity
                                        style={[
                                            styles.sourceTypeOption,
                                            sourceType === 'tv' && styles.sourceTypeOptionSelected
                                        ]}
                                        onPress={() => {
                                            setSourceType('tv');
                                            setSelectedSourceIndex(null);
                                            setSelectedEpisodeInNewSource(0);
                                        }}
                                    >
                                        <Ionicons
                                            name={sourceType === 'tv' ? 'radio-button-on' : 'radio-button-off'}
                                            size={20}
                                            color={sourceType === 'tv' ? '#007AFF' : '#999'}
                                        />
                                        <Text style={[
                                            styles.sourceTypeOptionText,
                                            sourceType === 'tv' && styles.sourceTypeOptionTextSelected
                                        ]}>更换整部剧源</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.sourceTypeOption,
                                            sourceType === 'episode' && styles.sourceTypeOptionSelected
                                        ]}
                                        onPress={() => {
                                            setSourceType('episode');
                                            setSelectedSourceIndex(null);
                                            setSelectedEpisodeInNewSource(0);
                                        }}
                                    >
                                        <Ionicons
                                            name={sourceType === 'episode' ? 'radio-button-on' : 'radio-button-off'}
                                            size={20}
                                            color={sourceType === 'episode' ? '#007AFF' : '#999'}
                                        />
                                        <Text style={[
                                            styles.sourceTypeOptionText,
                                            sourceType === 'episode' && styles.sourceTypeOptionTextSelected
                                        ]}>更换单集源</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* 选择剧集（仅当按集换源时显示） */}
                            {sourceType === 'episode' && details && (
                                <View style={styles.sourceEpisodeSelector}>
                                    <Text style={styles.sourceEpisodeSelectorLabel}>选择要更换的剧集</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        <View style={styles.sourceEpisodeList}>
                                            {details.tv.source.episodes.map((episode, index) => (
                                                <TouchableOpacity
                                                    key={index}
                                                    style={[
                                                        styles.sourceEpisodeItem,
                                                        selectedEpisodeForSource === index && styles.sourceEpisodeItemSelected
                                                    ]}
                                                    onPress={() => {
                                                        setSelectedEpisodeForSource(index);
                                                        setSelectedSourceIndex(null);
                                                        setSelectedEpisodeInNewSource(0);
                                                    }}
                                                >
                                                    <Text style={[
                                                        styles.sourceEpisodeItemText,
                                                        selectedEpisodeForSource === index && styles.sourceEpisodeItemTextSelected
                                                    ]} numberOfLines={1}>
                                                        {episode.name || `第${index + 1}集`}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </ScrollView>
                                </View>
                            )}

                            {/* 搜索框 */}
                            <View style={styles.sourceSearchContainer}>
                                <Text style={styles.sourceSearchLabel}>搜索新源</Text>
                                <View style={styles.sourceSearchInputContainer}>
                                    <TextInput
                                        style={styles.sourceSearchInput}
                                        value={sourceSearchKeyword}
                                        onChangeText={setSourceSearchKeyword}
                                        placeholder="输入搜索关键词..."
                                        placeholderTextColor="#999"
                                        editable={!sourceSearchLoading}
                                    />
                                    <TouchableOpacity
                                        style={[
                                            styles.sourceSearchButton,
                                            (sourceSearchLoading || !sourceSearchKeyword.trim()) && styles.sourceSearchButtonDisabled
                                        ]}
                                        onPress={async () => {
                                            if (!sourceSearchKeyword.trim() || sourceSearchLoading) return;

                                            setSourceSearchLoading(true);
                                            setSourceSearchResults([]);
                                            setSourceSearchErrors([]);
                                            setSelectedSourceIndex(null);

                                            try {
                                                const data = await searchTV({ keyword: sourceSearchKeyword.trim() });
                                                setSourceSearchResults(data.source || []);
                                                setSourceSearchErrors(data.search_error || []);
                                            } catch (err) {
                                                Alert.alert('错误', err instanceof Error ? err.message : '搜索时发生错误');
                                                console.error('Search error:', err);
                                            } finally {
                                                setSourceSearchLoading(false);
                                            }
                                        }}
                                        disabled={sourceSearchLoading || !sourceSearchKeyword.trim()}
                                    >
                                        {sourceSearchLoading ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <Text style={styles.sourceSearchButtonText}>搜索</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* 搜索错误信息 */}
                            {sourceSearchErrors.length > 0 && (
                                <View style={styles.sourceErrorContainer}>
                                    <Text style={styles.sourceErrorTitle}>
                                        搜索过程中部分来源出现错误 ({sourceSearchErrors.length})
                                    </Text>
                                    {sourceSearchErrors.map((searchError, index) => (
                                        <View key={index} style={styles.sourceErrorItem}>
                                            <Text style={styles.sourceErrorText}>
                                                {searchError.source_name}: {searchError.error}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* 搜索结果 */}
                            {sourceSearchResults.length > 0 && (
                                <View style={styles.sourceResultsContainer}>
                                    <Text style={styles.sourceResultsTitle}>
                                        找到 {sourceSearchResults.length} 个结果
                                    </Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sourceResultsScroll}>
                                        {sourceSearchResults.map((source, index) => {
                                            const isSelected = selectedSourceIndex === index;
                                            const isCurrentSource =
                                                details?.tv.source.source.source_key === source.source.source_key &&
                                                details?.tv.source.source.channel_name === source.source.channel_name;

                                            return (
                                                <TouchableOpacity
                                                    key={index}
                                                    style={[
                                                        styles.sourceResultCard,
                                                        isSelected && styles.sourceResultCardSelected,
                                                        isCurrentSource && styles.sourceResultCardCurrent
                                                    ]}
                                                    onPress={() => {
                                                        if (sourceType === 'tv') {
                                                            setSelectedSourceIndex(index);
                                                            setSelectedEpisodeInNewSource(0);
                                                        } else {
                                                            // 按集换源：选择源后需要选择剧集
                                                            setSelectedSourceIndex(index);
                                                            setSelectedEpisodeInNewSource(0);
                                                        }
                                                    }}
                                                >
                                                    {source.cover_url ? (
                                                        <Image
                                                            source={{ uri: source.cover_url }}
                                                            style={styles.sourceResultCover}
                                                            resizeMode="cover"
                                                        />
                                                    ) : (
                                                        <View style={styles.sourceResultCoverPlaceholder}>
                                                            <Text style={styles.sourceResultCoverPlaceholderText}>无封面</Text>
                                                        </View>
                                                    )}
                                                    <View style={styles.sourceResultInfo}>
                                                        <Text style={styles.sourceResultName} numberOfLines={2}>
                                                            {source.name}
                                                        </Text>
                                                        <Text style={styles.sourceResultMeta} numberOfLines={1}>
                                                            来源: {source.source.source_name}
                                                        </Text>
                                                        <Text style={styles.sourceResultMeta} numberOfLines={1}>
                                                            频道: {source.source.channel_name}
                                                        </Text>
                                                        <Text style={styles.sourceResultMeta}>
                                                            剧集数: {source.episodes.length}
                                                        </Text>
                                                        {isCurrentSource && (
                                                            <View style={styles.sourceResultCurrentBadge}>
                                                                <Text style={styles.sourceResultCurrentBadgeText}>当前源</Text>
                                                            </View>
                                                        )}
                                                        {isSelected && !isCurrentSource && (
                                                            <View style={styles.sourceResultSelectedBadge}>
                                                                <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
                                                            </View>
                                                        )}
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            )}

                            {sourceSearchResults.length === 0 && !sourceSearchLoading && sourceSearchKeyword && (
                                <View style={styles.sourceEmptyContainer}>
                                    <Text style={styles.sourceEmptyText}>暂无搜索结果</Text>
                                    <Text style={styles.sourceEmptySubtext}>请尝试其他关键词</Text>
                                </View>
                            )}

                            {/* 选择新源中的剧集（仅当按集换源且已选择源时显示） */}
                            {sourceType === 'episode' && selectedSourceIndex !== null && sourceSearchResults[selectedSourceIndex] && details && (
                                <View style={styles.sourceNewEpisodeSelector}>
                                    <Text style={styles.sourceNewEpisodeSelectorLabel}>
                                        选择新源中的剧集（当前要更换的剧集：{details.tv.source.episodes[selectedEpisodeForSource]?.name || `第${selectedEpisodeForSource + 1}集`}）
                                    </Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        <View style={styles.sourceNewEpisodeList}>
                                            {sourceSearchResults[selectedSourceIndex].episodes.map((episode, index) => (
                                                <TouchableOpacity
                                                    key={index}
                                                    style={[
                                                        styles.sourceNewEpisodeItem,
                                                        selectedEpisodeInNewSource === index && styles.sourceNewEpisodeItemSelected
                                                    ]}
                                                    onPress={() => setSelectedEpisodeInNewSource(index)}
                                                >
                                                    <Text style={[
                                                        styles.sourceNewEpisodeItemText,
                                                        selectedEpisodeInNewSource === index && styles.sourceNewEpisodeItemTextSelected
                                                    ]} numberOfLines={1}>
                                                        {episode.name || `第${index + 1}集`}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </ScrollView>
                                </View>
                            )}
                        </ScrollView>

                        <View style={styles.sourceSelectorFooter}>
                            <TouchableOpacity
                                style={styles.sourceSelectorCancelButton}
                                onPress={() => setShowSourceSelector(false)}
                            >
                                <Text style={styles.sourceSelectorCancelButtonText}>取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.sourceSelectorConfirmButton,
                                    (selectedSourceIndex === null || updatingSource) && styles.sourceSelectorConfirmButtonDisabled
                                ]}
                                onPress={async () => {
                                    if (selectedSourceIndex === null || updatingSource || !details) return;

                                    const selectedSource = sourceSearchResults[selectedSourceIndex];
                                    if (!selectedSource) return;

                                    try {
                                        setUpdatingSource(true);

                                        if (sourceType === 'tv') {
                                            // 整体换源

                                            await updateTVSource({
                                                id: details.tv.id,
                                                source: selectedSource
                                            });

                                            setShowSourceSelector(false);
                                            loadTVDetails();
                                        } else {
                                            // 按集换源
                                            const selectedEpisode = selectedSource.episodes[selectedEpisodeInNewSource];
                                            if (!selectedEpisode) {
                                                Alert.alert('错误', '请选择新源中的剧集');
                                                setUpdatingSource(false);
                                                return;
                                            }

                                            await updateEpisodeSource({
                                                tv_id: details.tv.id,
                                                episode_id: selectedEpisodeForSource,
                                                source: selectedEpisode.source
                                            });

                                            setShowSourceSelector(false);
                                            loadTVDetails();
                                        }
                                    } catch (err) {
                                        Alert.alert('错误', err instanceof Error ? err.message : '更换源失败，请稍后重试');
                                        console.error('Update source error:', err);
                                    } finally {
                                        setUpdatingSource(false);
                                    }
                                }}
                                disabled={
                                    selectedSourceIndex === null ||
                                    updatingSource ||
                                    (sourceType === 'episode' && (
                                        selectedSourceIndex === null ||
                                        sourceSearchResults[selectedSourceIndex]?.episodes.length === 0 ||
                                        selectedEpisodeInNewSource < 0 ||
                                        selectedEpisodeInNewSource >= (sourceSearchResults[selectedSourceIndex]?.episodes.length || 0)
                                    ))
                                }
                            >
                                {updatingSource ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.sourceSelectorConfirmButtonText}>
                                        {sourceType === 'tv' ? '确认更换' : '确认更换剧集源'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 详情弹窗 */}
            <Modal
                visible={showDetailsModal}
                transparent
                animationType="slide"
                onRequestClose={() => {
                    setShowDetailsModal(false);
                    setShowTagDropdown(false);
                }}
            >
                <View style={styles.detailsModalOverlay}>
                    <View style={styles.detailsModalContainer}>
                        <View style={styles.detailsModalHeader}>
                            <Text style={styles.detailsModalTitle}>详情</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowDetailsModal(false);
                                    setShowTagDropdown(false);
                                }}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.detailsModalContent}>
                            {/* 是否追更 */}
                            <View style={styles.detailsSection}>
                                <Text style={styles.detailsSectionTitle}>是否追更</Text>
                                <View style={styles.detailsSectionContent}>
                                    <TouchableOpacity
                                        style={[
                                            styles.trackingSwitch,
                                            details?.tv.track.tracking && styles.trackingSwitchActive,
                                            updatingTracking && styles.trackingSwitchDisabled
                                        ]}
                                        onPress={handleTrackingChange}
                                        disabled={updatingTracking}
                                    >
                                        {updatingTracking ? (
                                            <ActivityIndicator size="small" color="#007AFF" />
                                        ) : (
                                            <Ionicons
                                                name={details?.tv.track.tracking ? "notifications" : "notifications-off"}
                                                size={18}
                                                color={details?.tv.track.tracking ? "#007AFF" : "#999"}
                                            />
                                        )}
                                        <Text style={[
                                            styles.trackingText,
                                            details?.tv.track.tracking && styles.trackingTextActive,
                                            updatingTracking && styles.trackingTextDisabled
                                        ]}>
                                            {details?.tv.track.tracking ? "是" : "否"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* 标签 */}
                            <View style={styles.detailsSection}>
                                <Text style={styles.detailsSectionTitle}>标签</Text>
                                <View style={styles.detailsSectionContent}>
                                    <View style={styles.tagDisplayContainer}>
                                        <TouchableOpacity
                                            style={styles.tagDisplayButton}
                                            onPress={() => setShowTagDropdown(!showTagDropdown)}
                                        >
                                            <Text style={styles.tagDisplayText}>
                                                {details?.info.user_data.tag === 'watching' ? '在看' :
                                                    details?.info.user_data.tag === 'wanted' ? '想看' :
                                                        details?.info.user_data.tag === 'watched' ? '看过' :
                                                            details?.info.user_data.tag === 'on_hold' ? '搁置' :
                                                                '未标记'}
                                            </Text>
                                            <Ionicons
                                                name={showTagDropdown ? "chevron-up" : "chevron-down"}
                                                size={20}
                                                color="#999"
                                            />
                                        </TouchableOpacity>
                                        {showTagDropdown && (
                                            <View style={styles.tagDropdown}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.tagDropdownItem,
                                                        details?.info.user_data.tag === 'watching' && styles.tagDropdownItemSelected
                                                    ]}
                                                    onPress={() => handleTagChange('watching')}
                                                >
                                                    <Text style={[
                                                        styles.tagDropdownItemText,
                                                        details?.info.user_data.tag === 'watching' && styles.tagDropdownItemTextSelected
                                                    ]}>在看</Text>
                                                    {details?.info.user_data.tag === 'watching' && (
                                                        <Ionicons name="checkmark" size={18} color="#007AFF" />
                                                    )}
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.tagDropdownItem,
                                                        details?.info.user_data.tag === 'wanted' && styles.tagDropdownItemSelected
                                                    ]}
                                                    onPress={() => handleTagChange('wanted')}
                                                >
                                                    <Text style={[
                                                        styles.tagDropdownItemText,
                                                        details?.info.user_data.tag === 'wanted' && styles.tagDropdownItemTextSelected
                                                    ]}>想看</Text>
                                                    {details?.info.user_data.tag === 'wanted' && (
                                                        <Ionicons name="checkmark" size={18} color="#007AFF" />
                                                    )}
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.tagDropdownItem,
                                                        details?.info.user_data.tag === 'watched' && styles.tagDropdownItemSelected
                                                    ]}
                                                    onPress={() => handleTagChange('watched')}
                                                >
                                                    <Text style={[
                                                        styles.tagDropdownItemText,
                                                        details?.info.user_data.tag === 'watched' && styles.tagDropdownItemTextSelected
                                                    ]}>看过</Text>
                                                    {details?.info.user_data.tag === 'watched' && (
                                                        <Ionicons name="checkmark" size={18} color="#007AFF" />
                                                    )}
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.tagDropdownItem,
                                                        details?.info.user_data.tag === 'on_hold' && styles.tagDropdownItemSelected
                                                    ]}
                                                    onPress={() => handleTagChange('on_hold')}
                                                >
                                                    <Text style={[
                                                        styles.tagDropdownItemText,
                                                        details?.info.user_data.tag === 'on_hold' && styles.tagDropdownItemTextSelected
                                                    ]}>搁置</Text>
                                                    {details?.info.user_data.tag === 'on_hold' && (
                                                        <Ionicons name="checkmark" size={18} color="#007AFF" />
                                                    )}
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.tagDropdownItem,
                                                        styles.tagDropdownItemLast,
                                                        details?.info.user_data.tag === 'not_tagged' && styles.tagDropdownItemSelected
                                                    ]}
                                                    onPress={() => handleTagChange('not_tagged')}
                                                >
                                                    <Text style={[
                                                        styles.tagDropdownItemText,
                                                        details?.info.user_data.tag === 'not_tagged' && styles.tagDropdownItemTextSelected
                                                    ]}>未标记</Text>
                                                    {details?.info.user_data.tag === 'not_tagged' && (
                                                        <Ionicons name="checkmark" size={18} color="#007AFF" />
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>

                            {/* 源 */}
                            <View style={styles.detailsSection}>
                                <Text style={styles.detailsSectionTitle}>源</Text>
                                <View style={styles.detailsSectionContent}>
                                    <TouchableOpacity
                                        style={styles.sourceButton}
                                        onPress={() => {
                                            if (isOffline) {
                                                Alert.alert('提示', '离线模式下无法更换源');
                                                return;
                                            }
                                            setShowDetailsModal(false);
                                            setShowSourceSelector(true);
                                            // 使用当前TV名称作为搜索关键词
                                            setSourceSearchKeyword(details?.tv.name || '');
                                            setSourceSearchResults([]);
                                            setSourceSearchErrors([]);
                                            setSelectedSourceIndex(null);
                                            setSourceType('tv');
                                            setSelectedEpisodeForSource(0);
                                            setSelectedEpisodeInNewSource(0);
                                        }}
                                        disabled={isOffline}
                                    >
                                        <View style={styles.sourceInfo}>
                                            <Text style={styles.detailsText}>
                                                {details?.tv.source.source.source_name || '-'}
                                            </Text>
                                            <Text style={styles.detailsSubtext}>
                                                频道: {details?.tv.source.source.channel_name || '-'}
                                            </Text>
                                        </View>
                                        {!isOffline && (
                                            <Ionicons name="chevron-forward" size={20} color="#999" />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* 所属播放列表 */}
                            <View style={styles.detailsSection}>
                                <Text style={styles.detailsSectionTitle}>所属播放列表</Text>
                                <View style={styles.detailsSectionContent}>
                                    {seriesList.length === 0 ? (
                                        <Text style={styles.detailsText}>无</Text>
                                    ) : (
                                        seriesList.map((series, index) => (
                                            <TouchableOpacity
                                                key={series.id}
                                                style={[
                                                    styles.seriesItem,
                                                    index === seriesList.length - 1 && styles.seriesItemLast
                                                ]}
                                                onPress={() => {
                                                    if (onSeriesPress) {
                                                        setShowDetailsModal(false);
                                                        onSeriesPress(series.id);
                                                    }
                                                }}
                                            >
                                                <Ionicons name="list" size={18} color="#007AFF" />
                                                <Text style={styles.seriesItemText}>{series.name}</Text>
                                                {onSeriesPress && (
                                                    <Ionicons name="chevron-forward" size={20} color="#999" />
                                                )}
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </View>
                            </View>
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
    menuButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 12,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        color: '#f44336',
        marginBottom: 20,
        textAlign: 'center',
    },
    errorBanner: {
        backgroundColor: '#ffebee',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#f44336',
    },
    errorBannerText: {
        color: '#c62828',
        fontSize: 14,
    },
    playerContainer: {
        backgroundColor: '#000',
        borderRadius: 0,
        overflow: 'hidden',
        marginLeft: -12,
        marginRight: -12,
        marginTop: 0,
        marginBottom: 0,
        aspectRatio: 16 / 9,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playerContainerFullscreen: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 10,
        elevation: 10,
        aspectRatio: undefined,
        marginLeft: 0,
        marginRight: 0,
        marginTop: 0,
        marginBottom: 0,
    },
    noVideoContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    noVideoText: {
        fontSize: 16,
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
    },
    noVideoSubtext: {
        fontSize: 14,
        color: '#ccc',
        textAlign: 'center',
    },
    playInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    playInfoText: {
        fontSize: 14,
        color: '#666',
    },
    episodesSection: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
    },
    episodesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -2,
    },
    episodeCard: {
        backgroundColor: '#fff',
        borderRadius: 6,
        padding: 6,
        width: '23%',
        borderWidth: 1.5,
        borderColor: '#e0e0e0',
        minHeight: 48,
        justifyContent: 'space-between',
    },
    episodeCardSelected: {
        borderColor: '#007AFF',
        backgroundColor: '#e3f2fd',
    },
    episodeName: {
        fontSize: 11,
        fontWeight: '500',
        color: '#333',
        marginBottom: 3,
    },
    episodeNameDisabled: {
        color: '#999',
    },
    episodeStatusContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 4,
    },
    episodeStatus: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    episodeStatusText: {
        fontSize: 10,
        color: '#34C759',
    },
    episodeStatusTextDownloading: {
        fontSize: 10,
        color: '#007AFF',
    },
    episodeStatusTextPending: {
        fontSize: 10,
        color: '#9E9E9E',
    },
    episodeStatusTextFailed: {
        fontSize: 10,
        color: '#FF3B30',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingTop: 60,
        paddingRight: 16,
    },
    menuContainer: {
        backgroundColor: '#fff',
        borderRadius: 8,
        minWidth: 150,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 12,
    },
    menuItemDisabled: {
        opacity: 0.5,
    },
    menuItemText: {
        fontSize: 16,
        color: '#333',
        flex: 1,
    },
    menuItemTextDisabled: {
        color: '#999',
    },
    menuItemHint: {
        fontSize: 12,
        color: '#999',
    },
    cacheSelectorOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    cacheSelectorContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '80%',
        paddingBottom: 20,
    },
    cacheSelectorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    cacheSelectorTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    closeButton: {
        padding: 4,
    },
    cacheSelectorActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#f5f5f5',
    },
    cacheSelectorActionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    selectAllButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#007AFF',
        borderRadius: 6,
    },
    selectAllButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    selectFromCurrentButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#34C759',
        borderRadius: 6,
    },
    selectFromCurrentButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    selectedCount: {
        fontSize: 14,
        color: '#666',
    },
    cacheSelectorEpisodeList: {
        flex: 1,
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    cacheSelectorEpisodesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -3,
    },
    cacheSelectorEpisodeCard: {
        width: '23%',
        backgroundColor: '#fff',
        borderRadius: 6,
        padding: 8,
        marginHorizontal: 3,
        marginBottom: 6,
        borderWidth: 1.5,
        borderColor: '#e0e0e0',
        minHeight: 60,
    },
    cacheSelectorEpisodeCardSelected: {
        borderColor: '#007AFF',
        backgroundColor: '#e3f2fd',
    },
    cacheSelectorEpisodeCardDisabled: {
        backgroundColor: '#f5f5f5',
        opacity: 0.6,
    },
    cacheSelectorEpisodeInfo: {
        flex: 1,
    },
    cacheSelectorEpisodeName: {
        fontSize: 11,
        fontWeight: '500',
        color: '#333',
        marginBottom: 3,
    },
    cacheSelectorEpisodeNameDisabled: {
        color: '#999',
    },
    cacheSelectorEpisodeTag: {
        fontSize: 10,
        color: '#007AFF',
        marginTop: 2,
    },
    cacheSelectorEpisodeTagPending: {
        fontSize: 10,
        color: '#9E9E9E',
        marginTop: 2,
    },
    cacheSelectorEpisodeTagDisabled: {
        fontSize: 10,
        color: '#999',
        marginTop: 2,
    },
    cacheSelectorCheckmark: {
        position: 'absolute',
        top: 4,
        right: 4,
    },
    cacheSelectorFooter: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        gap: 12,
    },
    cacheSelectorCancelButton: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        alignItems: 'center',
    },
    cacheSelectorCancelButtonText: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
    cacheSelectorConfirmButton: {
        flex: 2,
        paddingVertical: 12,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        alignItems: 'center',
    },
    cacheSelectorConfirmButtonDisabled: {
        backgroundColor: '#ccc',
    },
    cacheSelectorConfirmButtonText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
    detailsModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    detailsModalContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '80%',
        paddingBottom: 20,
    },
    detailsModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    detailsModalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    detailsModalContent: {
        flex: 1,
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    detailsSection: {
        marginBottom: 24,
    },
    detailsSectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
    },
    detailsSectionContent: {
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        padding: 12,
    },
    detailsText: {
        fontSize: 16,
        color: '#333',
    },
    detailsSubtext: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    trackingSwitch: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 4,
    },
    trackingSwitchActive: {
        // 可以添加激活状态的样式
    },
    trackingSwitchDisabled: {
        opacity: 0.5,
    },
    trackingText: {
        fontSize: 16,
        color: '#999',
    },
    trackingTextActive: {
        color: '#007AFF',
    },
    trackingTextDisabled: {
        opacity: 0.5,
    },
    tagDisplayContainer: {
        position: 'relative',
    },
    tagDisplayButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    tagDisplayText: {
        fontSize: 16,
        color: '#333',
        flex: 1,
    },
    tagDropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: 4,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 1000,
    },
    tagDropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    tagDropdownItemSelected: {
        backgroundColor: '#e3f2fd',
    },
    tagDropdownItemText: {
        fontSize: 16,
        color: '#333',
    },
    tagDropdownItemTextSelected: {
        color: '#007AFF',
        fontWeight: '500',
    },
    tagDropdownItemLast: {
        borderBottomWidth: 0,
    },
    seriesItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    seriesItemText: {
        fontSize: 16,
        color: '#333',
        flex: 1,
    },
    seriesItemLast: {
        borderBottomWidth: 0,
    },
    sourceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sourceInfo: {
        flex: 1,
    },
    sourceSelectorOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    sourceSelectorContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '80%',
        paddingBottom: 20,
    },
    sourceSelectorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    sourceSelectorTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    sourceSelectorContent: {
        flex: 1,
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    sourceSearchContainer: {
        marginBottom: 16,
    },
    sourceSearchLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
    },
    sourceSearchInputContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    sourceSearchInput: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 8,
        fontSize: 16,
        color: '#333',
        backgroundColor: '#fff',
    },
    sourceSearchButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 80,
    },
    sourceSearchButtonDisabled: {
        backgroundColor: '#ccc',
    },
    sourceSearchButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    sourceErrorContainer: {
        backgroundColor: '#FFF3CD',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FFE69C',
    },
    sourceErrorTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#856404',
        marginBottom: 8,
    },
    sourceErrorItem: {
        backgroundColor: '#FFF8DC',
        borderRadius: 6,
        padding: 8,
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#FFE69C',
    },
    sourceErrorText: {
        fontSize: 12,
        color: '#856404',
    },
    sourceResultsContainer: {
        marginBottom: 16,
    },
    sourceResultsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
    },
    sourceResultsScroll: {
        marginHorizontal: -20,
        paddingHorizontal: 20,
    },
    sourceResultCard: {
        width: 280,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#e0e0e0',
        marginRight: 12,
        overflow: 'hidden',
    },
    sourceResultCardSelected: {
        borderColor: '#007AFF',
        backgroundColor: '#e3f2fd',
    },
    sourceResultCardCurrent: {
        borderColor: '#34C759',
        backgroundColor: '#e8f5e9',
    },
    sourceResultCover: {
        width: '100%',
        height: 160,
        backgroundColor: '#e0e0e0',
    },
    sourceResultCoverPlaceholder: {
        width: '100%',
        height: 160,
        backgroundColor: '#e0e0e0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sourceResultCoverPlaceholderText: {
        fontSize: 12,
        color: '#999',
    },
    sourceResultInfo: {
        padding: 12,
    },
    sourceResultName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333',
        marginBottom: 6,
        minHeight: 36,
    },
    sourceResultMeta: {
        fontSize: 12,
        color: '#666',
        marginBottom: 2,
    },
    sourceResultCurrentBadge: {
        marginTop: 8,
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: '#34C759',
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    sourceResultCurrentBadgeText: {
        fontSize: 10,
        color: '#fff',
        fontWeight: '500',
    },
    sourceResultSelectedBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    sourceEmptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    sourceEmptyText: {
        fontSize: 16,
        color: '#666',
        marginBottom: 8,
    },
    sourceEmptySubtext: {
        fontSize: 14,
        color: '#999',
    },
    sourceSelectorFooter: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        gap: 12,
    },
    sourceSelectorCancelButton: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        alignItems: 'center',
    },
    sourceSelectorCancelButtonText: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
    sourceSelectorConfirmButton: {
        flex: 2,
        paddingVertical: 12,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sourceSelectorConfirmButtonDisabled: {
        backgroundColor: '#ccc',
    },
    sourceSelectorConfirmButtonText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
    sourceTypeContainer: {
        marginBottom: 16,
    },
    sourceTypeLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
    },
    sourceTypeOptions: {
        flexDirection: 'row',
        gap: 16,
    },
    sourceTypeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        backgroundColor: '#fff',
    },
    sourceTypeOptionSelected: {
        borderColor: '#007AFF',
        backgroundColor: '#e3f2fd',
    },
    sourceTypeOptionText: {
        fontSize: 14,
        color: '#666',
    },
    sourceTypeOptionTextSelected: {
        color: '#007AFF',
        fontWeight: '500',
    },
    sourceEpisodeSelector: {
        marginBottom: 16,
    },
    sourceEpisodeSelectorLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
    },
    sourceEpisodeList: {
        flexDirection: 'row',
        gap: 8,
    },
    sourceEpisodeItem: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#f5f5f5',
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    sourceEpisodeItemSelected: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    sourceEpisodeItemText: {
        fontSize: 14,
        color: '#666',
    },
    sourceEpisodeItemTextSelected: {
        color: '#fff',
        fontWeight: '500',
    },
    sourceNewEpisodeSelector: {
        marginTop: 16,
        marginBottom: 16,
        padding: 12,
        backgroundColor: '#e3f2fd',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#90caf9',
    },
    sourceNewEpisodeSelectorLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1976d2',
        marginBottom: 12,
    },
    sourceNewEpisodeList: {
        flexDirection: 'row',
        gap: 8,
    },
    sourceNewEpisodeItem: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#90caf9',
    },
    sourceNewEpisodeItemSelected: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    sourceNewEpisodeItemText: {
        fontSize: 14,
        color: '#1976d2',
    },
    sourceNewEpisodeItemTextSelected: {
        color: '#fff',
        fontWeight: '500',
    },
});
