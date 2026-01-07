import { useState, useEffect } from "react";
import type { Route } from "./+types/errors";

// 定义 API 响应类型
interface Error {
    id: number;
    timestamp: string;
    title: string;
    description: string;
    type: "error" | "critical";
}

interface GetErrorsResponse {
    errors: Error[];
}

interface RemoveErrorsRequest {
    ids: number[];
}

// 格式化时间戳
function formatTimestamp(timestamp: string): string {
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days} 天前`;
        } else if (hours > 0) {
            return `${hours} 小时前`;
        } else if (minutes > 0) {
            return `${minutes} 分钟前`;
        } else {
            return `${seconds} 秒前`;
        }
    } catch {
        return timestamp;
    }
}

// 格式化完整时间
function formatFullTime(timestamp: string): string {
    try {
        const date = new Date(timestamp);
        return date.toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    } catch {
        return timestamp;
    }
}

export function meta({ }: Route.MetaArgs) {
    return [
        { title: "错误列表" },
        { name: "description", content: "查看和管理系统错误" },
    ];
}

export default function Errors() {
    const [errors, setErrors] = useState<Error[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [removing, setRemoving] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(false);

    const fetchErrors = async () => {
        try {
            const response = await fetch("/api/get_errors", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            });

            if (!response.ok) {
                throw new Error(`获取错误列表失败: ${response.statusText}`);
            }

            const data: GetErrorsResponse = await response.json();
            setErrors(data.errors || []);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "获取错误列表时发生错误");
            console.error("Fetch errors error:", err);
        } finally {
            setLoading(false);
        }
    };

    // 初始加载和自动刷新
    useEffect(() => {
        fetchErrors();

        if (autoRefresh) {
            const interval = setInterval(fetchErrors, 3000); // 每3秒刷新一次
            return () => clearInterval(interval);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoRefresh]);

    const handleSelectAll = () => {
        if (selectedIds.size === errors.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(errors.map((e) => e.id)));
        }
    };

    const handleSelect = (id: number) => {
        setSelectedIds((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleRemove = async () => {
        if (selectedIds.size === 0) {
            return;
        }

        setRemoving(true);
        try {
            const request: RemoveErrorsRequest = {
                ids: Array.from(selectedIds),
            };

            const response = await fetch("/api/remove_errors", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                throw new Error(`删除错误失败: ${response.statusText}`);
            }

            // 删除成功后刷新列表
            setSelectedIds(new Set());
            await fetchErrors();
        } catch (err) {
            setError(err instanceof Error ? err.message : "删除错误时发生错误");
            console.error("Remove errors error:", err);
        } finally {
            setRemoving(false);
        }
    };

    const getErrorTypeColor = (type: string) => {
        switch (type) {
            case "critical":
                return {
                    bg: "bg-red-50",
                    border: "border-red-300",
                    text: "text-red-800",
                    badge: "bg-red-600",
                };
            case "error":
            default:
                return {
                    bg: "bg-orange-50",
                    border: "border-orange-300",
                    text: "text-orange-800",
                    badge: "bg-orange-600",
                };
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="container mx-auto px-4 max-w-6xl">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-bold text-gray-900">错误列表</h1>
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
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">自动刷新</span>
                        </label>
                        <button
                            onClick={fetchErrors}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? "刷新中..." : "手动刷新"}
                        </button>
                        {selectedIds.size > 0 && (
                            <button
                                onClick={handleRemove}
                                disabled={removing}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {removing ? "删除中..." : `删除 (${selectedIds.size})`}
                            </button>
                        )}
                    </div>
                </div>

                {/* 错误信息 */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        {error}
                    </div>
                )}

                {/* 错误列表 */}
                {errors.length === 0 && !loading ? (
                    <div className="text-center py-12 text-gray-500">
                        <p>当前没有错误记录</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {errors.length > 0 && (
                            <div className="flex items-center gap-4 mb-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={
                                            errors.length > 0 && selectedIds.size === errors.length
                                        }
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">
                                        全选 ({errors.length} 条)
                                    </span>
                                </label>
                            </div>
                        )}
                        {errors.map((errorItem) => {
                            const colors = getErrorTypeColor(errorItem.type);
                            const isSelected = selectedIds.has(errorItem.id);

                            return (
                                <div
                                    key={errorItem.id}
                                    className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-l-4 ${colors.border}`}
                                >
                                    <div className="flex items-start gap-4">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleSelect(errorItem.id)}
                                            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <h3 className="text-lg font-semibold text-gray-900">
                                                            {errorItem.title}
                                                        </h3>
                                                        <span
                                                            className={`px-2 py-1 text-xs font-medium text-white rounded ${colors.badge}`}
                                                        >
                                                            {errorItem.type === "critical" ? "严重" : "错误"}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        <span title={formatFullTime(errorItem.timestamp)}>
                                                            {formatTimestamp(errorItem.timestamp)}
                                                        </span>
                                                        <span className="mx-2">•</span>
                                                        <span>ID: {errorItem.id}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`mt-3 p-3 rounded ${colors.bg}`}>
                                                <p className={`text-sm ${colors.text} whitespace-pre-wrap`}>
                                                    {errorItem.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 加载状态 */}
                {loading && errors.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <p>加载中...</p>
                    </div>
                )}
            </div>
        </div>
    );
}

