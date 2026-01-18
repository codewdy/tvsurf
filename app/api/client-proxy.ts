// API 客户端代理，用于处理返回数据中的 URL 前缀
import { getApiBaseUrl, getTVInfos as getTVInfosBase, getTVDetails as getTVDetailsBase } from './client';
import type { GetTVInfosRequest, GetTVInfosResponse, GetTVDetailsRequest, GetTVDetailsResponse, TVInfo, TV, StorageEpisode } from './types';

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

// 获取 TV 信息列表 API（带 URL 前缀处理）
export async function getTVInfos(
    request: GetTVInfosRequest = { ids: null }
): Promise<GetTVInfosResponse> {
    const baseUrl = await getApiBaseUrl();
    const response = await getTVInfosBase(request);

    return {
        ...response,
        tvs: response.tvs.map(tv => processTVInfo(tv, baseUrl)),
    };
}

// 获取 TV 详情 API（带 URL 前缀处理）
export async function getTVDetails(
    request: GetTVDetailsRequest
): Promise<GetTVDetailsResponse> {
    const baseUrl = await getApiBaseUrl();
    const response = await getTVDetailsBase(request);

    return processGetTVDetailsResponse(response, baseUrl);
}

// 重新导出其他不需要处理 URL 的函数
export {
    getApiBaseUrl,
    setApiBaseUrl,
    getApiToken,
    setApiToken,
    clearApiToken,
    login,
    setTVTag,
    setWatchProgress,
} from './client';
