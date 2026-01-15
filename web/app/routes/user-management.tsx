import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import type { Route } from "./+types/user-management";
import {
  getUsers,
  addUser,
  removeUser,
  updateUserGroup,
  setUserPassword,
  whoami,
} from "../api/client";
import type {
  GetUsersResponse,
  AddUserRequest,
  RemoveUserRequest,
  UpdateUserGroupRequest,
  SetUserPasswordRequest,
  UserInfo,
  WhoamiResponse,
} from "../api/types";
import { hashPassword } from "../utils/password";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "用户管理" },
    { name: "description", content: "管理系统用户" },
  ];
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [singleUserMode, setSingleUserMode] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 添加用户相关状态
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newConfirmPassword, setNewConfirmPassword] = useState("");
  const [newUserGroups, setNewUserGroups] = useState<string[]>(["user"]);
  const [addingUser, setAddingUser] = useState(false);

  // 编辑用户相关状态
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editingGroups, setEditingGroups] = useState<string[]>([]);
  const [updatingGroups, setUpdatingGroups] = useState(false);

  // 重置密码相关状态
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);
  const [newPasswordForUser, setNewPasswordForUser] = useState("");
  const [confirmPasswordForUser, setConfirmPasswordForUser] = useState("");
  const [resetting, setResetting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const data: GetUsersResponse = await getUsers({});
      setUsers(data.users);
      setSingleUserMode(data.single_user_mode);
    } catch (err) {
      console.error("Fetch users error:", err);
      setError(err instanceof Error ? err.message : "获取用户列表失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const data: WhoamiResponse = await whoami({});
      setCurrentUsername(data.user.username);
    } catch (err) {
      console.error("Fetch current user error:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchCurrentUser();
  }, []);

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // 验证输入
    if (!newUsername.trim()) {
      setError("请输入用户名");
      return;
    }

    if (!newPassword) {
      setError("请输入密码");
      return;
    }

    if (newPassword !== newConfirmPassword) {
      setError("密码和确认密码不一致");
      return;
    }

    if (newUserGroups.length === 0) {
      setError("至少选择一个用户组");
      return;
    }

    setAddingUser(true);

    try {
      const passwordHash = await hashPassword(newPassword, newUsername);
      const request: AddUserRequest = {
        username: newUsername.trim(),
        password_hash: passwordHash,
        group: newUserGroups,
      };
      await addUser(request);

      setSuccess("用户添加成功！");
      setNewUsername("");
      setNewPassword("");
      setNewConfirmPassword("");
      setNewUserGroups(["user"]);
      setShowAddUser(false);
      await fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Add user error:", err);
      setError(err instanceof Error ? err.message : "添加用户失败");
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveUser = async (username: string) => {
    if (username === currentUsername) {
      setError("不能删除当前用户");
      return;
    }
    if (!confirm(`确定要删除用户 "${username}" 吗？此操作不可恢复。`)) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      const request: RemoveUserRequest = { username };
      await removeUser(request);

      setSuccess("用户删除成功！");
      await fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Remove user error:", err);
      setError(err instanceof Error ? err.message : "删除用户失败");
    }
  };

  const handleStartEditGroups = (user: UserInfo) => {
    if (user.username === currentUsername) {
      setError("不能编辑当前用户的权限组");
      return;
    }
    setEditingUser(user.username);
    setEditingGroups([...user.group]);
  };

  const handleCancelEditGroups = () => {
    setEditingUser(null);
    setEditingGroups([]);
  };

  const handleUpdateGroups = async (username: string) => {
    if (editingGroups.length === 0) {
      setError("至少选择一个用户组");
      return;
    }

    setUpdatingGroups(true);

    try {
      setError(null);
      setSuccess(null);

      const request: UpdateUserGroupRequest = {
        username,
        group: editingGroups,
      };
      await updateUserGroup(request);

      setSuccess("用户组更新成功！");
      setEditingUser(null);
      setEditingGroups([]);
      await fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Update user group error:", err);
      setError(err instanceof Error ? err.message : "更新用户组失败");
    } finally {
      setUpdatingGroups(false);
    }
  };

  const handleStartResetPassword = (username: string) => {
    if (username === currentUsername) {
      setError("不能重置当前用户的密码，请前往用户信息页面修改");
      return;
    }
    setResettingPassword(username);
    setNewPasswordForUser("");
    setConfirmPasswordForUser("");
  };

  const handleCancelResetPassword = () => {
    setResettingPassword(null);
    setNewPasswordForUser("");
    setConfirmPasswordForUser("");
  };

  const handleResetPassword = async (username: string) => {
    if (!newPasswordForUser) {
      setError("请输入新密码");
      return;
    }

    if (newPasswordForUser !== confirmPasswordForUser) {
      setError("密码和确认密码不一致");
      return;
    }

    setResetting(true);

    try {
      setError(null);
      setSuccess(null);

      const passwordHash = await hashPassword(newPasswordForUser, username);
      const request: SetUserPasswordRequest = {
        username,
        password_hash: passwordHash,
      };
      await setUserPassword(request);

      setSuccess("密码重置成功！");
      setResettingPassword(null);
      setNewPasswordForUser("");
      setConfirmPasswordForUser("");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Reset password error:", err);
      setError(err instanceof Error ? err.message : "重置密码失败");
    } finally {
      setResetting(false);
    }
  };

  const toggleGroup = (groups: string[], group: string) => {
    if (groups.includes(group)) {
      return groups.filter((g) => g !== group);
    } else {
      return [...groups, group];
    }
  };

  // 权限组显示名称映射
  const groupNames: Record<string, string> = {
    user: "普通用户",
    admin: "管理员",
  };

  // 所有可用的权限组
  const availableGroups = ["user", "admin"];

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  if (error && !success) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
        <button
          onClick={fetchUsers}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  // 单用户模式下显示提示
  if (singleUserMode) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            用户管理
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            管理系统用户
          </p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-yellow-700 dark:text-yellow-400">
          <p>系统运行在单用户模式下，无法进行用户管理操作。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            用户管理
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            管理系统用户
          </p>
        </div>
        <button
          onClick={() => setShowAddUser(!showAddUser)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          {showAddUser ? "取消" : "添加用户"}
        </button>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* 成功信息 */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400">
          {success}
        </div>
      )}

      {/* 添加用户表单 */}
      {showAddUser && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            添加新用户
          </h2>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div>
              <label
                htmlFor="newUsername"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                用户名
              </label>
              <input
                id="newUsername"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入用户名"
                disabled={addingUser}
              />
            </div>

            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                密码
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入密码"
                disabled={addingUser}
              />
            </div>

            <div>
              <label
                htmlFor="newConfirmPassword"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                确认密码
              </label>
              <input
                id="newConfirmPassword"
                type="password"
                value={newConfirmPassword}
                onChange={(e) => setNewConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请再次输入密码"
                disabled={addingUser}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                权限组
              </label>
              <div className="flex flex-wrap gap-2">
                {availableGroups.map((group) => (
                  <label
                    key={group}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={newUserGroups.includes(group)}
                      onChange={() =>
                        setNewUserGroups(toggleGroup(newUserGroups, group))
                      }
                      disabled={addingUser}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {groupNames[group] || group}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={addingUser}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingUser ? "添加中..." : "添加用户"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 用户列表 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  用户名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  权限组
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    暂无用户
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isCurrentUser = user.username === currentUsername;
                  return (
                    <tr key={user.username}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        <div className="flex items-center gap-2">
                          {user.username}
                          {isCurrentUser && (
                            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-xs font-medium">
                              当前用户
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingUser === user.username ? (
                          <div className="flex flex-wrap gap-2">
                            {availableGroups.map((group) => (
                              <label
                                key={group}
                                className="flex items-center space-x-2 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={editingGroups.includes(group)}
                                  onChange={() =>
                                    setEditingGroups(
                                      toggleGroup(editingGroups, group)
                                    )
                                  }
                                  disabled={updatingGroups}
                                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {groupNames[group] || group}
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {user.group.map((group) => (
                              <span
                                key={group}
                                className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium"
                              >
                                {groupNames[group] || group}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {editingUser === user.username ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleUpdateGroups(user.username)}
                              disabled={updatingGroups}
                              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                            >
                              {updatingGroups ? "保存中..." : "保存"}
                            </button>
                            <button
                              onClick={handleCancelEditGroups}
                              disabled={updatingGroups}
                              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                            >
                              取消
                            </button>
                          </div>
                        ) : resettingPassword === user.username ? (
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex gap-2">
                              <input
                                type="password"
                                value={newPasswordForUser}
                                onChange={(e) =>
                                  setNewPasswordForUser(e.target.value)
                                }
                                placeholder="新密码"
                                disabled={resetting}
                                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <input
                                type="password"
                                value={confirmPasswordForUser}
                                onChange={(e) =>
                                  setConfirmPasswordForUser(e.target.value)
                                }
                                placeholder="确认密码"
                                disabled={resetting}
                                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleResetPassword(user.username)}
                                disabled={resetting}
                                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                              >
                                {resetting ? "重置中..." : "确认"}
                              </button>
                              <button
                                onClick={handleCancelResetPassword}
                                disabled={resetting}
                                className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            {isCurrentUser ? (
                              <span className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400">
                                无法编辑当前用户
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleStartEditGroups(user)}
                                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-xs"
                                >
                                  编辑组
                                </button>
                                <button
                                  onClick={() => handleStartResetPassword(user.username)}
                                  className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors text-xs"
                                >
                                  重置密码
                                </button>
                                <button
                                  onClick={() => handleRemoveUser(user.username)}
                                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-xs"
                                >
                                  删除
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
