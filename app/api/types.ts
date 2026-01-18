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
