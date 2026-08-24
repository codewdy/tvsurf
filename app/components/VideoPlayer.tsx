import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Brightness from 'expo-brightness';
import { VolumeManager } from 'react-native-volume-manager';

type GestureMode = 'none' | 'seek' | 'brightness' | 'volume';

const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

const getSystemVolume = async (): Promise<number> => {
    try {
        const { volume } = await VolumeManager.getVolume();
        return volume;
    } catch (err) {
        console.error('Error getting system volume:', err);
        return 1;
    }
};

const setSystemVolume = async (volume: number): Promise<void> => {
    try {
        await VolumeManager.setVolume(volume);
    } catch (err) {
        console.error('Error setting system volume:', err);
    }
};

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const HOLD_SPEED = 3;
const HOLD_SPEED_DELAY_MS = 200;

const formatPlaybackRate = (rate: number): string => {
    if (rate === 1) return '1.0x';
    if (Number.isInteger(rate)) return `${rate}.0x`;
    return `${rate}x`;
};

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
    const [playerHeight, setPlayerHeight] = useState(0);
    const [showBrightnessIndicator, setShowBrightnessIndicator] = useState(false);
    const [showVolumeIndicator, setShowVolumeIndicator] = useState(false);
    const [brightnessLevel, setBrightnessLevel] = useState(1);
    const [volumeLevel, setVolumeLevel] = useState(1);
    const [systemTime, setSystemTime] = useState(
        new Date().toLocaleTimeString('zh-CN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
        }),
    );
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const readyRef = useRef(false);
    const isHoldSpeedActiveRef = useRef(false);
    const savedRateRef = useRef(1);
    const autoHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isDraggingRef = useRef(false);
    const seekIndicatorOpacity = useRef(new Animated.Value(0)).current;
    const brightnessIndicatorOpacity = useRef(new Animated.Value(0)).current;
    const volumeIndicatorOpacity = useRef(new Animated.Value(0)).current;
    const gestureModeRef = useRef<GestureMode>('none');
    const gestureStartXRef = useRef(0);
    const gestureStartBrightnessRef = useRef(1);
    const gestureStartVolumeRef = useRef(1);
    const AUTO_HIDE_DELAY_MS = 10000;
    const SEEK_SECONDS_PER_FULL_SWIPE = 100; // 拖动整个播放器宽度对应的秒数
    const GESTURE_AXIS_THRESHOLD = 10;

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
        player.preservesPitch = true;
    });

    const applyPlaybackRate = useCallback(
        (rate: number) => {
            if (!player) return;
            try {
                player.playbackRate = rate;
            } catch (err) {
                console.error('Error setting playback rate:', err);
            }
        },
        [player],
    );

    useEffect(() => {
        if (isHoldSpeedActiveRef.current) return;
        applyPlaybackRate(playbackRate);
    }, [playbackRate, applyPlaybackRate]);

    useEffect(() => {
        readyRef.current = false;
    }, [videoUrl, resumeTime, localUri]);

    useEffect(() => {
        let cancelled = false;
        Brightness.getBrightnessAsync()
            .then((value) => {
                if (!cancelled) {
                    setBrightnessLevel(value);
                }
            })
            .catch((err) => {
                console.error('Error getting brightness:', err);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        getSystemVolume().then((value) => {
            if (!cancelled) {
                setVolumeLevel(value);
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

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
        const timeUpdateSubscription = player.addListener(
            'timeUpdate',
            (payload: { currentTime: number; currentLiveTimestamp: number | null }) => {
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
            }
        );

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
            setShowSpeedMenu(false);
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

    const deactivateHoldSpeed = useCallback(() => {
        if (!isHoldSpeedActiveRef.current) return;
        isHoldSpeedActiveRef.current = false;
        applyPlaybackRate(savedRateRef.current);
    }, [applyPlaybackRate]);

    const handleSingleTap = useCallback(() => {
        setShowControls((prev) => {
            const next = !prev;
            if (next) {
                scheduleAutoHide();
            } else {
                clearAutoHide();
                setShowSpeedMenu(false);
            }
            return next;
        });
    }, [scheduleAutoHide, clearAutoHide]);

    const activateHoldSpeed = useCallback(() => {
        if (isDraggingRef.current) return;
        savedRateRef.current = playbackRate;
        isHoldSpeedActiveRef.current = true;
        applyPlaybackRate(HOLD_SPEED);
    }, [playbackRate, applyPlaybackRate]);

    const beginSeekGesture = useCallback(() => {
        isDraggingRef.current = true;
        deactivateHoldSpeed();
        setShowSeekIndicator(true);
        Animated.timing(seekIndicatorOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [deactivateHoldSpeed, seekIndicatorOpacity]);

    const updateSeekGesture = useCallback(
        (translationX: number) => {
            if (playerWidth <= 0) return;
            const offset = (translationX / playerWidth) * SEEK_SECONDS_PER_FULL_SWIPE;
            setSeekOffset(offset);
        },
        [playerWidth],
    );

    const finishSeekGesture = useCallback(
        (translationX: number) => {
            if (!player || playerWidth <= 0) return;
            const offset = (translationX / playerWidth) * SEEK_SECONDS_PER_FULL_SWIPE;
            const currentTime = player.currentTime || 0;
            const newTime = Math.max(0, Math.min(duration, currentTime + offset));

            try {
                player.currentTime = newTime;
                setPlaybackTime(newTime);
            } catch (err) {
                console.error('Error seeking video:', err);
            }
        },
        [player, playerWidth, duration],
    );

    const finalizeSeekGesture = useCallback(() => {
        setShowSeekIndicator(false);
        setSeekOffset(0);
        setTimeout(() => {
            isDraggingRef.current = false;
        }, 100);
    }, []);

    const showSideIndicator = useCallback(
        (type: 'brightness' | 'volume') => {
            const opacity = type === 'brightness' ? brightnessIndicatorOpacity : volumeIndicatorOpacity;
            if (type === 'brightness') {
                setShowBrightnessIndicator(true);
            } else {
                setShowVolumeIndicator(true);
            }
            Animated.timing(opacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        },
        [brightnessIndicatorOpacity, volumeIndicatorOpacity],
    );

    const hideSideIndicator = useCallback(
        (type: 'brightness' | 'volume') => {
            const opacity = type === 'brightness' ? brightnessIndicatorOpacity : volumeIndicatorOpacity;
            if (type === 'brightness') {
                setShowBrightnessIndicator(false);
            } else {
                setShowVolumeIndicator(false);
            }
            opacity.setValue(0);
        },
        [brightnessIndicatorOpacity, volumeIndicatorOpacity],
    );

    const beginPanGesture = useCallback(
        (x: number) => {
            gestureModeRef.current = 'none';
            gestureStartXRef.current = x;
            deactivateHoldSpeed();
            Brightness.getBrightnessAsync()
                .then((value) => {
                    gestureStartBrightnessRef.current = value;
                    setBrightnessLevel(value);
                })
                .catch((err) => {
                    console.error('Error getting brightness:', err);
                });
            getSystemVolume().then((value) => {
                gestureStartVolumeRef.current = value;
                setVolumeLevel(value);
            });
        },
        [deactivateHoldSpeed],
    );

    const resolveGestureMode = useCallback(
        (translationX: number, translationY: number) => {
            const absX = Math.abs(translationX);
            const absY = Math.abs(translationY);
            if (absX < GESTURE_AXIS_THRESHOLD && absY < GESTURE_AXIS_THRESHOLD) {
                return;
            }

            if (absX >= absY) {
                gestureModeRef.current = 'seek';
                beginSeekGesture();
                return;
            }

            if (playerWidth <= 0) return;

            if (gestureStartXRef.current < playerWidth / 2) {
                gestureModeRef.current = 'brightness';
                isDraggingRef.current = true;
                showSideIndicator('brightness');
            } else {
                gestureModeRef.current = 'volume';
                isDraggingRef.current = true;
                VolumeManager.showNativeVolumeUI({ enabled: false }).catch((err) => {
                    console.error('Error hiding native volume UI:', err);
                });
                showSideIndicator('volume');
            }
        },
        [beginSeekGesture, playerWidth, showSideIndicator],
    );

    const updateBrightnessGesture = useCallback(
        (translationY: number) => {
            if (playerHeight <= 0) return;
            const delta = -translationY / playerHeight;
            const nextBrightness = clamp(gestureStartBrightnessRef.current + delta, 0, 1);
            setBrightnessLevel(nextBrightness);
            Brightness.setBrightnessAsync(nextBrightness).catch((err) => {
                console.error('Error setting brightness:', err);
            });
        },
        [playerHeight],
    );

    const updateVolumeGesture = useCallback(
        (translationY: number) => {
            if (playerHeight <= 0) return;
            const delta = -translationY / playerHeight;
            const nextVolume = clamp(gestureStartVolumeRef.current + delta, 0, 1);
            setVolumeLevel(nextVolume);
            setSystemVolume(nextVolume);
        },
        [playerHeight],
    );

    const updatePanGesture = useCallback(
        (translationX: number, translationY: number) => {
            if (gestureModeRef.current === 'none') {
                resolveGestureMode(translationX, translationY);
            }

            switch (gestureModeRef.current) {
                case 'seek':
                    updateSeekGesture(translationX);
                    break;
                case 'brightness':
                    updateBrightnessGesture(translationY);
                    break;
                case 'volume':
                    updateVolumeGesture(translationY);
                    break;
            }
        },
        [resolveGestureMode, updateBrightnessGesture, updateSeekGesture, updateVolumeGesture],
    );

    const endPanGesture = useCallback(
        (translationX: number) => {
            if (gestureModeRef.current === 'seek') {
                finishSeekGesture(translationX);
            }
        },
        [finishSeekGesture],
    );

    const finalizePanGesture = useCallback(() => {
        const mode = gestureModeRef.current;
        gestureModeRef.current = 'none';

        if (mode === 'seek') {
            finalizeSeekGesture();
            return;
        }

        if (mode === 'brightness') {
            hideSideIndicator('brightness');
        } else if (mode === 'volume') {
            hideSideIndicator('volume');
            VolumeManager.showNativeVolumeUI({ enabled: true }).catch((err) => {
                console.error('Error restoring native volume UI:', err);
            });
        }

        if (mode === 'brightness' || mode === 'volume') {
            setTimeout(() => {
                isDraggingRef.current = false;
            }, 100);
        }
    }, [finalizeSeekGesture, hideSideIndicator]);

    const videoGesture = useMemo(() => {
        const pan = Gesture.Pan()
            .minDistance(GESTURE_AXIS_THRESHOLD)
            .onStart((event) => beginPanGesture(event.x))
            .onUpdate((event) => updatePanGesture(event.translationX, event.translationY))
            .onEnd((event) => endPanGesture(event.translationX))
            .onFinalize(finalizePanGesture)
            .runOnJS(true);

        const longPress = Gesture.LongPress()
            .minDuration(HOLD_SPEED_DELAY_MS)
            .maxDistance(10)
            .onStart(activateHoldSpeed)
            .onFinalize(deactivateHoldSpeed)
            .runOnJS(true);

        const doubleTap = Gesture.Tap()
            .numberOfTaps(2)
            .maxDelay(300)
            .onEnd((_, success) => {
                if (success) togglePlay();
            })
            .runOnJS(true);

        const singleTap = Gesture.Tap()
            .onEnd((_, success) => {
                if (success) handleSingleTap();
            })
            .runOnJS(true);

        return Gesture.Simultaneous(
            pan,
            Gesture.Race(longPress, Gesture.Exclusive(doubleTap, singleTap)),
        );
    }, [
        activateHoldSpeed,
        beginPanGesture,
        deactivateHoldSpeed,
        endPanGesture,
        finalizePanGesture,
        handleSingleTap,
        togglePlay,
        updatePanGesture,
    ]);

    // 清理定时器
    useEffect(() => {
        return () => {
            deactivateHoldSpeed();
            clearAutoHide();
        };
    }, [clearAutoHide, deactivateHoldSpeed]);

    const handleSeek = useCallback(
        (locationX: number) => {
            if (!player || duration <= 0 || progressBarWidth <= 0) return;
            showControlsWithAutoHide();
            const ratio = Math.min(1, Math.max(0, locationX / progressBarWidth));
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

    const progressTapGesture = useMemo(
        () =>
            Gesture.Tap()
                .onEnd((event, success) => {
                    if (success) handleSeek(event.x);
                })
                .runOnJS(true),
        [handleSeek],
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
        const timer = setInterval(() => {
            setSystemTime(
                new Date().toLocaleTimeString('zh-CN', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                }),
            );
        }, 1000);

        return () => {
            clearInterval(timer);
        };
    }, []);

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

    const handleSelectSpeed = useCallback(
        (rate: number) => {
            setPlaybackRate(rate);
            savedRateRef.current = rate;
            setShowSpeedMenu(false);
            showControlsWithAutoHide();
        },
        [showControlsWithAutoHide],
    );

    const handleToggleSpeedMenu = useCallback(() => {
        setShowSpeedMenu((prev) => !prev);
        showControlsWithAutoHide();
    }, [showControlsWithAutoHide]);

    return (
        <View style={styles.container}>
            <VideoView
                player={player}
                style={styles.videoPlayer}
                contentFit="contain"
                nativeControls={false}
                onLayout={(event) => {
                    const { width, height } = event.nativeEvent.layout;
                    if (width > 0 && width !== playerWidth) {
                        setPlayerWidth(width);
                    }
                    if (height > 0 && height !== playerHeight) {
                        setPlayerHeight(height);
                    }
                }}
            />
            {showControls && (
                <View style={styles.systemTimeContainer} pointerEvents="none">
                    <Text style={styles.systemTimeText}>{systemTime}</Text>
                </View>
            )}
            <GestureDetector gesture={videoGesture}>
                <View
                    style={styles.touchOverlay}
                    onLayout={(event) => {
                        const { width, height } = event.nativeEvent.layout;
                        if (width > 0 && width !== playerWidth) {
                            setPlayerWidth(width);
                        }
                        if (height > 0 && height !== playerHeight) {
                            setPlayerHeight(height);
                        }
                    }}
                >
                    <View style={styles.touchArea} />
                </View>
            </GestureDetector>
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
            {showBrightnessIndicator && (
                <Animated.View
                    style={[
                        styles.sideIndicator,
                        styles.leftSideIndicator,
                        { opacity: brightnessIndicatorOpacity },
                    ]}
                    pointerEvents="none"
                >
                    <Ionicons name="sunny" size={28} color="#fff" />
                    <View style={styles.verticalBarTrack}>
                        <View
                            style={[
                                styles.verticalBarFill,
                                { height: `${Math.round(brightnessLevel * 100)}%` },
                            ]}
                        />
                    </View>
                    <Text style={styles.sideIndicatorText}>
                        {Math.round(brightnessLevel * 100)}%
                    </Text>
                </Animated.View>
            )}
            {showVolumeIndicator && (
                <Animated.View
                    style={[
                        styles.sideIndicator,
                        styles.rightSideIndicator,
                        { opacity: volumeIndicatorOpacity },
                    ]}
                    pointerEvents="none"
                >
                    <Ionicons
                        name={volumeLevel <= 0 ? 'volume-mute' : volumeLevel < 0.5 ? 'volume-low' : 'volume-high'}
                        size={28}
                        color="#fff"
                    />
                    <View style={styles.verticalBarTrack}>
                        <View
                            style={[
                                styles.verticalBarFill,
                                { height: `${Math.round(volumeLevel * 100)}%` },
                            ]}
                        />
                    </View>
                    <Text style={styles.sideIndicatorText}>
                        {Math.round(volumeLevel * 100)}%
                    </Text>
                </Animated.View>
            )}
            {showControls && (
                <View style={styles.controlsOverlay} pointerEvents="box-none">
                    <View style={styles.controlsRow}>
                        <TouchableOpacity style={styles.controlButton} onPress={togglePlay}>
                            <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#fff" />
                        </TouchableOpacity>
                        <GestureDetector gesture={progressTapGesture}>
                            <View
                                style={styles.progressBar}
                                onLayout={(event) => setProgressBarWidth(event.nativeEvent.layout.width)}
                            >
                                <View style={styles.progressTrack} />
                                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                                <View style={[styles.progressThumb, { left: `${progressPercent}%` }]} />
                            </View>
                        </GestureDetector>
                        <Text style={styles.timeText}>
                            {formatTime(playbackTime)} / {formatTime(duration)}
                        </Text>
                        <View style={styles.speedControl}>
                            <TouchableOpacity style={styles.speedButton} onPress={handleToggleSpeedMenu}>
                                <Text style={styles.speedButtonText}>{formatPlaybackRate(playbackRate)}</Text>
                            </TouchableOpacity>
                            {showSpeedMenu && (
                                <View style={styles.speedMenu}>
                                    {PLAYBACK_RATES.map((rate) => (
                                        <TouchableOpacity
                                            key={rate}
                                            style={[
                                                styles.speedMenuItem,
                                                rate === playbackRate && styles.speedMenuItemActive,
                                            ]}
                                            onPress={() => handleSelectSpeed(rate)}
                                        >
                                            <Text
                                                style={[
                                                    styles.speedMenuItemText,
                                                    rate === playbackRate && styles.speedMenuItemTextActive,
                                                ]}
                                            >
                                                {formatPlaybackRate(rate)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
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
    sideIndicator: {
        position: 'absolute',
        top: '50%',
        width: 56,
        transform: [{ translateY: -80 }],
        alignItems: 'center',
        zIndex: 3,
    },
    leftSideIndicator: {
        left: 32,
    },
    rightSideIndicator: {
        right: 32,
    },
    verticalBarTrack: {
        width: 4,
        height: 100,
        marginTop: 10,
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    verticalBarFill: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 2,
    },
    sideIndicatorText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
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
    systemTimeContainer: {
        position: 'absolute',
        top: 8,
        right: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        zIndex: 3,
    },
    systemTimeText: {
        color: '#fff',
        fontSize: 12,
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
    speedControl: {
        position: 'relative',
    },
    speedButton: {
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        minWidth: 44,
        alignItems: 'center',
    },
    speedButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    speedMenu: {
        position: 'absolute',
        bottom: 32,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        borderRadius: 8,
        paddingVertical: 4,
        minWidth: 72,
        zIndex: 10,
    },
    speedMenuItem: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    speedMenuItemActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    speedMenuItemText: {
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 13,
        textAlign: 'center',
    },
    speedMenuItemTextActive: {
        color: '#fff',
        fontWeight: '600',
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
