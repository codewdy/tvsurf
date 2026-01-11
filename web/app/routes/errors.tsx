import { useState, useEffect } from "react";
import type { Route } from "./+types/errors";

// 定义错误类型
type ErrorType = "error" | "critical";

interface Error {
  id: number;
  timestamp: string; // ISO datetime string
  title: string;
  description: string;
  type: ErrorType;
}

interface GetErrorsResponse {
  errors: Error[];
}

interface RemoveErrorsRequest {
  ids: number[];
}

// 格式化时间
function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return "刚刚";
  } else if (diffMins < 60) {
    return `${diffMins}分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours}小时前`;
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "错误日志" },
    { name: "description", content: "查看系统错误日志" },
  ];
}

export default function Errors() {
  const [errors, setErrors] = useState<Error[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const fetchErrors = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/get_errors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: GetErrorsResponse = await response.json();
      // 按时间倒序排序，最新的在前
      const sortedErrors = [...(data.errors || [])].sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      setErrors(sortedErrors);
    } catch (err) {
      console.error("Fetch errors error:", err);
      setError(err instanceof Error ? err.message : "获取错误列表失败");
    } finally {
      setLoading(false);
    }
  };

  const removeErrors = async (ids: number[]) => {
    try {
      const response = await fetch("/api/remove_errors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids } as RemoveErrorsRequest),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // 重新获取错误列表
      await fetchErrors();
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Remove errors error:", err);
      setError(err instanceof Error ? err.message : "删除错误失败");
    }
  };

  useEffect(() => {
    fetchErrors();
  }, []);

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === errors.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(errors.map((e) => e.id)));
    }
  };

  const handleRemoveSelected = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`确定要删除选中的 ${selectedIds.size} 个错误吗？`)) {
      removeErrors(Array.from(selectedIds));
    }
  };

  const handleRemoveAll = () => {
    if (errors.length === 0) return;
    if (confirm(`确定要删除全部 ${errors.length} 个错误吗？`)) {
      removeErrors(errors.map((e) => e.id));
    }
  };

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          错误日志
        </h1>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleRemoveSelected}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              删除选中 ({selectedIds.size})
            </button>
          )}
          {errors.length > 0 && (
            <button
              onClick={handleRemoveAll}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              删除全部
            </button>
          )}
        </div>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* 错误列表 */}
      {errors.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>当前没有错误记录</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 全选控制 */}
          <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <input
              type="checkbox"
              checked={selectedIds.size === errors.length && errors.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              全选 ({selectedIds.size}/{errors.length})
            </span>
          </div>

          {errors.map((error) => {
            const isExpanded = expandedIds.has(error.id);
            return (
              <div
                key={error.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-l-4 ${error.type === "critical"
                  ? "border-red-500"
                  : "border-orange-500"
                  }`}
              >
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(error.id)}
                    onChange={() => toggleSelect(error.id)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1">
                        <h3
                          onClick={() => toggleExpand(error.id)}
                          className="text-lg font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {error.title}
                        </h3>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${error.type === "critical"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                            }`}
                        >
                          {error.type === "critical" ? "严重" : "错误"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDateTime(error.timestamp)}
                        </span>
                      </div>
                    </div>
                    {isExpanded && (
                      <>
                        <div className="mt-2">
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                            {error.description}
                          </p>
                        </div>
                        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                          ID: {error.id} | 时间: {new Date(error.timestamp).toLocaleString("zh-CN")}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
