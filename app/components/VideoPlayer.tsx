import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, PanResponder, Animated } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';

type PlaybackState = {
    currentTime: number;
    duration: number;
    isPlaying: boolean;
};

interface VideoPlayerProps {
    videoUrl: string;
    headers?: Record<string, string>;
    resumeTime?: number;
    autoPlay?: boolean;
    onPlaybackState?: (state: PlaybackState) => void;
    onPlayToEnd?: () => void;
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;
    localUri?: string | null; // 本地缓存的视频URI
}

export default function VideoPlayer({
    videoUrl,
    headers,
    resumeTime = 0,
    autoPlay = false,
    onPlaybackState,
    onPlayToEnd,
    isFullscreen = false,
    onToggleFullscreen,
    localUri = null,
}: VideoPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackTime, setPlaybackTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [progressBarWidth, setProgressBarWidth] = useState(0);
    const [showControls, setShowControls] = useState(true);
    const [seekOffset, setSeekOffset] = useState(0);
    const [showSeekIndicator, setShowSeekIndicator] = useState(false);
    const [playerWidth, setPlayerWidth] = useState(0);
    const readyRef = useRef(false);
    const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastClickTimeRef = useRef<number>(0);
    const autoHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isDraggingRef = useRef(false);
    const seekIndicatorOpacity = useRef(new Animated.Value(0)).current;
    const AUTO_HIDE_DELAY_MS = 10000;
    const SEEK_SECONDS_PER_FULL_SWIPE = 100; // 拖动整个播放器宽度对应的秒数

    // 构建视频源，优先使用本地缓存，否则使用网络URL
    const videoSource = React.useMemo(() => {
        // 如果有本地缓存，使用本地URI
        if (localUri) {
            return localUri;
        }

        // 否则使用网络URL，包含headers
        if (headers) {
            return {
                uri: videoUrl,
                headers: headers
            };
        }
        return videoUrl;
    }, [videoUrl, headers, localUri]);

    const player = useVideoPlayer(videoSource, (player) => {
        player.loop = false;
        player.muted = false;
        player.timeUpdateEventInterval = 1;
    });

    useEffect(() => {
        readyRef.current = false;
    }, [videoUrl, resumeTime, localUri]);

    useEffect(() => {
        const updateVideoSource = async () => {
            if (player && videoSource) {
                try {
                    await player.replaceAsync(videoSource);
                    if (autoPlay) {
                        await player.play();
                        setIsPlaying(true);
                    }
                } catch (err) {
                    console.error('Error replacing video source:', err);
                }
            }
        };
        updateVideoSource();
    }, [player, videoSource, autoPlay]);

    useEffect(() => {
        if (!player || readyRef.current) return;
        const checkReady = setInterval(() => {
            if (player.status === 'readyToPlay') {
                player.currentTime = resumeTime;
                readyRef.current = true;
                clearInterval(checkReady);
            }
        }, 100);
        return () => clearInterval(checkReady);
    }, [player, resumeTime]);

    useEffect(() => {
        if (!player) return;
        const endSubscription = player.addListener('playToEnd', () => {
            if (!readyRef.current) {
                return;
            }
            onPlayToEnd?.();
        });
        const playingChangeSubscription = player.addListener('playingChange', (payload: { isPlaying: boolean }) => {
            if (!readyRef.current) {
                return;
            }
            setIsPlaying(payload.isPlaying);
            console.log('playingChange', player.currentTime, player.duration, payload.isPlaying);
            onPlaybackState?.({
                currentTime: player.currentTime || 0,
                duration: player.duration || 0,
                isPlaying: payload.isPlaying,
            });
        });

        // 订阅 statusChange 事件，监听播放器状态变化
        const statusChangeSubscription = player.addListener('statusChange', (status) => {
            if (!readyRef.current) {
                return;
            }
            try {
                const current = player.currentTime || 0;
                const total = player.duration || 0;
                const playing = player.playing;
                setPlaybackTime(current);
                setDuration(total);
                setIsPlaying(playing);
                onPlaybackState?.({
                    currentTime: current,
                    duration: total,
                    isPlaying: playing,
                });
            } catch (err) {
                console.error('Error syncing playback state (statusChange):', err);
            }
        });

        // 订阅 timeUpdate 事件，在播放时定期触发
        const timeUpdateSubscription = player.addListener('timeUpdate', (payload: { currentTime: number; currentLiveTimestamp: number | null }) => {
            if (!readyRef.current) {
                return;
            }
            try {
                const current = payload.currentTime || 0;
                const total = player.duration || 0;
                const playing = player.playing;
                setPlaybackTime(current);
                setDuration(total);
                setIsPlaying(playing);
                onPlaybackState?.({
                    currentTime: current,
                    duration: total,
                    isPlaying: playing,
                });
            } catch (err) {
                console.error('Error syncing playback state (timeUpdate):', err);
            }
        });

        return () => {
            endSubscription.remove();
            playingChangeSubscription.remove();
            statusChangeSubscription.remove();
            timeUpdateSubscription.remove();
        };
    }, [player, onPlayToEnd, onPlaybackState]);

    const clearAutoHide = useCallback(() => {
        if (autoHideTimeoutRef.current) {
            clearTimeout(autoHideTimeoutRef.current);
            autoHideTimeoutRef.current = null;
        }
    }, []);

    const scheduleAutoHide = useCallback(() => {
        clearAutoHide();
        autoHideTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
            autoHideTimeoutRef.current = null;
        }, AUTO_HIDE_DELAY_MS);
    }, [clearAutoHide]);

    const showControlsWithAutoHide = useCallback(() => {
        setShowControls(true);
        scheduleAutoHide();
    }, [scheduleAutoHide]);

    const togglePlay = useCallback(() => {
        if (!player) return;
        try {
            if (player.playing) {
                player.pause();
            } else {
                player.play();
            }
            showControlsWithAutoHide();
        } catch (err) {
            console.error('Error toggling play:', err);
        }
    }, [player, showControlsWithAutoHide]);

    const handleVideoPress = useCallback(() => {
        // 如果正在拖动，不处理点击事件
        if (isDraggingRef.current) {
            return;
        }

        const now = Date.now();
        const timeSinceLastClick = now - lastClickTimeRef.current;

        // 清除之前的单击定时器
        if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
        }

        // 如果距离上次点击小于300ms，认为是双击
        if (timeSinceLastClick < 300) {
            togglePlay();
            lastClickTimeRef.current = 0;
        } else {
            // 否则，延迟执行单击操作（显示/隐藏UI）
            lastClickTimeRef.current = now;
            clickTimeoutRef.current = setTimeout(() => {
                setShowControls((prev) => {
                    const next = !prev;
                    if (next) {
                        scheduleAutoHide();
                    } else {
                        clearAutoHide();
                    }
                    return next;
                });
                clickTimeoutRef.current = null;
                lastClickTimeRef.current = 0;
            }, 300);
        }
    }, [togglePlay, scheduleAutoHide, clearAutoHide]);

    // 拖动手势处理
    const panResponderRef = useRef<any>(null);

    useEffect(() => {
        panResponderRef.current = PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // 只有水平滑动距离大于10像素才激活拖动
                return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
            },
            onPanResponderGrant: () => {
                isDraggingRef.current = true;
                // 清除单击定时器，防止拖动时触发点击
                if (clickTimeoutRef.current) {
                    clearTimeout(clickTimeoutRef.current);
                    clickTimeoutRef.current = null;
                }
                setShowSeekIndicator(true);
                Animated.timing(seekIndicatorOpacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }).start();
            },
            onPanResponderMove: (_, gestureState) => {
                if (playerWidth <= 0) return;
                // 拖动整个播放器宽度对应 SEEK_SECONDS_PER_FULL_SWIPE 秒
                // 保留小数精度，避免小的拖动距离被舍入为0
                const offset = (gestureState.dx / playerWidth) * SEEK_SECONDS_PER_FULL_SWIPE;
                setSeekOffset(offset);
            },
            onPanResponderRelease: (_, gestureState) => {
                if (!player || playerWidth <= 0) {
                    isDraggingRef.current = false;
                    setShowSeekIndicator(false);
                    setSeekOffset(0);
                    return;
                }

                // 计算新的播放时间，保留小数精度以便更精确的跳转
                const offset = (gestureState.dx / playerWidth) * SEEK_SECONDS_PER_FULL_SWIPE;
                const currentTime = player.currentTime || 0;
                const newTime = Math.max(0, Math.min(duration, currentTime + offset));

                try {
                    player.currentTime = newTime;
                    setPlaybackTime(newTime);
                } catch (err) {
                    console.error('Error seeking video:', err);
                }

                setShowSeekIndicator(false);
                setSeekOffset(0);

                // 延迟重置拖动状态，避免触发点击
                setTimeout(() => {
                    isDraggingRef.current = false;
                }, 100);
            },
            onPanResponderTerminate: () => {
                isDraggingRef.current = false;
                setShowSeekIndicator(false);
                setSeekOffset(0);
            },
        });
    }, [playerWidth, player, duration, seekIndicatorOpacity]);

    // 清理定时器
    useEffect(() => {
        return () => {
            if (clickTimeoutRef.current) {
                clearTimeout(clickTimeoutRef.current);
            }
            clearAutoHide();
        };
    }, [clearAutoHide]);

    const handleSeek = useCallback(
        (event: { nativeEvent: { locationX: number } }) => {
            if (!player || duration <= 0 || progressBarWidth <= 0) return;
            showControlsWithAutoHide();
            const ratio = Math.min(1, Math.max(0, event.nativeEvent.locationX / progressBarWidth));
            const newTime = ratio * duration;
            try {
                player.currentTime = newTime;
                setPlaybackTime(newTime);
            } catch (err) {
                console.error('Error seeking video:', err);
            }
        },
        [player, duration, progressBarWidth, showControlsWithAutoHide],
    );

    const formatTime = (seconds: number | undefined | null): string => {
        if (seconds === undefined || seconds === null || isNaN(seconds) || seconds < 0) {
            return '0:00';
        }
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const progressPercent = duration > 0 ? Math.min(1, playbackTime / duration) * 100 : 0;

    useEffect(() => {
        if (showControls) {
            scheduleAutoHide();
        } else {
            clearAutoHide();
        }
        return clearAutoHide;
    }, [showControls, scheduleAutoHide, clearAutoHide]);

    const handleToggleFullscreen = useCallback(() => {
        showControlsWithAutoHide();
        onToggleFullscreen?.();
    }, [showControlsWithAutoHide, onToggleFullscreen]);

    return (
        <View style={styles.container}>
            <VideoView
                player={player}
                style={styles.videoPlayer}
                contentFit="contain"
                nativeControls={false}
                onLayout={(event) => {
                    const width = event.nativeEvent.layout.width;
                    if (width > 0 && width !== playerWidth) {
                        setPlayerWidth(width);
                    }
                }}
            />
            <View
                style={styles.touchOverlay}
                {...(panResponderRef.current?.panHandlers || {})}
                onLayout={(event) => {
                    const width = event.nativeEvent.layout.width;
                    if (width > 0 && width !== playerWidth) {
                        setPlayerWidth(width);
                    }
                }}
            >
                <Pressable style={styles.touchArea} onPress={handleVideoPress}>
                    <View style={{ flex: 1 }} />
                </Pressable>
            </View>
            {showSeekIndicator && (() => {
                const targetTime = Math.max(0, Math.min(duration, playbackTime + seekOffset));
                return (
                    <Animated.View
                        style={[
                            styles.seekIndicator,
                            { opacity: seekIndicatorOpacity },
                        ]}
                    >
                        <Ionicons
                            name={seekOffset >= 0 ? 'play-forward' : 'play-back'}
                            size={40}
                            color="#fff"
                        />
                        <Text style={styles.seekText}>
                            {seekOffset >= 0 ? '+' : ''}{Math.round(seekOffset)}秒
                        </Text>
                        <Text style={styles.seekTargetText}>
                            {formatTime(targetTime)}
                        </Text>
                    </Animated.View>
                );
            })()}
            {showControls && (
                <View style={styles.controlsOverlay} pointerEvents="box-none">
                    <View style={styles.controlsRow}>
                        <TouchableOpacity style={styles.controlButton} onPress={togglePlay}>
                            <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#fff" />
                        </TouchableOpacity>
                        <View
                            style={styles.progressBar}
                            onLayout={(event) => setProgressBarWidth(event.nativeEvent.layout.width)}
                            onStartShouldSetResponder={() => true}
                            onResponderGrant={handleSeek}
                            onResponderTerminationRequest={() => false}
                        >
                            <View style={styles.progressTrack} />
                            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                            <View style={[styles.progressThumb, { left: `${progressPercent}%` }]} />
                        </View>
                        <Text style={styles.timeText}>
                            {formatTime(playbackTime)} / {formatTime(duration)}
                        </Text>
                        {onToggleFullscreen ? (
                            <TouchableOpacity style={styles.controlButton} onPress={handleToggleFullscreen}>
                                <Ionicons name={isFullscreen ? 'contract' : 'expand'} size={18} color="#fff" />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    videoPlayer: {
        width: '100%',
        height: '100%',
    },
    touchOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
    },
    touchArea: {
        flex: 1,
    },
    seekIndicator: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -60 }, { translateY: -60 }],
        width: 120,
        height: 120,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 3,
    },
    seekText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 8,
    },
    seekTargetText: {
        color: '#fff',
        fontSize: 14,
        marginTop: 4,
        opacity: 0.8,
    },
    controlsOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        zIndex: 2,
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    controlButton: {
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 0,
        backgroundColor: 'transparent',
    },
    timeText: {
        color: '#fff',
        fontSize: 12,
    },
    progressBar: {
        flex: 1,
        height: 20,
        justifyContent: 'center',
    },
    progressTrack: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 2,
    },
    progressFill: {
        position: 'absolute',
        left: 0,
        height: 4,
        backgroundColor: '#fff',
        borderRadius: 2,
    },
    progressThumb: {
        position: 'absolute',
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.3)',
        transform: [{ translateX: -6 }],
    },
});
