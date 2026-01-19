import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';

type PlaybackState = {
    currentTime: number;
    duration: number;
    isPlaying: boolean;
};

interface VideoPlayerProps {
    videoUrl: string;
    resumeTime?: number;
    onPlaybackState?: (state: PlaybackState) => void;
    onPlayToEnd?: () => void;
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;
}

export default function VideoPlayer({
    videoUrl,
    resumeTime = 0,
    onPlaybackState,
    onPlayToEnd,
    isFullscreen = false,
    onToggleFullscreen,
}: VideoPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackTime, setPlaybackTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [progressBarWidth, setProgressBarWidth] = useState(0);
    const [showControls, setShowControls] = useState(true);
    const resumeAppliedRef = useRef(false);
    const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastClickTimeRef = useRef<number>(0);

    const player = useVideoPlayer(videoUrl, (player) => {
        player.loop = false;
        player.muted = false;
    });

    useEffect(() => {
        resumeAppliedRef.current = false;
    }, [videoUrl, resumeTime]);

    useEffect(() => {
        const updateVideoSource = async () => {
            if (player && videoUrl) {
                try {
                    await player.replaceAsync(videoUrl);
                } catch (err) {
                    console.error('Error replacing video source:', err);
                }
            }
        };
        updateVideoSource();
    }, [player, videoUrl]);

    useEffect(() => {
        if (!player || resumeAppliedRef.current || resumeTime <= 0) return;
        const checkReady = setInterval(() => {
            if (player.status === 'readyToPlay') {
                player.currentTime = resumeTime;
                resumeAppliedRef.current = true;
                clearInterval(checkReady);
            }
        }, 100);
        return () => clearInterval(checkReady);
    }, [player, resumeTime]);

    useEffect(() => {
        if (!player) return;
        const endSubscription = player.addListener('playToEnd', () => {
            onPlayToEnd?.();
        });
        const playingChangeSubscription = player.addListener('playingChange', (payload: { isPlaying: boolean }) => {
            setIsPlaying(payload.isPlaying);
            onPlaybackState?.({
                currentTime: player.currentTime || 0,
                duration: player.duration || 0,
                isPlaying: payload.isPlaying,
            });
        });
        return () => {
            endSubscription.remove();
            playingChangeSubscription.remove();
        };
    }, [player, onPlayToEnd, onPlaybackState]);

    useEffect(() => {
        if (!player) return;
        const syncInterval = setInterval(() => {
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
                console.error('Error syncing playback state:', err);
            }
        }, 500);
        return () => clearInterval(syncInterval);
    }, [player, onPlaybackState]);

    const togglePlay = useCallback(() => {
        if (!player) return;
        try {
            if (player.playing) {
                player.pause();
            } else {
                player.play();
            }
        } catch (err) {
            console.error('Error toggling play:', err);
        }
    }, [player]);

    const handleVideoPress = useCallback(() => {
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
                setShowControls((prev) => !prev);
                clickTimeoutRef.current = null;
                lastClickTimeRef.current = 0;
            }, 300);
        }
    }, [togglePlay]);

    // 清理定时器
    useEffect(() => {
        return () => {
            if (clickTimeoutRef.current) {
                clearTimeout(clickTimeoutRef.current);
            }
        };
    }, []);

    const handleSeek = useCallback(
        (event: { nativeEvent: { locationX: number } }) => {
            if (!player || duration <= 0 || progressBarWidth <= 0) return;
            const ratio = Math.min(1, Math.max(0, event.nativeEvent.locationX / progressBarWidth));
            const newTime = ratio * duration;
            try {
                player.currentTime = newTime;
                setPlaybackTime(newTime);
            } catch (err) {
                console.error('Error seeking video:', err);
            }
        },
        [player, duration, progressBarWidth],
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

    return (
        <View style={styles.container}>
            <VideoView
                player={player}
                style={styles.videoPlayer}
                contentFit="contain"
                nativeControls={false}
            />
            <Pressable style={styles.touchOverlay} onPress={handleVideoPress}>
                <View style={styles.touchArea} />
            </Pressable>
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
                            <TouchableOpacity style={styles.controlButton} onPress={onToggleFullscreen}>
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
