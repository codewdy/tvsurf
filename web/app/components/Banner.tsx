import { Link, useLocation } from "react-router";
import { useState, useEffect } from "react";

interface WhoamiResponse {
  user: {
    username: string;
    group: string[];
  };
  single_user_mode: boolean;
}

interface GetMonitorResponse {
  download_count: number;
  error_count: number;
}

export function Banner() {
  const location = useLocation();
  const [userInfo, setUserInfo] = useState<WhoamiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [monitor, setMonitor] = useState<GetMonitorResponse>({
    download_count: 0,
    error_count: 0,
  });

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

  useEffect(() => {
    const fetchMonitor = async () => {
      try {
        const response = await fetch("/api/get_monitor", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        if (response.ok) {
          const data: GetMonitorResponse = await response.json();
          setMonitor(data);
        }
      } catch (err) {
        console.error("Fetch monitor error:", err);
      }
    };

    // 立即调用一次
    fetchMonitor();

    // 每10秒调用一次
    const interval = setInterval(fetchMonitor, 10000);
    return () => clearInterval(interval);
  }, []);

  const allNavItems = [
    { path: "/", label: "主页", badge: undefined, badgeColor: undefined, requireAdmin: false },
    { path: "/add-tv", label: "添加TV", badge: undefined, badgeColor: undefined, requireAdmin: false },
    { path: "/series-list", label: "系列", badge: undefined, badgeColor: undefined, requireAdmin: false },
    { path: "/downloads", label: "下载", badge: monitor.download_count, badgeColor: "bg-blue-500", requireAdmin: false },
    { path: "/errors", label: "错误日志", badge: monitor.error_count, badgeColor: "bg-red-500", requireAdmin: false },
    { path: "/config", label: "系统配置", badge: undefined, badgeColor: undefined, requireAdmin: true },
    { path: "/user-management", label: "用户管理", badge: undefined, badgeColor: undefined, requireAdmin: true },
  ];

  // 根据用户权限过滤导航项
  const navItems = allNavItems.filter((item) => {
    // 如果是单用户模式，不显示用户管理
    if (item.path === "/user-management" && userInfo?.single_user_mode) {
      return false;
    }
    if (item.requireAdmin) {
      // 需要admin权限的项，检查用户是否在admin group中
      return userInfo?.user?.group?.includes("admin") ?? false;
    }
    return true; // 不需要admin权限的项，始终显示
  });

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
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors relative ${isActive
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                    }`}
                >
                  {item.label}
                  {item.badge !== undefined && item.badge > 0 && item.badgeColor && (
                    <span className={`absolute -top-1 -right-1 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center min-w-[1.25rem] ${item.badgeColor}`}>
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
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
              <Link
                to="/user"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname === "/user"
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                  }`}
              >
                {userInfo.user.username}
              </Link>
            ) : (
              <Link
                to="/login"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname === "/login"
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                  }`}
              >
                登录
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
