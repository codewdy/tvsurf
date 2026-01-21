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
