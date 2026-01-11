import { Link, useLocation } from "react-router";
import { useState, useEffect } from "react";

interface WhoamiResponse {
  username: string;
  group: string[];
  single_user_mode: boolean;
}

export function Banner() {
  const location = useLocation();
  const [userInfo, setUserInfo] = useState<WhoamiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch("/api/whoami", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        if (response.ok) {
          const data: WhoamiResponse = await response.json();
          setUserInfo(data);
        }
      } catch (err) {
        console.error("Fetch user info error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  const navItems = [
    { path: "/", label: "主页" },
    { path: "/add-tv", label: "添加TV" },
    { path: "/series-list", label: "系列" },
    { path: "/downloads", label: "下载" },
    { path: "/errors", label: "错误日志" },
  ];

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                    }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center space-x-4">
            {loading ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                加载中...
              </div>
            ) : userInfo ? (
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {userInfo.username}
              </span>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                未登录
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
