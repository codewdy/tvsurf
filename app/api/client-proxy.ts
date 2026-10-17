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
    setUserPassword as setUserPasswordBase,
    setMyPassword as setMyPasswordBase
} from './client';
import { dataSync } from '../utils/dataSync';
import { offlineDataCache } from '../utils/offlineDataCache';
import type {
    GetTVInfosRequest,
    GetTVInfosResponse,
    GetTVDetailsRequest,
    GetTVDetailsResponse,
    TVInfo,
    SetWatchProgressRequest,
    SetTVTagRequest,
    SetTVTrackingRequest,
    SetTVTrackingResponse,
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
    SetUserPasswordResponse,
    SetMyPasswordRequest,
    SetMyPasswordResponse
} from './types';

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
        info: processTVInfo(response.info, baseUrl),
    };
}

export async function getTVInfos(
    request: GetTVInfosRequest = { ids: null }
): Promise<GetTVInfosResponse> {
    const baseUrl = await getApiBaseUrl();
    return dataSync.read('getTVInfos' + JSON.stringify(request), async () => {
        const response = await getTVInfosBase(request);
        await offlineDataCache.saveTVInfos(response.tvs, request.ids === null);
        return response;
    }, async () => {
        const tvs = await offlineDataCache.getTVInfos(request.ids);
        if (!(await offlineDataCache.hasTVInfos(request.ids))) return null;
        return { tvs };
    }).then(response => ({ ...response, tvs: response.tvs.map(tv => processTVInfo(tv, baseUrl)) }));
}

export async function getTVDetails(
    request: GetTVDetailsRequest
): Promise<GetTVDetailsResponse> {
    const response = await dataSync.read('getTVDetails' + JSON.stringify(request), async () => {
        const details = await getTVDetailsBase(request);
        await offlineDataCache.saveTVDetails(details);
        return details;
    }, () => offlineDataCache.getTVDetails(request.id));
    return processGetTVDetailsResponse(response, await getApiBaseUrl());
}

export async function setWatchProgress(
    request: SetWatchProgressRequest
): Promise<void> {
    await dataSync.write(() => offlineDataCache.recordWatchProgress(request.tv_id, request.episode_id, request.time));
}

export async function setTVTag(
    request: SetTVTagRequest
): Promise<void> {
    await dataSync.write(() => offlineDataCache.recordTagChange(request.tv_id, request.tag));
}

export async function setTVTracking(
    request: SetTVTrackingRequest
): Promise<SetTVTrackingResponse> {
    await dataSync.write(() => offlineDataCache.recordTrackingChange(request.tv_id, request.tracking));
    return {};
}

export async function login(
    baseUrl: string,
    request: LoginRequest
): Promise<LoginResponse> {
    return await loginBase(baseUrl, request);
}

export async function getApiBaseUrl(): Promise<string | null> {
    return await getApiBaseUrlBase();
}

export async function setApiBaseUrl(url: string): Promise<void> {
    await dataSync.configure(() => setApiBaseUrlBase(url));
}

export async function getApiToken(): Promise<string | null> {
    return await getApiTokenBase();
}

export async function setApiToken(token: string): Promise<void> {
    await dataSync.configure(() => setApiTokenBase(token));
}

export async function clearApiToken(): Promise<void> {
    await dataSync.configure(() => clearApiTokenBase());
}

export async function getSeries(
    request: GetSeriesRequest = { ids: null }
): Promise<GetSeriesResponse> {
    return dataSync.read('getSeries' + JSON.stringify(request), async () => {
        const response = await getSeriesBase({
            ids: request.ids?.map(id => offlineDataCache.resolveId(id)) ?? null,
        });
        await offlineDataCache.saveSeries(response.series, request.ids === null);
        return response;
    }, async () => (await offlineDataCache.hasSeries(request.ids))
        ? { series: await offlineDataCache.getSeries(request.ids) } : null);
}

