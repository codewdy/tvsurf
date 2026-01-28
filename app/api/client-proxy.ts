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
    setTVTracking as setTVTrackingBase,
    getSeries as getSeriesBase,
    updateSeriesTVs as updateSeriesTVsBase,
    addSeries as addSeriesBase,
    removeSeries as removeSeriesBase,
    searchTV as searchTVBase,
    addTV as addTVBase,
    getDownloadProgress as getDownloadProgressBase,
    updateTVSource as updateTVSourceBase,
    updateEpisodeSource as updateEpisodeSourceBase,
    scheduleEpisodeDownload as scheduleEpisodeDownloadBase,
    removeTV as removeTVBase,
    getMonitor as getMonitorBase,
    getErrors as getErrorsBase,
    removeErrors as removeErrorsBase,
    getConfig as getConfigBase,
    setConfig as setConfigBase,
    whoami as whoamiBase,
    getUsers as getUsersBase,
    addUser as addUserBase,
    removeUser as removeUserBase,
    updateUserGroup as updateUserGroupBase,
    setUserPassword as setUserPasswordBase
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
    SetTVTrackingRequest,
    SetTVTrackingResponse,
    Tag,
    LoginRequest,
    LoginResponse,
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
    ScheduleEpisodeDownloadResponse,
    RemoveTVRequest,
    RemoveTVResponse,
    GetMonitorRequest,
    GetMonitorResponse,
    GetErrorsRequest,
    GetErrorsResponse,
    RemoveErrorsRequest,
    RemoveErrorsResponse,
    GetConfigRequest,
    GetConfigResponse,
    SetConfigRequest,
    SetConfigResponse,
    WhoamiRequest,
    WhoamiResponse,
    GetUsersRequest,
    GetUsersResponse,
    AddUserRequest,
    AddUserResponse,
    RemoveUserRequest,
    RemoveUserResponse,
    UpdateUserGroupRequest,
    UpdateUserGroupResponse,
    SetUserPasswordRequest,
    SetUserPasswordResponse
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

// 设置 TV 追更 API（支持离线模式）
export async function setTVTracking(
    request: SetTVTrackingRequest
): Promise<SetTVTrackingResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        // 离线模式：记录到待上传队列
        await offlineModeManager.recordTrackingChange(request.tv_id, request.tracking);
        return {};
    }

    // 在线模式：直接调用 API
    return await setTVTrackingBase(request);
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

// 搜索 TV API（离线模式下不可用）
export async function searchTV(
    request: SearchTVRequest
): Promise<SearchTVResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法搜索TV，请先退出离线模式');
    }

    // 在线模式：直接调用 API
    return await searchTVBase(request);
}

// 添加 TV API（离线模式下不可用）
export async function addTV(
    request: AddTVRequest
): Promise<AddTVResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法添加TV，请先退出离线模式');
    }

    // 在线模式：直接调用 API
    return await addTVBase(request);
}

// 获取下载进度 API（离线模式下不可用）
export async function getDownloadProgress(
    request: GetDownloadProgressRequest = {}
): Promise<GetDownloadProgressResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法获取下载进度，请先退出离线模式');
    }

    // 在线模式：直接调用 API
    return await getDownloadProgressBase(request);
}

// 更新 TV 源 API（离线模式下不可用）
export async function updateTVSource(
    request: UpdateTVSourceRequest
): Promise<UpdateTVSourceResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法更新TV源，请先退出离线模式');
    }

    // 在线模式：直接调用 API
    return await updateTVSourceBase(request);
}

// 更新剧集源 API（离线模式下不可用）
export async function updateEpisodeSource(
    request: UpdateEpisodeSourceRequest
): Promise<UpdateEpisodeSourceResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法更新剧集源，请先退出离线模式');
    }

    // 在线模式：直接调用 API
    return await updateEpisodeSourceBase(request);
}

