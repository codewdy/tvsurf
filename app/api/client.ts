// API 客户端
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LoginRequest, LoginResponse } from './types';

// API 基础 URL 存储键
export const API_BASE_URL_KEY = '@tvsurf_api_base_url';
export const API_TOKEN_KEY = '@tvsurf_api_token';

// 获取 API 基础 URL
export async function getApiBaseUrl(): Promise<string | null> {
    try {
        const url = await AsyncStorage.getItem(API_BASE_URL_KEY);
        return url;
    } catch (error) {
        console.error('Error getting API base URL:', error);
        return null;
    }
}

// 设置 API 基础 URL
export async function setApiBaseUrl(url: string): Promise<void> {
    try {
        await AsyncStorage.setItem(API_BASE_URL_KEY, url);
    } catch (error) {
        console.error('Error setting API base URL:', error);
        throw error;
    }
}

// 获取 API Token
export async function getApiToken(): Promise<string | null> {
    try {
        const token = await AsyncStorage.getItem(API_TOKEN_KEY);
        return token;
    } catch (error) {
        console.error('Error getting API token:', error);
        return null;
    }
}

// 设置 API Token
export async function setApiToken(token: string): Promise<void> {
    try {
        await AsyncStorage.setItem(API_TOKEN_KEY, token);
    } catch (error) {
        console.error('Error setting API token:', error);
        throw error;
    }
}

// 清除 API Token
export async function clearApiToken(): Promise<void> {
    try {
        await AsyncStorage.removeItem(API_TOKEN_KEY);
    } catch (error) {
        console.error('Error clearing API token:', error);
        throw error;
    }
}

// 基础 API 调用函数
async function apiCall<TRequest, TResponse>(
    baseUrl: string,
    endpoint: string,
    request: TRequest
): Promise<TResponse> {
    const url = `${baseUrl}${endpoint}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.statusText} - ${errorText}`);
    }

    return response.json();
}

// 登录 API
export async function login(
    baseUrl: string,
    request: LoginRequest
): Promise<LoginResponse> {
    return apiCall<LoginRequest, LoginResponse>(baseUrl, '/api/login', request);
}
