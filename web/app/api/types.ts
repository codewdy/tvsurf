// 通用类型定义

// Tag 类型
export type Tag = "watching" | "wanted" | "watched" | "on_hold" | "not_tagged";

// Tag 显示名称映射
export const TAG_NAMES: Record<Tag, string> = {
  watching: "观看中",
  wanted: "想看",
  watched: "已看",
  on_hold: "暂停",
  not_tagged: "未标记",
};

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

// 系列
export interface Series {
  id: number;
  name: string;
  tvs: number[];
  last_update: string; // ISO datetime string
}

// 来源 URL
export interface SourceUrl {
  source_key: string;
  source_name: string;
  channel_name: string;
  url: string;
}

// 剧集
export interface Episode {
  source: SourceUrl;
  name: string;
}

// 来源
export interface Source {
  source: SourceUrl;
  name: string;
  cover_url: string;
  episodes: Episode[];
}

// 下载状态
export type DownloadStatus = "running" | "success" | "failed";

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
  latest_update: string;
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

// 搜索错误
export interface SearchError {
  source_name: string;
  source_key: string;
  error: string;
}

// 错误类型
export type ErrorType = "error" | "critical";

// 错误
export interface Error {
  id: number;
  timestamp: string; // ISO datetime string
  title: string;
  description: string;
  type: ErrorType;
}

// API 请求/响应类型

// 获取 TV 信息列表请求
export interface GetTVInfosRequest {
  ids: number[] | null;
}

// 获取 TV 信息列表响应
export interface GetTVInfosResponse {
  tvs: TVInfo[];
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

// 设置观看进度请求
export interface SetWatchProgressRequest {
  tv_id: number;
  episode_id: number;
  time: number;
}

// 获取系列请求
export interface GetSeriesRequest {
  ids: number[] | null;
}

// 获取系列响应
export interface GetSeriesResponse {
  series: Series[];
}

// 添加系列请求
export interface AddSeriesRequest {
  name: string;
}

// 添加系列响应
export interface AddSeriesResponse {
  id: number;
}

// 更新系列 TV 列表请求
export interface UpdateSeriesTVsRequest {
  id: number;
  tvs: number[];
}

// 获取下载进度请求
export interface GetDownloadProgressRequest {
  // 空对象
}

// 获取下载进度响应
export interface GetDownloadProgressResponse {
  progress: DownloadProgressWithName[];
}

// 获取错误请求
export interface GetErrorsRequest {
  // 空对象
}

// 获取错误响应
export interface GetErrorsResponse {
  errors: Error[];
}

// 删除错误请求
export interface RemoveErrorsRequest {
  ids: number[];
}
