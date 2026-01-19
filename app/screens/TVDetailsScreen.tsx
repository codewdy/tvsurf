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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { Ionicons } from '@expo/vector-icons';
import VideoPlayer from '../components/VideoPlayer';
import { getTVDetails, setWatchProgress, setTVTag } from '../api/client-proxy';
import type { GetTVDetailsResponse, Tag } from '../api/types';

interface TVDetailsScreenProps {
    tv: {
        id: number;
        name: string;
        cover_url: string;
    };
    onBack: () => void;
}

export default function TVDetailsScreen({ tv, onBack }: TVDetailsScreenProps) {
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
    const lastUpdateTimeRef = useRef<number>(-1);
    const lastKnownTimeRef = useRef<number>(-1);
    const lastKnownEpisodeRef = useRef<number>(-1);
    const autoFullscreenEnabledRef = useRef(false);
    const autoFullscreenActiveRef = useRef(false);

    // 获取当前视频 URL
    const currentVideoUrl = details?.episodes[selectedEpisode] || null;
    const hasVideo = currentVideoUrl !== null;

    // 监听 Android 后退按钮
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (isFullscreen) {
                autoFullscreenEnabledRef.current = false;
                autoFullscreenActiveRef.current = false;
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
    }, [tv.id]);

    // 初始化选中的剧集
    useEffect(() => {
        if (details) {
            const savedEpisode = details.info.user_data.watch_progress.episode_id;
            setSelectedEpisode(savedEpisode);
            setResumeTime(details.info.user_data.watch_progress.time);
            setAutoPlay(false);
        }
    }, [details]);

    const loadTVDetails = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getTVDetails({ id: tv.id });
            setDetails(data);
        } catch (err) {
            console.error('Error loading TV details:', err);
            setError(err instanceof Error ? err.message : '加载失败');
        } finally {
            setLoading(false);
        }
    };

    const updateWatchProgress = useCallback(async (episodeId: number, time: number) => {
        if (!details) return;

        try {
            await setWatchProgress({
                tv_id: details.tv.id,
                episode_id: episodeId,
                time: time,
            });
        } catch (err) {
            console.error('Update watch progress error:', err);
        }
    }, [details]);

    const handleEpisodeSelect = useCallback((episodeIndex: number, autoPlay: boolean) => {
        if (!details) return;

        // 更新观看进度为当前集数的第0秒
        updateWatchProgress(episodeIndex, 0);
        setSelectedEpisode(episodeIndex);
        setResumeTime(0);
        setAutoPlay(autoPlay);
        autoFullscreenEnabledRef.current = true;
        autoFullscreenActiveRef.current = false;
    }, [details, updateWatchProgress, setResumeTime, setSelectedEpisode]);

    // 监听播放进度并定期更新
    useEffect(() => {
        if (!details) return;

        if (lastKnownEpisodeRef.current != selectedEpisode || Math.abs(lastUpdateTimeRef.current - playbackState.currentTime) > 5) {
            updateWatchProgress(selectedEpisode, playbackState.currentTime);
            lastUpdateTimeRef.current = playbackState.currentTime;
        }
        lastKnownEpisodeRef.current = selectedEpisode;
        lastKnownTimeRef.current = playbackState.currentTime;
    }, [details, selectedEpisode, playbackState.currentTime, updateWatchProgress]);

    // 组件卸载时更新播放进度
    useEffect(() => {
        return () => {
            if (details) {
                try {
                    updateWatchProgress(lastKnownEpisodeRef.current, lastKnownTimeRef.current);
                } catch (err) {
                    console.error('Error updating progress on unmount:', err);
                }
            }
        };
    }, [details, updateWatchProgress]);

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
        if (playbackState.isPlaying) {
            if (autoFullscreenEnabledRef.current && !isFullscreen) {
                setIsFullscreen(true);
                autoFullscreenActiveRef.current = true;
            }
            return;
        }
        if (autoFullscreenActiveRef.current && isFullscreen) {
            setIsFullscreen(false);
            autoFullscreenActiveRef.current = false;
        }
    }, [playbackState.isPlaying, isFullscreen]);

    useEffect(() => {
        return () => {
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => null);
            if (Platform.OS === 'android') {
                NavigationBar.setVisibilityAsync('visible').catch(() => null);
            }
        };
    }, []);

    const handleToggleFullscreen = useCallback(() => {
        autoFullscreenEnabledRef.current = false;
        autoFullscreenActiveRef.current = false;
        setIsFullscreen((prev) => !prev);
    }, []);

    const handleTagChange = useCallback(async (tag: Tag) => {
        if (!details) return;

        try {
            await setTVTag({ tv_id: details.tv.id, tag });
            // 重新加载详情以更新标签
            await loadTVDetails();
            setShowTagSelector(false);
            setShowMenu(false);
        } catch (err) {
            console.error('Error setting tag:', err);
        }
    }, [details]);

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
                    <Text style={styles.titleBarText} numberOfLines={1}>
                        {details.tv.name || ''}
                    </Text>
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
                        resumeTime={resumeTime}
                        autoPlay={autoPlay}
                        onPlaybackState={setPlaybackState}
                        onPlayToEnd={() => handleEpisodeSelect(selectedEpisode + 1, true)}
                        isFullscreen={isFullscreen}
                        onToggleFullscreen={handleToggleFullscreen}
                    />
                ) : (
                    <View style={styles.noVideoContainer}>
                        {selectedEpisode >= details.episodes.length ? (
                            <Text style={styles.noVideoText}>已全部播放完毕</Text>
                        ) : storageEp?.status === 'running' ? (
                            <Text style={styles.noVideoText}>该集正在下载中...</Text>
                        ) : storageEp?.status === 'failed' ? (
                            <Text style={styles.noVideoText}>该集下载失败</Text>
                        ) : (
                            <Text style={styles.noVideoText}>该集尚未下载</Text>
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

                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.episodeCard,
                                            isSelected && styles.episodeCardSelected,
                                            { marginHorizontal: 2, marginBottom: 6 },
                                        ]}
                                        onPress={() => handleEpisodeSelect(index, false)}
                                        disabled={!hasDownloaded && !isDownloading}
                                    >
                                        <Text
                                            style={[
                                                styles.episodeName,
                                                (!hasDownloaded && !isDownloading) && styles.episodeNameDisabled,
                                            ]}
                                            numberOfLines={2}
                                        >
                                            {episode.name || ''}
                                        </Text>
                                        <View style={styles.episodeStatus}>
                                            {hasDownloaded ? (
                                                <Text style={styles.episodeStatusText}>✓</Text>
                                            ) : isDownloading ? (
                                                <Text style={styles.episodeStatusTextDownloading}>下载中</Text>
                                            ) : isFailed ? (
                                                <Text style={styles.episodeStatusTextFailed}>失败</Text>
                                            ) : (
                                                <Text style={styles.episodeStatusText}>-</Text>
                                            )}
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
                                setShowTagSelector(true);
                            }}
                        >
                            <Ionicons name="pricetag-outline" size={20} color="#333" />
                            <Text style={styles.menuItemText}>修改标签</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* 标签选择器弹窗 */}
            <Modal
                visible={showTagSelector}
                transparent
                animationType="fade"
                onRequestClose={() => setShowTagSelector(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowTagSelector(false)}
                >
                    <View style={styles.tagSelectorContainer}>
                        <Text style={styles.tagSelectorTitle}>选择标签</Text>
                        <View style={styles.tagList}>
                            <TouchableOpacity
                                style={[
                                    styles.tagItem,
                                    details?.info.user_data.tag === 'watching' && styles.tagItemSelected
                                ]}
                                onPress={() => handleTagChange('watching')}
                            >
                                <Text style={styles.tagItemText}>在看</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.tagItem,
                                    details?.info.user_data.tag === 'wanted' && styles.tagItemSelected
                                ]}
                                onPress={() => handleTagChange('wanted')}
                            >
                                <Text style={styles.tagItemText}>想看</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.tagItem,
                                    details?.info.user_data.tag === 'watched' && styles.tagItemSelected
                                ]}
                                onPress={() => handleTagChange('watched')}
                            >
                                <Text style={styles.tagItemText}>看过</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.tagItem,
                                    details?.info.user_data.tag === 'on_hold' && styles.tagItemSelected
                                ]}
                                onPress={() => handleTagChange('on_hold')}
                            >
                                <Text style={styles.tagItemText}>搁置</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.tagItem,
                                    details?.info.user_data.tag === 'not_tagged' && styles.tagItemSelected
                                ]}
                                onPress={() => handleTagChange('not_tagged')}
                            >
                                <Text style={styles.tagItemText}>未标记</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
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
        justifyContent: 'center',
        position: 'relative',
    },
    titleBarText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
        flex: 1,
    },
    menuButton: {
        position: 'absolute',
        right: 16,
        padding: 4,
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
    menuItemText: {
        fontSize: 16,
        color: '#333',
    },
    tagSelectorContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginHorizontal: 40,
        marginTop: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    tagSelectorTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 16,
        textAlign: 'center',
    },
    tagList: {
        gap: 10,
    },
    tagItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#f5f5f5',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    tagItemSelected: {
        backgroundColor: '#e3f2fd',
        borderColor: '#007AFF',
    },
    tagItemText: {
        fontSize: 16,
        color: '#333',
        textAlign: 'center',
    },
});
