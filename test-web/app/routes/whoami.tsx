import { useState, useEffect } from "react";
import type { Route } from "./+types/whoami";

// 定义 API 响应类型
interface WhoamiResponse {
  username: string;
  group: string[];
  single_user_mode: boolean;
}

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "用户信息" },
    { name: "description", content: "查看当前用户信息" },
  ];
}

export default function Whoami() {
  const [userInfo, setUserInfo] = useState<WhoamiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch("/api/whoami", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // 包含 cookie
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("未授权，请先登录");
          }
          const errorText = await response.text();
          throw new Error(`获取用户信息失败: ${response.statusText} - ${errorText}`);
        }

        const data: WhoamiResponse = await response.json();
        setUserInfo(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "获取用户信息时发生错误");
        console.error("Fetch user info error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">用户信息</h1>
          <div className="flex gap-4">
            <a
              href="/search"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-sm"
            >
              搜索电视剧
            </a>
            <a
              href="/downloads"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors text-sm"
            >
              下载进度
            </a>
          </div>
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="text-center py-12 text-gray-500">
            <p>加载中...</p>
          </div>
        )}

        {/* 用户信息 */}
        {!loading && userInfo && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="space-y-6">
              {/* 用户名 */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  用户名
                </label>
                <div className="text-lg font-semibold text-gray-900">
                  {userInfo.username}
                </div>
              </div>

              {/* 用户组 */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  用户组
                </label>
                <div className="flex flex-wrap gap-2">
                  {userInfo.group && userInfo.group.length > 0 ? (
                    userInfo.group.map((group, index) => (
                      <span
                        key={index}
                        className={`px-3 py-1 rounded-full text-sm font-medium ${group === "admin"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-blue-100 text-blue-800"
                          }`}
                      >
                        {group}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500 text-sm">无</span>
                  )}
                </div>
              </div>

              {/* 单用户模式 */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  运行模式
                </label>
                <div className="flex items-center gap-2">
                  {userInfo.single_user_mode ? (
                    <>
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        单用户模式
                      </span>
                      <span className="text-sm text-gray-600">
                        系统运行在单用户模式下，无需密码即可访问
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        多用户模式
                      </span>
                      <span className="text-sm text-gray-600">
                        系统运行在多用户模式下，需要用户名和密码登录
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 未登录提示 */}
        {!loading && !userInfo && !error && (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <p className="text-gray-500">未获取到用户信息</p>
            <a
              href="/system_setup"
              className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              前往系统设置
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
