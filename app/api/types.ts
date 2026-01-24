// Login API 类型定义

// 登录请求
export interface LoginRequest {
    username: string;
    password_hash: string;
}

// 登录响应
export interface LoginResponse {
    token: string;
}

// TV API 类型定义

// Tag 类型
export type Tag = "watching" | "wanted" | "watched" | "on_hold" | "not_tagged";

// 观看进度
export interface WatchProgress {
    episode_id: number;
    time: number;
}

// 用户 TV 数据
export interface UserTVData {
    tv_id: number;
    tag: Tag;
    watch_progress: WatchProgress;
    last_update: string; // ISO datetime string
}

// TV 信息
export interface TVInfo {
    id: number;
    name: string;
    cover_url: string;
    series: number[];
    last_update: string; // ISO datetime string
    total_episodes: number;
    user_data: UserTVData;
}

// 获取 TV 信息列表请求
export interface GetTVInfosRequest {
    ids: number[] | null;
}

// 获取 TV 信息列表响应
export interface GetTVInfosResponse {
    tvs: TVInfo[];
}

// GetTVDetails 相关类型定义

// 下载状态
export type DownloadStatus = "running" | "success" | "failed";

// 源 URL
export interface SourceUrl {
    source_key: string;
    source_name: string;
    channel_name: string;
    url: string;
}

// 源剧集
export interface SourceEpisode {
    source: SourceUrl;
    name: string;
}

// 源
export interface Source {
    source: SourceUrl;
    name: string;
    cover_url: string;
    episodes: SourceEpisode[];
}

// 存储剧集
export interface StorageEpisode {
    name: string;
    filename: string;
    status: DownloadStatus;
}

// 存储
export interface Storage {
    directory: string;
    episodes: StorageEpisode[];
    cover: string;
}

// 追踪状态
export interface TrackStatus {
    tracking: boolean;
    last_update: string; // ISO datetime string
}

// TV 详情
export interface TV {
    id: number;
    name: string;
    source: Source;
    storage: Storage;
    track: TrackStatus;
    series: number[];
}

// 获取 TV 详情请求
export interface GetTVDetailsRequest {
    id: number;
}

// 获取 TV 详情响应
export interface GetTVDetailsResponse {
    tv: TV;
    info: TVInfo;
    episodes: (string | null)[];
}

// 设置 TV 标签请求
export interface SetTVTagRequest {
    tv_id: number;
    tag: Tag;
}

// 设置观看进度请求
export interface SetWatchProgressRequest {
    tv_id: number;
    episode_id: number;
    time: number;
}

// 设置 TV 追更请求
export interface SetTVTrackingRequest {
    tv_id: number;
    tracking: boolean;
}

// 设置 TV 追更响应
export interface SetTVTrackingResponse {
    // 空响应
}

// Series API 类型定义

// 播放列表
export interface Series {
    id: number;
    name: string;
    tvs: number[];
    last_update: string; // ISO datetime string
}

// 获取播放列表请求
export interface GetSeriesRequest {
    ids: number[] | null;
}

// 获取播放列表响应
export interface GetSeriesResponse {
    series: Series[];
}

// 更新播放列表 TV 请求
export interface UpdateSeriesTVsRequest {
    id: number;
    tvs: number[];
}

// 创建播放列表请求
export interface AddSeriesRequest {
    name: string;
}

// 创建播放列表响应
export interface AddSeriesResponse {
    id: number;
}

// 删除播放列表请求
export interface RemoveSeriesRequest {
    id: number;
}

// 搜索 TV 相关类型定义

// 搜索错误
export interface SearchError {
    source_name: string;
    source_key: string;
    error: string;
}

// 搜索 TV 请求
export interface SearchTVRequest {
    keyword: string;
}

// 搜索 TV 响应
export interface SearchTVResponse {
    source: Source[];
    search_error: SearchError[];
}

// 添加 TV 请求
export interface AddTVRequest {
    name: string;
    source: Source;
    tracking: boolean;
    series: number[];
}

// 添加 TV 响应
export interface AddTVResponse {
    id: number;
}

// 下载进度相关类型定义

// 下载进度
export interface DownloadProgress {
    status: string;
    downloading: boolean;
    total_size: number;
    downloaded_size: number;
    speed: number;
}

// 带名称的下载进度
export interface DownloadProgressWithName {
    name: string;
    progress: DownloadProgress;
}

// 获取下载进度请求
export interface GetDownloadProgressRequest {
    // 空对象
}

// 获取下载进度响应
export interface GetDownloadProgressResponse {
    progress: DownloadProgressWithName[];
}

// 更新 TV 源请求
export interface UpdateTVSourceRequest {
    id: number;
    source: Source;
}

// 更新 TV 源响应
export interface UpdateTVSourceResponse {
    // 空响应
}

// 更新剧集源请求
export interface UpdateEpisodeSourceRequest {
    tv_id: number;
    episode_id: number;
    source: SourceUrl;
}

// 更新剧集源响应
export interface UpdateEpisodeSourceResponse {
    // 空响应
}

// 重新调度剧集下载请求
export interface ScheduleEpisodeDownloadRequest {
    tv_id: number;
    episode_ids: number[];
}

// 重新调度剧集下载响应
export interface ScheduleEpisodeDownloadResponse {
    // 空响应
}

// 删除 TV 请求
export interface RemoveTVRequest {
    id: number;
}

// 删除 TV 响应
export interface RemoveTVResponse {
    // 空响应
}

// 监控信息相关类型定义

// 获取监控信息请求
export interface GetMonitorRequest {
    // 空对象
}

// 获取监控信息响应
export interface GetMonitorResponse {
    download_count: number;
    error_count: number;
}

// 错误管理相关类型定义

// 错误类型
export type ErrorType = "error" | "critical";

// 错误信息
export interface Error {
    id: number;
    timestamp: string; // ISO datetime string
    title: string;
    description: string;
    type: ErrorType;
}

// 获取错误列表请求
export interface GetErrorsRequest {
    // 空对象
}

// 获取错误列表响应
export interface GetErrorsResponse {
    errors: Error[];
}

// 删除错误请求
export interface RemoveErrorsRequest {
    ids: number[];
}

// 删除错误响应
export interface RemoveErrorsResponse {
    // 空响应
}
