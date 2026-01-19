import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import VideoPlayer from '../components/VideoPlayer';
import { getTVDetails, setWatchProgress } from '../api/client-proxy';
import type { GetTVDetailsResponse } from '../api/types';

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
    const [playbackState, setPlaybackState] = useState({
        currentTime: 0,
        duration: 0,
        isPlaying: false,
    });
    const lastUpdateTimeRef = useRef<number>(-1);
    const lastKnownTimeRef = useRef<number>(-1);
    const lastKnownEpisodeRef = useRef<number>(-1);

    // 获取当前视频 URL
    const currentVideoUrl = details?.episodes[selectedEpisode] || null;
    const hasVideo = currentVideoUrl !== null;

    // 监听 Android 后退按钮
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            onBack();
            return true; // 阻止默认行为
        });

        return () => backHandler.remove();
    }, [onBack]);

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

    const handleEpisodeSelect = useCallback((episodeIndex: number) => {
        if (!details) return;

        // 更新观看进度为当前集数的第0秒
        updateWatchProgress(episodeIndex, 0);
        setSelectedEpisode(episodeIndex);
        setResumeTime(0);
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
            {/* 标题栏 */}
            <View style={styles.titleBar}>
                <Text style={styles.titleBarText} numberOfLines={1}>
                    {details.tv.name || ''}
                </Text>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {error && (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorBannerText}>{error}</Text>
                    </View>
                )}

                {/* 视频播放器 */}
                <View style={styles.playerContainer}>
                    {hasVideo ? (
                        <VideoPlayer
                            videoUrl={currentVideoUrl}
                            resumeTime={resumeTime}
                            onPlaybackState={setPlaybackState}
                            onPlayToEnd={() => handleEpisodeSelect(selectedEpisode + 1)}
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
                                    onPress={() => handleEpisodeSelect(index)}
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleBarText: {
        fontSize: 18,
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
        marginBottom: 12,
        marginLeft: -12,
        marginRight: -12,
        marginTop: -12,
        aspectRatio: 16 / 9,
        justifyContent: 'center',
        alignItems: 'center',
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
});
