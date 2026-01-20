// API 客户端代理，用于处理返回数据中的 URL 前缀和离线模式支持
import { getApiBaseUrl, getTVInfos as getTVInfosBase, getTVDetails as getTVDetailsBase } from './client';
import { setWatchProgress as setWatchProgressBase, setTVTag as setTVTagBase } from './client';
import { offlineModeManager } from '../utils/offlineModeManager';
import { offlineDataCache } from '../utils/offlineDataCache';
import type { GetTVInfosRequest, GetTVInfosResponse, GetTVDetailsRequest, GetTVDetailsResponse, TVInfo, TV, StorageEpisode, SetWatchProgressRequest, SetTVTagRequest, Tag } from './types';

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
            throw new Error(`TV ${request.id} 的详情未缓存`);
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

// 重新导出其他不需要处理 URL 或离线模式的函数
export {
    getApiBaseUrl,
    setApiBaseUrl,
    getApiToken,
    setApiToken,
    clearApiToken,
    login,
} from './client';
