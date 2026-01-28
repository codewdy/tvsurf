import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Text, StyleSheet, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import TVDetailsScreen from './screens/TVDetailsScreen';
import VideoCacheScreen from './screens/VideoCacheScreen';
import SeriesListScreen from './screens/SeriesListScreen';
import SeriesDetailsScreen from './screens/SeriesDetailsScreen';
import AddTVScreen from './screens/AddTVScreen';
import DownloadMonitorScreen from './screens/DownloadMonitorScreen';
import ErrorManagementScreen from './screens/ErrorManagementScreen';
import ConfigScreen from './screens/ConfigScreen';
import UserManagementScreen from './screens/UserManagementScreen';
import { getApiToken, clearApiToken, whoami } from './api/client-proxy';
import { offlineModeManager } from './utils/offlineModeManager';
import type { TVInfo, WhoamiResponse } from './api/types';

type Screen = 'home' | 'tv-details' | 'cache' | 'series-list' | 'series-details' | 'add-tv' | 'download-monitor' | 'error-management' | 'config' | 'user-management';

interface NavigationState {
  screen: Screen;
  selectedTV?: TVInfo | null;
  selectedSeriesId?: number | null;
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [selectedTV, setSelectedTV] = useState<TVInfo | null>(null);
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  // 导航栈：存储导航历史
  const [navigationStack, setNavigationStack] = useState<NavigationState[]>([]);
  // 用户信息
  const [userInfo, setUserInfo] = useState<WhoamiResponse | null>(null);

  // 检查用户是否是admin
  const isAdmin = userInfo?.user?.group?.includes('admin') ?? false;

  useEffect(() => {
    checkLoginStatus();
    loadOfflineStatus();
  }, []);

  // 当登录状态改变时，加载用户信息
  useEffect(() => {
    if (isLoggedIn) {
      loadUserInfo();
    } else {
      setUserInfo(null);
    }
  }, [isLoggedIn]);

  // 监听屏幕变化，如果处于离线模式且尝试进入add-tv，则自动返回
  useEffect(() => {
    if (isOffline && currentScreen === 'add-tv') {
      Alert.alert('提示', '离线模式下无法添加TV，请先退出离线模式');
      setCurrentScreen('home');
    }
  }, [isOffline, currentScreen]);

  const loadOfflineStatus = async () => {
    try {
      const offline = await offlineModeManager.getOfflineMode();
      setIsOffline(offline);
    } catch (error) {
      console.error('加载离线模式状态失败:', error);
    }
  };

  const loadUserInfo = async () => {
    try {
      const info = await whoami({});
      setUserInfo(info);
    } catch (error) {
      console.error('加载用户信息失败:', error);
      // 如果获取用户信息失败，不设置userInfo，isAdmin会默认为false
    }
  };

