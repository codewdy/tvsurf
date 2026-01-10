import { useState, useEffect } from "react";
import type { Route } from "./+types/series";

// 定义 API 响应类型
interface TVInfo {
  id: number;
  name: string;
  series: number[];
}

interface Series {
  id: number;
  name: string;
  tvs: number[];
}

interface GetSeriesResponse {
  series: Series[];
}

interface GetTVInfosResponse {
  tvs: TVInfo[];
}

interface AddSeriesRequest {
  name: string;
}

interface AddSeriesResponse {
  id: number;
}

interface RemoveSeriesRequest {
  id: number;
}

interface UpdateSeriesTVsRequest {
  id: number;
  tvs: number[];
}

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "系列管理" },
    { name: "description", content: "管理电视剧系列" },
  ];
}

export default function Series() {
  const [series, setSeries] = useState<Series[]>([]);
  const [tvs, setTvs] = useState<TVInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSeries, setEditingSeries] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingTVs, setEditingTVs] = useState<number[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  const fetchSeries = async () => {
    try {
      const response = await fetch("/api/get_series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`获取系列列表失败: ${response.statusText}`);
      }

      const data: GetSeriesResponse = await response.json();
      setSeries(data.series || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取系列列表时发生错误");
      console.error("Fetch series error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTVs = async () => {
    try {
      const response = await fetch("/api/get_tv_infos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`获取电视剧列表失败: ${response.statusText}`);
      }

      const data: GetTVInfosResponse = await response.json();
      setTvs(data.tvs || []);
    } catch (err) {
      console.error("Fetch TVs error:", err);
    }
  };

  useEffect(() => {
    fetchSeries();
    fetchTVs();
  }, []);

  const handleCreateSeries = async () => {
    if (!newSeriesName.trim()) {
      setError("系列名称不能为空");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const request: AddSeriesRequest = {
        name: newSeriesName.trim(),
      };

      const response = await fetch("/api/add_series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`创建系列失败: ${response.statusText}`);
      }

      setNewSeriesName("");
      setShowCreateModal(false);
      await fetchSeries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建系列时发生错误");
      console.error("Create series error:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleStartEdit = (seriesItem: Series) => {
    setEditingSeries(seriesItem.id);
    setEditingName(seriesItem.name);
    setEditingTVs([...seriesItem.tvs]);
  };

  const handleCancelEdit = () => {
    setEditingSeries(null);
    setEditingName("");
    setEditingTVs([]);
  };

  const handleSaveEdit = async () => {
    if (editingSeries === null) return;

    setSaving(true);
    setError(null);
    try {
      // 更新 TV 列表
      const updateRequest: UpdateSeriesTVsRequest = {
        id: editingSeries,
        tvs: editingTVs,
      };

      const updateResponse = await fetch("/api/update_series_tvs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateRequest),
      });

      if (!updateResponse.ok) {
        throw new Error(`更新系列失败: ${updateResponse.statusText}`);
      }

      // 刷新列表
      await fetchSeries();
      handleCancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存系列时发生错误");
      console.error("Save series error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSeries = async (id: number) => {
    if (!confirm("确定要删除这个系列吗？")) {
      return;
    }

    setRemoving(id);
    setError(null);
    try {
      const request: RemoveSeriesRequest = { id };

      const response = await fetch("/api/remove_series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`删除系列失败: ${response.statusText}`);
      }

      await fetchSeries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除系列时发生错误");
      console.error("Remove series error:", err);
    } finally {
      setRemoving(null);
    }
  };

  const handleToggleTV = (tvId: number) => {
    setEditingTVs((prev) => {
      if (prev.includes(tvId)) {
        return prev.filter((id) => id !== tvId);
      } else {
        return [...prev, tvId];
      }
    });
  };

  const getTVById = (id: number): TVInfo | undefined => {
    return tvs.find((tv) => tv.id === id);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900">系列管理</h1>
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
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors"
          >
            创建系列
          </button>
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* 创建系列模态框 */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">创建新系列</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  系列名称
                </label>
                <input
                  type="text"
                  value={newSeriesName}
                  onChange={(e) => setNewSeriesName(e.target.value)}
                  placeholder="输入系列名称..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreateSeries();
                    } else if (e.key === "Escape") {
                      setShowCreateModal(false);
                      setNewSeriesName("");
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewSeriesName("");
                  }}
                  disabled={creating}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateSeries}
                  disabled={creating || !newSeriesName.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? "创建中..." : "创建"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 系列列表 */}
        {series.length === 0 && !loading ? (
          <div className="text-center py-12 text-gray-500">
            <p>当前没有系列，点击"创建系列"按钮开始创建</p>
          </div>
        ) : (
          <div className="space-y-4">
            {series.map((seriesItem) => {
              const isEditing = editingSeries === seriesItem.id;
              const isRemoving = removing === seriesItem.id;

              return (
                <div
                  key={seriesItem.id}
                  className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                >
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          系列名称
                        </label>
                        <input
                          type="text"
                          value={editingName}
                          disabled
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          注意：系列名称暂时无法修改
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          包含的电视剧 ({editingTVs.length} 部)
                        </label>
                        <div className="border border-gray-300 rounded-lg p-4 max-h-64 overflow-y-auto">
                          {tvs.length === 0 ? (
                            <p className="text-sm text-gray-500">暂无电视剧</p>
                          ) : (
                            <div className="space-y-2">
                              {tvs.map((tv) => {
                                const isSelected = editingTVs.includes(tv.id);
                                return (
                                  <label
                                    key={tv.id}
                                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleToggleTV(tv.id)}
                                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                    />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-900">{tv.name}</p>
                                      <p className="text-xs text-gray-500">
                                        包含在 {tv.series.length} 个系列中
                                      </p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={handleCancelEdit}
                          disabled={saving}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          取消
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          disabled={saving || !editingName.trim()}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {saving ? "保存中..." : "保存"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {seriesItem.name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            包含 {seriesItem.tvs.length} 部电视剧
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleStartEdit(seriesItem)}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-sm"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleRemoveSeries(seriesItem.id)}
                            disabled={isRemoving}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                          >
                            {isRemoving ? "删除中..." : "删除"}
                          </button>
                        </div>
                      </div>
                      {seriesItem.tvs.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">电视剧列表</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {seriesItem.tvs.map((tvId) => {
                              const tv = getTVById(tvId);
                              if (!tv) {
                                return (
                                  <div
                                    key={tvId}
                                    className="p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-500"
                                  >
                                    TV ID: {tvId} (未找到)
                                  </div>
                                );
                              }
                              return (
                                <div
                                  key={tvId}
                                  className="p-3 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                                >
                                  <p className="text-sm font-medium text-gray-900">{tv.name}</p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    ID: {tv.id}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 加载状态 */}
        {loading && series.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>加载中...</p>
          </div>
        )}
      </div>
    </div>
  );
}
