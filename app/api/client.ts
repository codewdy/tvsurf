// API 客户端
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
    LoginRequest,
    LoginResponse,
    GetTVInfosRequest,
    GetTVInfosResponse,
    GetTVDetailsRequest,
    GetTVDetailsResponse,
    SetTVTagRequest,
    SetWatchProgressRequest,
    SetTVTrackingRequest,
    SetTVTrackingResponse,
    GetSeriesRequest,
    GetSeriesResponse,
    UpdateSeriesTVsRequest,
    AddSeriesRequest,
    AddSeriesResponse,
    RemoveSeriesRequest,
    SearchTVRequest,
    SearchTVResponse,
    AddTVRequest,
    AddTVResponse,
    GetDownloadProgressRequest,
    GetDownloadProgressResponse,
    UpdateTVSourceRequest,
    UpdateTVSourceResponse,
    UpdateEpisodeSourceRequest,
    UpdateEpisodeSourceResponse,
    ScheduleEpisodeDownloadRequest,
    ScheduleEpisodeDownloadResponse
} from './types';

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
    request: TRequest,
    token?: string | null
): Promise<TResponse> {
    const url = `${baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const errorText = await response.text();
        // 401 未授权错误，抛出特殊错误
        if (response.status === 401) {
            const error = new Error(`Unauthorized`);
            (error as any).status = 401;
            throw error;
        }
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

// 获取 TV 信息列表 API
export async function getTVInfos(
    request: GetTVInfosRequest = { ids: null }
): Promise<GetTVInfosResponse> {
    const baseUrl = await getApiBaseUrl();
    if (!baseUrl) {
        throw new Error('API base URL not set');
    }

    const token = await getApiToken();
    return apiCall<GetTVInfosRequest, GetTVInfosResponse>(
        baseUrl,
        '/api/get_tv_infos',
        request,
        token
    );
}

// 获取 TV 详情 API
export async function getTVDetails(
    request: GetTVDetailsRequest
): Promise<GetTVDetailsResponse> {
    const baseUrl = await getApiBaseUrl();
    if (!baseUrl) {
        throw new Error('API base URL not set');
    }

    const token = await getApiToken();
    return apiCall<GetTVDetailsRequest, GetTVDetailsResponse>(
        baseUrl,
        '/api/get_tv_details',
        request,
        token
    );
}

// 设置 TV 标签 API
export async function setTVTag(
    request: SetTVTagRequest
): Promise<void> {
    const baseUrl = await getApiBaseUrl();
    if (!baseUrl) {
        throw new Error('API base URL not set');
    }

    const token = await getApiToken();
    await apiCall<SetTVTagRequest, void>(
        baseUrl,
        '/api/set_tv_tag',
        request,
        token
    );
}

// 设置观看进度 API
export async function setWatchProgress(
    request: SetWatchProgressRequest
): Promise<void> {
    const baseUrl = await getApiBaseUrl();
    if (!baseUrl) {
        throw new Error('API base URL not set');
    }

    const token = await getApiToken();
    await apiCall<SetWatchProgressRequest, void>(
        baseUrl,
        '/api/set_watch_progress',
        request,
        token
    );
}

// 设置 TV 追更 API
export async function setTVTracking(
    request: SetTVTrackingRequest
): Promise<SetTVTrackingResponse> {
    const baseUrl = await getApiBaseUrl();
    if (!baseUrl) {
        throw new Error('API base URL not set');
    }

    const token = await getApiToken();
    return apiCall<SetTVTrackingRequest, SetTVTrackingResponse>(
        baseUrl,
        '/api/set_tv_tracking',
        request,
        token
    );
}

// 获取播放列表列表 API
export async function getSeries(
    request: GetSeriesRequest = { ids: null }
): Promise<GetSeriesResponse> {
    const baseUrl = await getApiBaseUrl();
    if (!baseUrl) {
        throw new Error('API base URL not set');
    }

    const token = await getApiToken();
    return apiCall<GetSeriesRequest, GetSeriesResponse>(
        baseUrl,
        '/api/get_series',
        request,
        token
    );
}

// 更新播放列表 TV API
export async function updateSeriesTVs(
    request: UpdateSeriesTVsRequest
): Promise<void> {
    const baseUrl = await getApiBaseUrl();
    if (!baseUrl) {
        throw new Error('API base URL not set');
    }

    const token = await getApiToken();
    await apiCall<UpdateSeriesTVsRequest, void>(
        baseUrl,
        '/api/update_series_tvs',
        request,
        token
    );
}

// 创建播放列表 API
export async function addSeries(
    request: AddSeriesRequest
): Promise<AddSeriesResponse> {
    const baseUrl = await getApiBaseUrl();
    if (!baseUrl) {
        throw new Error('API base URL not set');
    }

    const token = await getApiToken();
    return apiCall<AddSeriesRequest, AddSeriesResponse>(
        baseUrl,
        '/api/add_series',
        request,
        token
    );
}

// 删除播放列表 API
export async function removeSeries(
    request: RemoveSeriesRequest
): Promise<void> {
    const baseUrl = await getApiBaseUrl();
    if (!baseUrl) {
        throw new Error('API base URL not set');
    }

    const token = await getApiToken();
    await apiCall<RemoveSeriesRequest, void>(
        baseUrl,
        '/api/remove_series',
        request,
        token
    );
}

// 搜索 TV API
export async function searchTV(
    request: SearchTVRequest
): Promise<SearchTVResponse> {
    const baseUrl = await getApiBaseUrl();
    if (!baseUrl) {
        throw new Error('API base URL not set');
    }

    const token = await getApiToken();
    return apiCall<SearchTVRequest, SearchTVResponse>(
        baseUrl,
        '/api/search_tv',
        request,
        token
    );
}

// 添加 TV API
export async function addTV(
    request: AddTVRequest
): Promise<AddTVResponse> {
    const baseUrl = await getApiBaseUrl();
    if (!baseUrl) {
        throw new Error('API base URL not set');
    }

    const token = await getApiToken();
    return apiCall<AddTVRequest, AddTVResponse>(
        baseUrl,
        '/api/add_tv',
        request,
        token
    );
}

// 获取下载进度 API
export async function getDownloadProgress(
    request: GetDownloadProgressRequest = {}
): Promise<GetDownloadProgressResponse> {
    const baseUrl = await getApiBaseUrl();
    if (!baseUrl) {
        throw new Error('API base URL not set');
    }

    const token = await getApiToken();
    return apiCall<GetDownloadProgressRequest, GetDownloadProgressResponse>(
        baseUrl,
        '/api/get_download_progress',
        request,
        token
    );
}

// 更新 TV 源 API
export async function updateTVSource(
    request: UpdateTVSourceRequest
): Promise<UpdateTVSourceResponse> {
    const baseUrl = await getApiBaseUrl();
    if (!baseUrl) {
        throw new Error('API base URL not set');
    }

    const token = await getApiToken();
    return apiCall<UpdateTVSourceRequest, UpdateTVSourceResponse>(
        baseUrl,
        '/api/update_tv_source',
        request,
        token
    );
}

// 更新剧集源 API
export async function updateEpisodeSource(
    request: UpdateEpisodeSourceRequest
): Promise<UpdateEpisodeSourceResponse> {
    const baseUrl = await getApiBaseUrl();
    if (!baseUrl) {
        throw new Error('API base URL not set');
    }

    const token = await getApiToken();
    return apiCall<UpdateEpisodeSourceRequest, UpdateEpisodeSourceResponse>(
        baseUrl,
        '/api/update_episode_series',
        request,
        token
    );
}

// 重新调度剧集下载 API
export async function scheduleEpisodeDownload(
    request: ScheduleEpisodeDownloadRequest
): Promise<ScheduleEpisodeDownloadResponse> {
    const baseUrl = await getApiBaseUrl();
    if (!baseUrl) {
        throw new Error('API base URL not set');
    }

    const token = await getApiToken();
    return apiCall<ScheduleEpisodeDownloadRequest, ScheduleEpisodeDownloadResponse>(
        baseUrl,
        '/api/schedule_episode_download',
        request,
        token
    );
}
