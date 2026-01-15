import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import type { Route } from "./+types/user";
import { useNavigate } from "react-router";
import { whoami, setMyPassword } from "../api/client";
import type { WhoamiRequest, WhoamiResponse, SetMyPasswordRequest } from "../api/types";
import { hashPassword } from "../utils/password";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "用户信息" },
    { name: "description", content: "查看当前用户信息" },
  ];
}

export default function User() {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState<WhoamiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 修改密码相关状态
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const fetchUserInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      const data: WhoamiResponse = await whoami({});
      setUserInfo(data);
    } catch (err) {
      console.error("Fetch user info error:", err);
      setError(err instanceof Error ? err.message : "获取用户信息失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    // 验证输入
    if (!newPassword) {
      setPasswordError("请输入新密码");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("新密码和确认密码不一致");
      return;
    }

    if (!userInfo) {
      setPasswordError("用户信息未加载");
      return;
    }

    // 确认操作
    if (!confirm("确定要修改密码吗？")) {
      return;
    }

    setChangingPassword(true);

    try {
      // 使用新密码和用户名生成密码哈希
      const passwordHash = await hashPassword(newPassword, userInfo.username);

      // 调用 API
      const request: SetMyPasswordRequest = { password_hash: passwordHash };
      await setMyPassword(request);

      setPasswordSuccess("密码修改成功！");
      // 清空表单
      setNewPassword("");
      setConfirmPassword("");
      // 3秒后清除成功消息
      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (err) {
      console.error("Change password error:", err);
      setPasswordError(err instanceof Error ? err.message : "修改密码失败");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    if (confirm("确定要登出吗？")) {
      // 清除 cookie 中的 token
      document.cookie = "tvsurf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      // 跳转到登录页面
      navigate("/login", { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
        <button
          onClick={fetchUserInfo}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  if (!userInfo) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>未找到用户信息</p>
        </div>
      </div>
    );
  }

  // 权限组显示名称映射
  const groupNames: Record<string, string> = {
    user: "普通用户",
    admin: "管理员",
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          用户信息
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          查看当前登录用户的相关信息
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="space-y-6">
          {/* 用户名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              用户名
            </label>
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-gray-100">
              {userInfo.username}
            </div>
          </div>

          {/* 权限组 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              权限组
            </label>
            <div className="flex flex-wrap gap-2">
              {userInfo.group.map((group) => (
                <span
                  key={group}
                  className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium"
                >
                  {groupNames[group] || group}
                </span>
              ))}
            </div>
          </div>

          {/* 用户模式 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              用户模式
            </label>
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${userInfo.single_user_mode
                  ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                  : "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                  }`}
              >
                {userInfo.single_user_mode ? "单用户模式" : "多用户模式"}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {userInfo.single_user_mode
                ? "系统运行在单用户模式下，所有用户共享同一账户"
                : "系统运行在多用户模式下，每个用户拥有独立的账户"}
            </p>
          </div>
        </div>
      </div>

      {/* 修改密码表单（仅多用户模式） */}
      {!userInfo.single_user_mode && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            修改密码
          </h2>

          {/* 错误信息 */}
          {passwordError && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
              {passwordError}
            </div>
          )}

          {/* 成功信息 */}
          {passwordSuccess && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400">
              {passwordSuccess}
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                新密码
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入新密码"
                disabled={changingPassword}
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                确认新密码
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请再次输入新密码"
                disabled={changingPassword}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={changingPassword}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {changingPassword ? "修改中..." : "修改密码"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 登出按钮 */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
        >
          登出
        </button>
      </div>
    </div>
  );
}