  const checkLoginStatus = async () => {
    try {
      const token = await getApiToken();
      setIsLoggedIn(!!token);
    } catch (error) {
      console.error('Error checking login status:', error);
      setIsLoggedIn(false);
    }
  };

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    try {
      // 清除存储的 token
      await clearApiToken();
    } catch (error) {
      console.error('Error clearing token:', error);
    }
    setIsLoggedIn(false);
    setCurrentScreen('home');
    setSelectedTV(null);
    setSelectedSeriesId(null);
    // 清空导航栈
    setNavigationStack([]);
  };

  // 导航到新屏幕（推入栈）
  const navigateTo = (screen: Screen, state?: { selectedTV?: TVInfo | null; selectedSeriesId?: number | null }) => {
    // 将当前屏幕状态推入栈
    setNavigationStack(prev => [...prev, {
      screen: currentScreen,
      selectedTV: selectedTV,
      selectedSeriesId: selectedSeriesId,
    }]);

    // 设置新屏幕和状态
    setCurrentScreen(screen);
    if (state?.selectedTV !== undefined) {
      setSelectedTV(state.selectedTV);
    } else if (screen !== 'tv-details') {
      // 如果不是导航到 tv-details，清空 selectedTV
      setSelectedTV(null);
    }
    if (state?.selectedSeriesId !== undefined) {
      setSelectedSeriesId(state.selectedSeriesId);
    } else if (screen !== 'series-details') {
      // 如果不是导航到 series-details，清空 selectedSeriesId
      setSelectedSeriesId(null);
    }
  };

  // 返回上一屏幕（从栈中弹出）
  const navigateBack = () => {
    if (navigationStack.length === 0) {
      // 如果栈为空，返回到 home
      setCurrentScreen('home');
      setSelectedTV(null);
      setSelectedSeriesId(null);
      return;
    }

    // 从栈中弹出上一个屏幕状态
    const prevState = navigationStack[navigationStack.length - 1];
    setNavigationStack(prev => prev.slice(0, -1));

    // 恢复上一个屏幕的状态
    setCurrentScreen(prevState.screen);
    setSelectedTV(prevState.selectedTV ?? null);
    setSelectedSeriesId(prevState.selectedSeriesId ?? null);
  };

  const handleTVPress = (tv: TVInfo) => {
    navigateTo('tv-details', { selectedTV: tv });
  };

  const handleNavigateToCache = () => {
    navigateTo('cache');
  };

  const handleNavigateToSeriesList = () => {
    navigateTo('series-list');
  };

  const handleNavigateToAddTV = async () => {
    // 检查离线模式
    const offline = await offlineModeManager.getOfflineMode();
    if (offline) {
      Alert.alert('提示', '离线模式下无法添加TV，请先退出离线模式');
      return;
    }
    setIsOffline(offline);
    navigateTo('add-tv');
  };

  const handleNavigateToDownloadMonitor = () => {
    navigateTo('download-monitor');
  };

  const handleNavigateToErrorManagement = () => {
    navigateTo('error-management');
  };

  const handleNavigateToConfig = async () => {
    // 检查用户是否是admin
    if (!isAdmin) {
      Alert.alert('权限不足', '只有管理员可以访问系统配置页面');
      return;
    }
    navigateTo('config');
  };

  const handleNavigateToUserManagement = async () => {
    // 检查用户是否是admin
    if (!isAdmin) {
      Alert.alert('权限不足', '只有管理员可以访问用户管理页面');
      return;
    }
    navigateTo('user-management');
  };

  const handleSeriesPress = (seriesId: number) => {
    navigateTo('series-details', { selectedSeriesId: seriesId });
  };

  // 显示加载状态
  if (isLoggedIn === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>加载中...</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {isLoggedIn ? (
        currentScreen === 'home' ? (
          <HomeScreen
            onLogout={handleLogout}
            onTVPress={handleTVPress}
            onNavigateToCache={handleNavigateToCache}
            onNavigateToSeriesList={handleNavigateToSeriesList}
            onNavigateToAddTV={handleNavigateToAddTV}
            onNavigateToDownloadMonitor={handleNavigateToDownloadMonitor}
            onNavigateToErrorManagement={handleNavigateToErrorManagement}
            onNavigateToConfig={handleNavigateToConfig}
            onNavigateToUserManagement={handleNavigateToUserManagement}
          />
        ) : currentScreen === 'cache' ? (
          <VideoCacheScreen onBack={navigateBack} />
        ) : currentScreen === 'series-list' ? (
          <SeriesListScreen
            onBack={navigateBack}
            onTVPress={handleTVPress}
            onSeriesPress={handleSeriesPress}
          />
        ) : currentScreen === 'series-details' && selectedSeriesId !== null ? (
          <SeriesDetailsScreen
            seriesId={selectedSeriesId}
            onBack={navigateBack}
            onTVPress={handleTVPress}
          />
        ) : currentScreen === 'add-tv' ? (
          <AddTVScreen onBack={navigateBack} />
        ) : currentScreen === 'download-monitor' ? (
          <DownloadMonitorScreen onBack={navigateBack} />
        ) : currentScreen === 'error-management' ? (
          <ErrorManagementScreen onBack={navigateBack} />
        ) : currentScreen === 'config' ? (
          isAdmin ? (
            <ConfigScreen onBack={navigateBack} />
          ) : (
            <HomeScreen
              onLogout={handleLogout}
              onTVPress={handleTVPress}
              onNavigateToCache={handleNavigateToCache}
              onNavigateToSeriesList={handleNavigateToSeriesList}
              onNavigateToAddTV={handleNavigateToAddTV}
              onNavigateToDownloadMonitor={handleNavigateToDownloadMonitor}
              onNavigateToErrorManagement={handleNavigateToErrorManagement}
              onNavigateToConfig={handleNavigateToConfig}
              onNavigateToUserManagement={handleNavigateToUserManagement}
            />
          )
        ) : currentScreen === 'user-management' ? (
          isAdmin ? (
            <UserManagementScreen onBack={navigateBack} />
          ) : (
            <HomeScreen
              onLogout={handleLogout}
              onTVPress={handleTVPress}
              onNavigateToCache={handleNavigateToCache}
              onNavigateToSeriesList={handleNavigateToSeriesList}
              onNavigateToAddTV={handleNavigateToAddTV}
              onNavigateToDownloadMonitor={handleNavigateToDownloadMonitor}
              onNavigateToErrorManagement={handleNavigateToErrorManagement}
              onNavigateToConfig={handleNavigateToConfig}
              onNavigateToUserManagement={handleNavigateToUserManagement}
            />
          )
        ) : selectedTV ? (
          <TVDetailsScreen
            tv={selectedTV}
            onBack={navigateBack}
            onSeriesPress={handleSeriesPress}
          />
        ) : (
          <HomeScreen
            onLogout={handleLogout}
            onTVPress={handleTVPress}
            onNavigateToCache={handleNavigateToCache}
            onNavigateToSeriesList={handleNavigateToSeriesList}
            onNavigateToAddTV={handleNavigateToAddTV}
            onNavigateToDownloadMonitor={handleNavigateToDownloadMonitor}
            onNavigateToErrorManagement={handleNavigateToErrorManagement}
            onNavigateToConfig={handleNavigateToConfig}
            onNavigateToUserManagement={handleNavigateToUserManagement}
          />
        )
      ) : (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
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
});
