import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Dimensions, View, type LayoutChangeEvent } from 'react-native';

/** Android 大屏断点：折叠屏内屏与平板都在此之上 */
export const LARGE_SCREEN_MIN_DP = 600;

export interface ResponsiveLayout {
    width: number;
    height: number;
    isLandscape: boolean;
    /** 折叠屏内屏 / 平板等大屏窗口 */
    isLargeScreen: boolean;
    /** 双栏模式的唯一开关 */
    isTwoPane: boolean;
}

const describe = (width: number, height: number): ResponsiveLayout => {
    const isLandscape = width > height;
    const isLargeScreen = Math.min(width, height) >= LARGE_SCREEN_MIN_DP;
    return { width, height, isLandscape, isLargeScreen, isTwoPane: isLargeScreen && isLandscape };
};

const ResponsiveLayoutContext = createContext<ResponsiveLayout | null>(null);

/**
 * 用根视图实测的尺寸做断点，整个应用共用这一份。
 *
 * 不能用 useWindowDimensions / Dimensions：本项目开了 newArchEnabled，而新架构下
 * didUpdateDimensions 只有旧架构的 ReactRootView 会发，ReactHostImpl.onConfigurationChanged
 * 也仅在 enableFontScaleChangesUpdatingLayout（默认 false）时才重读 DisplayMetrics。
 * 结果是 Dimensions 停在启动时的值不再变化，折叠着启动就永远判成小屏、永远锁竖屏，
 * 展开后被系统信箱化成一条竖窗，反过来又让尺寸测不出来。onLayout 走真实布局，不受影响。
 */
export function ResponsiveLayoutProvider({ children }: { children: React.ReactNode }) {
    // 启动首帧 Dimensions 还是准的，实测到之前先用它兜底
    const [size, setSize] = useState(() => {
        const { width, height } = Dimensions.get('window');
        return { width, height };
    });

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    }, []);

    const value = useMemo(() => describe(size.width, size.height), [size]);

    return (
        <View style={{ flex: 1 }} onLayout={handleLayout}>
            <ResponsiveLayoutContext.Provider value={value}>{children}</ResponsiveLayoutContext.Provider>
        </View>
    );
}

export function useResponsiveLayout(): ResponsiveLayout {
    const layout = useContext(ResponsiveLayoutContext);
    if (!layout) {
        throw new Error('useResponsiveLayout 必须在 ResponsiveLayoutProvider 内使用');
    }
    return layout;
}
