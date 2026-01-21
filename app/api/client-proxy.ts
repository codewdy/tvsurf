// API 客户端代理，用于处理返回数据中的 URL 前缀和离线模式支持
import {
    getApiBaseUrl as getApiBaseUrlBase,
    setApiBaseUrl as setApiBaseUrlBase,
    getApiToken as getApiTokenBase,
    setApiToken as setApiTokenBase,
    clearApiToken as clearApiTokenBase,
    login as loginBase,
    getTVInfos as getTVInfosBase,
    getTVDetails as getTVDetailsBase,
    setWatchProgress as setWatchProgressBase,
    setTVTag as setTVTagBase,
    getSeries as getSeriesBase,
    updateSeriesTVs as updateSeriesTVsBase,
    addSeries as addSeriesBase,
    removeSeries as removeSeriesBase
} from './client';
import { offlineModeManager } from '../utils/offlineModeManager';
import { offlineDataCache } from '../utils/offlineDataCache';
import type {
    GetTVInfosRequest,
    GetTVInfosResponse,
    GetTVDetailsRequest,
    GetTVDetailsResponse,
    TVInfo,
    TV,
    StorageEpisode,
    SetWatchProgressRequest,
    SetTVTagRequest,
    Tag,
    LoginRequest,
    LoginResponse,
    GetSeriesRequest,
    GetSeriesResponse,
    UpdateSeriesTVsRequest,
    AddSeriesRequest,
    AddSeriesResponse,
    RemoveSeriesRequest
} from './types';

// 离线模式错误
class OfflineModeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OfflineModeError';
    }
}

// 添加 URL 前缀的辅助函数
function addUrlPrefix(url: string | null | undefined, baseUrl: string | null): string | null {
    if (!url) return url || null;
    // 如果已经是完整 URL，直接返回
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    if (!baseUrl) return url;
    // 确保 baseUrl 不以斜杠结尾，url 以斜杠开头
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
}

// 处理 TVInfo 中的 URL
function processTVInfo(tv: TVInfo, baseUrl: string | null): TVInfo {
    return {
        ...tv,
        cover_url: addUrlPrefix(tv.cover_url, baseUrl) || tv.cover_url,
    };
}

// 处理 GetTVDetailsResponse
function processGetTVDetailsResponse(response: GetTVDetailsResponse, baseUrl: string | null): GetTVDetailsResponse {
    const processedEpisodes: (string | null)[] = response.episodes.map((ep, index) => addUrlPrefix(ep, baseUrl));

    return {
        ...response,
        episodes: processedEpisodes,
    };
}

// 获取 TV 信息列表 API（带 URL 前缀处理和离线模式支持）
export async function getTVInfos(
    request: GetTVInfosRequest = { ids: null }
): Promise<GetTVInfosResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        // 从离线缓存读取（缓存数据已经包含处理过的 URL）
        const tvs = await offlineDataCache.getTVInfos(request.ids);
        return { tvs };
    }

    // 在线模式：从 API 获取并处理 URL
    const baseUrl = await getApiBaseUrl();
    const response = await getTVInfosBase(request);

    return {
        ...response,
        tvs: response.tvs.map(tv => processTVInfo(tv, baseUrl)),
    };
}

// 获取 TV 详情 API（带 URL 前缀处理和离线模式支持）
export async function getTVDetails(
    request: GetTVDetailsRequest
): Promise<GetTVDetailsResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        // 从离线缓存读取（缓存数据已经包含处理过的 URL）
        const details = await offlineDataCache.getTVDetails(request.id);
        if (!details) {
            throw new OfflineModeError(`离线模式下无法获取 TV ${request.id} 的详情，该内容未缓存`);
        }
        return details;
    }

    // 在线模式：从 API 获取并处理 URL
    const baseUrl = await getApiBaseUrl();
    const response = await getTVDetailsBase(request);

    return processGetTVDetailsResponse(response, baseUrl);
}

// 设置观看进度 API（支持离线模式）
export async function setWatchProgress(
    request: SetWatchProgressRequest
): Promise<void> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        // 离线模式：记录到待上传队列
        await offlineModeManager.recordWatchProgress(
            request.tv_id,
            request.episode_id,
            request.time
        );
        return;
    }

    // 在线模式：直接调用 API
    await setWatchProgressBase(request);
}

// 设置 TV 标签 API（支持离线模式）
export async function setTVTag(
    request: SetTVTagRequest
): Promise<void> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        // 离线模式：记录到待上传队列
        await offlineModeManager.recordTagChange(request.tv_id, request.tag);
        return;
    }

    // 在线模式：直接调用 API
    await setTVTagBase(request);
}

// 登录 API（离线模式下不可用）
export async function login(
    baseUrl: string,
    request: LoginRequest
): Promise<LoginResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法登录，请先退出离线模式');
    }

    // 在线模式：直接调用 API
    return await loginBase(baseUrl, request);
}

// API 配置相关函数（这些函数不需要离线模式检查，因为它们只是读写本地配置）
export async function getApiBaseUrl(): Promise<string | null> {
    return await getApiBaseUrlBase();
}

export async function setApiBaseUrl(url: string): Promise<void> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法修改 API 地址，请先退出离线模式');
    }

    await setApiBaseUrlBase(url);
}

export async function getApiToken(): Promise<string | null> {
    return await getApiTokenBase();
}

export async function setApiToken(token: string): Promise<void> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法修改 API Token，请先退出离线模式');
    }

    await setApiTokenBase(token);
}

export async function clearApiToken(): Promise<void> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法清除 API Token，请先退出离线模式');
    }

    await clearApiTokenBase();
}

// 获取播放列表列表 API（支持离线模式）
export async function getSeries(
    request: GetSeriesRequest = { ids: null }
): Promise<GetSeriesResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        // 离线模式：从离线缓存读取
        const series = await offlineDataCache.getSeries(request.ids);
        return { series };
    }

    // 在线模式：从 API 获取
    return await getSeriesBase(request);
}

// 更新播放列表 TV API（支持离线模式）
export async function updateSeriesTVs(
    request: UpdateSeriesTVsRequest
): Promise<void> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        // 离线模式：记录操作
        await offlineModeManager.recordUpdateSeriesTVs(request.id, request.tvs);
        return;
    }

    // 在线模式：直接调用 API
    await updateSeriesTVsBase(request);
}

// 创建播放列表 API（支持离线模式）
export async function addSeries(
    request: AddSeriesRequest
): Promise<AddSeriesResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        // 离线模式：生成临时 ID 并记录操作
        const tempId = await offlineDataCache.generateTempSeriesId();
        await offlineModeManager.recordAddSeries(tempId, request.name);
        return { id: tempId };
    }

    // 在线模式：直接调用 API
    return await addSeriesBase(request);
}

// 删除播放列表 API（支持离线模式）
export async function removeSeries(
    request: RemoveSeriesRequest
): Promise<void> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        // 离线模式：记录操作
        await offlineModeManager.recordRemoveSeries(request.id);
        return;
    }

    // 在线模式：直接调用 API
    await removeSeriesBase(request);
}

// 导出离线模式错误类和离线数据缓存，供外部使用
export { OfflineModeError };
export { offlineDataCache } from '../utils/offlineDataCache';