// 重新调度剧集下载 API（离线模式下不可用）
export async function scheduleEpisodeDownload(
    request: ScheduleEpisodeDownloadRequest
): Promise<ScheduleEpisodeDownloadResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法重新下载剧集，请先退出离线模式');
    }

    // 在线模式：直接调用 API
    return await scheduleEpisodeDownloadBase(request);
}

// 删除 TV API（离线模式下不可用）
export async function removeTV(
    request: RemoveTVRequest
): Promise<RemoveTVResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法删除TV，请先退出离线模式');
    }

    // 在线模式：直接调用 API
    return await removeTVBase(request);
}

// 获取监控信息 API（离线模式下返回默认值）
export async function getMonitor(
    request: GetMonitorRequest = {}
): Promise<GetMonitorResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        // 离线模式下返回默认值
        return { download_count: 0, error_count: 0 };
    }

    // 在线模式：直接调用 API
    return await getMonitorBase(request);
}

// 获取错误列表 API（离线模式下不可用）
export async function getErrors(
    request: GetErrorsRequest = {}
): Promise<GetErrorsResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法获取错误列表，请先退出离线模式');
    }

    // 在线模式：直接调用 API
    return await getErrorsBase(request);
}

// 删除错误 API（离线模式下不可用）
export async function removeErrors(
    request: RemoveErrorsRequest
): Promise<RemoveErrorsResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法删除错误，请先退出离线模式');
    }

    // 在线模式：直接调用 API
    return await removeErrorsBase(request);
}

// 获取配置 API（离线模式下不可用）
export async function getConfig(
    request: GetConfigRequest = {}
): Promise<GetConfigResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法获取配置，请先退出离线模式');
    }

    // 在线模式：直接调用 API
    return await getConfigBase(request);
}

// 设置配置 API（离线模式下不可用）
export async function setConfig(
    request: SetConfigRequest
): Promise<SetConfigResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法设置配置，请先退出离线模式');
    }

    // 在线模式：直接调用 API
    return await setConfigBase(request);
}

// 获取当前用户信息 API
export async function whoami(
    request: WhoamiRequest = {}
): Promise<WhoamiResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        // 离线模式：从离线缓存读取用户信息
        const userInfo = await offlineDataCache.getUserInfo();
        if (!userInfo) {
            throw new OfflineModeError('离线模式下无法获取用户信息，该内容未缓存');
        }
        return userInfo;
    }

    // 在线模式：直接调用 API
    return await whoamiBase(request);
}

// 获取用户列表 API（离线模式下不可用）
export async function getUsers(
    request: GetUsersRequest = {}
): Promise<GetUsersResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法获取用户列表，请先退出离线模式');
    }

    // 在线模式：直接调用 API
    return await getUsersBase(request);
}

// 添加用户 API（离线模式下不可用）
export async function addUser(
    request: AddUserRequest
): Promise<AddUserResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法添加用户，请先退出离线模式');
    }

    // 在线模式：直接调用 API
    return await addUserBase(request);
}

// 删除用户 API（离线模式下不可用）
export async function removeUser(
    request: RemoveUserRequest
): Promise<RemoveUserResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法删除用户，请先退出离线模式');
    }

    // 在线模式：直接调用 API
    return await removeUserBase(request);
}

// 更新用户组 API（离线模式下不可用）
export async function updateUserGroup(
    request: UpdateUserGroupRequest
): Promise<UpdateUserGroupResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法更新用户组，请先退出离线模式');
    }

    // 在线模式：直接调用 API
    return await updateUserGroupBase(request);
}

// 设置用户密码 API（离线模式下不可用）
export async function setUserPassword(
    request: SetUserPasswordRequest
): Promise<SetUserPasswordResponse> {
    // 检查是否处于离线模式
    const isOffline = await offlineModeManager.getOfflineMode();
    if (isOffline) {
        throw new OfflineModeError('离线模式下无法设置用户密码，请先退出离线模式');
    }

    // 在线模式：直接调用 API
    return await setUserPasswordBase(request);
}

// 导出离线模式错误类和离线数据缓存，供外部使用
export { OfflineModeError };
export { offlineDataCache } from '../utils/offlineDataCache';
