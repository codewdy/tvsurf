import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import TVDetailsScreen from './screens/TVDetailsScreen';
import { getApiToken, clearApiToken } from './api/client';
import type { TVInfo } from './api/types';

type Screen = 'home' | 'tv-details';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [selectedTV, setSelectedTV] = useState<TVInfo | null>(null);

  useEffect(() => {
    checkLoginStatus();
  }, []);

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
  };

  const handleTVPress = (tv: TVInfo) => {
    setSelectedTV(tv);
    setCurrentScreen('tv-details');
  };

  const handleBackToHome = () => {
    setCurrentScreen('home');
    setSelectedTV(null);
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
    <>
      {isLoggedIn ? (
        currentScreen === 'home' ? (
          <HomeScreen onLogout={handleLogout} onTVPress={handleTVPress} />
        ) : selectedTV ? (
          <TVDetailsScreen
            tv={selectedTV}
            onBack={handleBackToHome}
          />
        ) : (
          <HomeScreen onLogout={handleLogout} onTVPress={handleTVPress} />
        )
      ) : (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
      <StatusBar style="auto" />
    </>
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
