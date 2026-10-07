import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useResponsiveLayout } from './responsiveLayout';

const FullscreenOrientationContext = createContext<React.Dispatch<React.SetStateAction<boolean>> | null>(null);

/** 所有方向请求由同一个策略串行执行，避免布局变化覆盖全屏横屏锁。 */
export function OrientationProvider({ children }: { children: React.ReactNode }) {
    const { width, height, isLargeScreen } = useResponsiveLayout();
    const [isFullscreen, setIsFullscreen] = useState(false);
    // 用短边识别面板变化，普通手机旋转不会被误认为展开折叠屏。
    const shortSide = Math.min(width, height);
    const baselineRef = useRef(shortSide);
    baselineRef.current = Math.min(baselineRef.current, shortSide);
    const allowRotation = isLargeScreen || shortSide > baselineRef.current;
    const requestsRef = useRef<Promise<unknown>>(Promise.resolve());

    useEffect(() => {
        requestsRef.current = requestsRef.current.catch(() => null).then(() => {
            if (isFullscreen) {
                return ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            }
            if (allowRotation) {
                return ScreenOrientation.unlockAsync();
            }
            return ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }).catch(() => null);
    }, [isFullscreen, allowRotation]);

    return (
        <FullscreenOrientationContext.Provider value={setIsFullscreen}>
            {children}
        </FullscreenOrientationContext.Provider>
    );
}

export function useFullscreenOrientation(isFullscreen: boolean) {
    const setIsFullscreen = useContext(FullscreenOrientationContext);
    if (!setIsFullscreen) {
        throw new Error('useFullscreenOrientation 必须在 OrientationProvider 内使用');
    }
    useEffect(() => {
        setIsFullscreen(isFullscreen);
        return () => setIsFullscreen(false);
    }, [isFullscreen, setIsFullscreen]);
}
