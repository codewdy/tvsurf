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
