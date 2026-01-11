import { useState } from "react";
import type { FormEvent } from "react";
import type { Route } from "./+types/login";
import { useNavigate, useSearchParams } from "react-router";
import { hashPassword } from "../utils/password";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "用户登录" },
    { name: "description", content: "登录系统" },
  ];
}

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        return "/";
      }
    }
    return "/";
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // 验证输入
    if (!username.trim()) {
      setError("请输入用户名");
      return;
    }

    if (!password) {
      setError("请输入密码");
      return;
    }

    setLoading(true);

    try {
      // 在前端使用 bcrypt 加密密码（salt 中包含 username）
      const passwordHash = await hashPassword(password, username.trim());

      // 调用 API
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // 包含 cookie
        body: JSON.stringify({
          username: username.trim(),
          password_hash: passwordHash,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("用户名或密码错误");
        }
        const errorText = await response.text();
        throw new Error(`登录失败: ${response.statusText} - ${errorText}`);
      }

      // 登录成功，根据 URL 参数中的 base64 地址进行跳转
      const redirectUrl = getRedirectUrl();
      navigate(redirectUrl, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录时发生错误");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            用户登录
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            请输入您的用户名和密码登录系统
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
                autoComplete="username"
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="密码"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "登录中..." : "登录"}
            </button>
          </div>

          <div className="text-center">
            <a
              href="/system-setup"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              首次使用？前往系统初始化
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
