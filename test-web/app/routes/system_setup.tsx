import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import type { Route } from "./+types/system_setup";
import { useNavigate, useSearchParams } from "react-router";
import { hashPassword } from "../utils/password";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "系统初始化" },
    { name: "description", content: "首次使用系统，请完成注册" },
  ];
}

export default function SystemSetup() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 从 URL 参数中获取 base64 编码的跳转地址
  const getRedirectUrl = (): string => {
    const redirectParam = searchParams.get("redirect");
    if (redirectParam) {
      try {
        // 解码 base64
        const decoded = atob(redirectParam);
        return decoded;
      } catch (err) {
        console.error("Failed to decode redirect URL:", err);
        return "/search";
      }
    }
    return "/search";
  };

  const handleSubmit = async (e: FormEvent, singleUserMode: boolean = false) => {
    e.preventDefault();
    setError(null);

    // 单用户模式不需要验证用户名和密码
    if (!singleUserMode) {
      // 验证输入
      if (!username.trim()) {
        setError("请输入用户名");
        return;
      }

      if (!password) {
        setError("请输入密码");
        return;
      }

      if (password !== confirmPassword) {
        setError("两次输入的密码不一致");
        return;
      }
    }

    setLoading(true);

    try {
      // 在前端使用 bcrypt 加密密码（如果不是单用户模式，salt 中包含 username）
      let passwordHash = "";
      if (!singleUserMode) {
        passwordHash = await hashPassword(password, username.trim());
      }

      // 调用 API
      const requestBody: {
        username: string;
        password_hash: string;
        single_user_mode: boolean;
      } = {
        username: singleUserMode ? "" : username.trim(),
        password_hash: passwordHash,
        single_user_mode: singleUserMode,
      };

      const response = await fetch("/api/system_setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`注册失败: ${response.statusText} - ${errorText}`);
      }

      // 注册成功，根据 URL 参数中的 base64 地址进行跳转
      const redirectUrl = getRedirectUrl();
      navigate(redirectUrl, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册时发生错误");
      console.error("System setup error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSingleUserMode = async (e: FormEvent) => {
    await handleSubmit(e, true);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            系统初始化
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            欢迎使用！请设置您的用户名和密码以完成系统初始化
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* 错误信息 */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">
                用户名
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="用户名"
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="密码"
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="sr-only">
                确认密码
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="确认密码"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "注册中..." : "完成注册"}
            </button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 text-gray-500">或</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSingleUserMode}
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "初始化中..." : "使用单用户模式初始化"}
            </button>
            <p className="text-xs text-center text-gray-500">
              单用户模式无需设置用户名和密码，适合个人使用
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