export async function updateSeriesTVs(
    request: UpdateSeriesTVsRequest
): Promise<void> {
    await dataSync.write(() => offlineDataCache.recordUpdateSeriesTVs(request.id, request.tvs));
}

export async function addSeries(
    request: AddSeriesRequest
): Promise<AddSeriesResponse> {
    const result = await dataSync.write(async () => {
        const id = await offlineDataCache.generateTempSeriesId();
        await offlineDataCache.recordAddSeries(id, request.name);
        return { id };
    });
    return { id: offlineDataCache.resolveId(result.id) };
}

export async function removeSeries(
    request: RemoveSeriesRequest
): Promise<void> {
    await dataSync.write(() => offlineDataCache.recordRemoveSeries(request.id));
}

export async function searchTV(
    request: SearchTVRequest
): Promise<SearchTVResponse> {
    return await searchTVBase(request);
}

export async function addTV(
    request: AddTVRequest
): Promise<AddTVResponse> {
    return await addTVBase(request);
}

export async function getDownloadProgress(
    request: GetDownloadProgressRequest = {}
): Promise<GetDownloadProgressResponse> {
    return await getDownloadProgressBase(request);
}

export async function updateTVSource(
    request: UpdateTVSourceRequest
): Promise<UpdateTVSourceResponse> {
    return await updateTVSourceBase(request);
}

export async function updateEpisodeSource(
    request: UpdateEpisodeSourceRequest
): Promise<UpdateEpisodeSourceResponse> {
    return await updateEpisodeSourceBase(request);
}

export async function scheduleEpisodeDownload(
    request: ScheduleEpisodeDownloadRequest
): Promise<ScheduleEpisodeDownloadResponse> {
    return await scheduleEpisodeDownloadBase(request);
}

export async function removeTV(
    request: RemoveTVRequest
): Promise<RemoveTVResponse> {
    return await removeTVBase(request);
}

export async function getMonitor(
    request: GetMonitorRequest = {}
): Promise<GetMonitorResponse> {
    return await getMonitorBase(request);
}

export async function getErrors(
    request: GetErrorsRequest = {}
): Promise<GetErrorsResponse> {
    return await getErrorsBase(request);
}

export async function removeErrors(
    request: RemoveErrorsRequest
): Promise<RemoveErrorsResponse> {
    return await removeErrorsBase(request);
}

export async function getConfig(
    request: GetConfigRequest = {}
): Promise<GetConfigResponse> {
    return await getConfigBase(request);
}

export async function setConfig(
    request: SetConfigRequest
): Promise<SetConfigResponse> {
    return await setConfigBase(request);
}

// 获取当前用户信息 API
export async function whoami(
    request: WhoamiRequest = {}
): Promise<WhoamiResponse> {
    return dataSync.read('whoami' + JSON.stringify(request), async () => {
        const response = await whoamiBase(request);
        await offlineDataCache.saveUserInfo(response);
        return response;
    }, () => offlineDataCache.getUserInfo());
}

export async function getUsers(
    request: GetUsersRequest = {}
): Promise<GetUsersResponse> {
    return await getUsersBase(request);
}

export async function addUser(
    request: AddUserRequest
): Promise<AddUserResponse> {
    return await addUserBase(request);
}

export async function removeUser(
    request: RemoveUserRequest
): Promise<RemoveUserResponse> {
    return await removeUserBase(request);
}

export async function updateUserGroup(
    request: UpdateUserGroupRequest
): Promise<UpdateUserGroupResponse> {
    return await updateUserGroupBase(request);
}

export async function setUserPassword(
    request: SetUserPasswordRequest
): Promise<SetUserPasswordResponse> {
    return await setUserPasswordBase(request);
}

export async function setMyPassword(
    request: SetMyPasswordRequest
): Promise<SetMyPasswordResponse> {
    return await setMyPasswordBase(request);
}

export { offlineDataCache } from '../utils/offlineDataCache';
