import { useWindowDimensions } from 'react-native';

/** Android 大屏断点：折叠屏内屏与平板的窗口短边都在此之上 */
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

export function useResponsiveLayout(): ResponsiveLayout {
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;
    // 短边在横竖屏之间基本恒定，等价于 Android 的 smallestScreenWidth；
    // 折叠/展开会变，分屏与平行窗口下窗口变窄也会自动退回单栏。
    const isLargeScreen = Math.min(width, height) >= LARGE_SCREEN_MIN_DP;

    return {
        width,
        height,
        isLandscape,
        isLargeScreen,
        isTwoPane: isLargeScreen && isLandscape,
    };
}
