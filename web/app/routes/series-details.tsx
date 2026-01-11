import { useState, useEffect } from "react";
import type { Route } from "./+types/series-details";
import TVCard, { type TVInfo } from "../components/TVCard";

// 定义类型
type Tag = "watching" | "wanted" | "watched" | "on_hold" | "not_tagged";

interface Series {
  id: number;
  name: string;
  tvs: number[];
  last_update: string; // ISO datetime string
}

interface GetSeriesResponse {
  series: Series[];
}

interface GetTVInfosResponse {
  tvs: TVInfo[];
}

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "系列详情" },
    { name: "description", content: "系列详情和编辑" },
  ];
}

export default function SeriesDetails({ params }: Route.ComponentProps) {
  const id = params?.id;
  const [series, setSeries] = useState<Series | null>(null);
  const [tvInfos, setTVInfos] = useState<TVInfo[]>([]);
  const [allTVInfos, setAllTVInfos] = useState<TVInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTVs, setSelectedTVs] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");

  // 获取系列和 TV 信息
  const fetchSeriesDetails = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      const seriesId = parseInt(id);
      if (isNaN(seriesId)) {
        throw new Error("无效的系列 ID");
      }

      // 获取系列信息
      const seriesResponse = await fetch("/api/get_series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: [seriesId] }),
      });

      if (!seriesResponse.ok) {
        throw new Error(`HTTP error! status: ${seriesResponse.status}`);
      }

      const seriesData: GetSeriesResponse = await seriesResponse.json();
      if (seriesData.series.length === 0) {
        throw new Error("系列不存在");
      }

      const seriesInfo = seriesData.series[0];
      setSeries(seriesInfo);
      setSelectedTVs(seriesInfo.tvs);

      // 获取该系列的 TV 信息
      if (seriesInfo.tvs.length > 0) {
        const tvResponse = await fetch("/api/get_tv_infos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids: seriesInfo.tvs }),
        });

        if (!tvResponse.ok) {
          throw new Error(`HTTP error! status: ${tvResponse.status}`);
        }

        const tvData: GetTVInfosResponse = await tvResponse.json();
        setTVInfos(tvData.tvs);
      } else {
        setTVInfos([]);
      }

      // 获取所有 TV 信息（用于编辑）
      const allTVResponse = await fetch("/api/get_tv_infos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: null }),
      });

      if (!allTVResponse.ok) {
        throw new Error(`HTTP error! status: ${allTVResponse.status}`);
      }

      const allTVData: GetTVInfosResponse = await allTVResponse.json();
      setAllTVInfos(allTVData.tvs);
    } catch (err) {
      console.error("Fetch series details error:", err);
      setError(err instanceof Error ? err.message : "获取系列详情失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeriesDetails();
  }, [id]);

  // 切换编辑模式
  const handleEdit = () => {
    if (series) {
      setSelectedTVs(series.tvs);
      setIsEditing(true);
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    if (series) {
      setSelectedTVs(series.tvs);
      setIsEditing(false);
      setSearchKeyword("");
    }
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!series || saving) return;

    try {
      setSaving(true);
      setError(null);

      const response = await fetch("/api/update_series_tvs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: series.id,
          tvs: selectedTVs,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`更新失败: ${response.statusText} - ${errorText}`);
      }

      // 刷新数据
      await fetchSeriesDetails();
      setIsEditing(false);
      setSearchKeyword("");
    } catch (err) {
      console.error("Update series TVs error:", err);
      setError(err instanceof Error ? err.message : "更新系列失败");
    } finally {
      setSaving(false);
    }
  };

  // 切换 TV 选择
  const toggleTV = (tvId: number) => {
    setSelectedTVs((prev) => {
      if (prev.includes(tvId)) {
        return prev.filter((id) => id !== tvId);
      } else {
        return [...prev, tvId];
      }
    });
  };

  // 移动 TV 位置
  const moveTVForward = (tvId: number) => {
    setSelectedTVs((prev) => {
      const index = prev.indexOf(tvId);
      if (index === -1 || index === 0) return prev;
      const newTVs = [...prev];
      [newTVs[index - 1], newTVs[index]] = [newTVs[index], newTVs[index - 1]];
      return newTVs;
    });
  };

  const moveTVBackward = (tvId: number) => {
    setSelectedTVs((prev) => {
      const index = prev.indexOf(tvId);
      if (index === -1 || index === prev.length - 1) return prev;
      const newTVs = [...prev];
      [newTVs[index], newTVs[index + 1]] = [newTVs[index + 1], newTVs[index]];
      return newTVs;
    });
  };

  const moveTVToFirst = (tvId: number) => {
    setSelectedTVs((prev) => {
      const index = prev.indexOf(tvId);
      if (index === -1 || index === 0) return prev;
      const newTVs = [...prev];
      newTVs.splice(index, 1);
      newTVs.unshift(tvId);
      return newTVs;
    });
  };

  const moveTVToLast = (tvId: number) => {
    setSelectedTVs((prev) => {
      const index = prev.indexOf(tvId);
      if (index === -1 || index === prev.length - 1) return prev;
      const newTVs = [...prev];
      newTVs.splice(index, 1);
      newTVs.push(tvId);
      return newTVs;
    });
  };

  // 过滤 TV 列表
  const filteredAllTVs = allTVInfos.filter((tv) =>
    tv.name.toLowerCase().includes(searchKeyword.toLowerCase())
  );

  // 已选 TV 列表（按照 selectedTVs 的顺序）
  const tvMap = new Map(allTVInfos.map((tv) => [tv.id, tv]));
  const selectedTVInfos = selectedTVs
    .map((id) => tvMap.get(id))
    .filter((tv): tv is TVInfo => tv !== undefined);

  // 可用 TV 列表（未选中的）
  const availableTVInfos = filteredAllTVs.filter(
    (tv) => !selectedTVs.includes(tv.id)
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-600 dark:text-red-400">
          错误: {error || "系列不存在"}
        </div>
        <div className="text-center mt-4">
          <a
            href="/series-list"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            返回系列列表
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 头部 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <a
              href="/series-list"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              ← 返回系列列表
            </a>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {series.name}
            </h1>
          </div>
          {!isEditing ? (
            <button
              onClick={handleEdit}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
            >
              编辑
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* 编辑模式 */}
      {isEditing ? (
        <div className="space-y-6">
          {/* 搜索框 */}
          <div>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="搜索 TV..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* 穿梭框布局 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 可用 TV */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  可用 TV
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {availableTVInfos.length} 个
                </span>
              </div>
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 max-h-[600px] overflow-y-auto">
                {availableTVInfos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 gap-3">
                    {availableTVInfos.map((tv) => (
                      <div
                        key={tv.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleTV(tv.id);
                        }}
                        className="cursor-pointer [&_a]:pointer-events-none"
                        style={{ pointerEvents: "auto" }}
                      >
                        <TVCard tv={tv} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                    无可用 TV
                  </div>
                )}
              </div>
            </div>

            {/* 已选 TV */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  已选 TV
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedTVInfos.length} 个
                </span>
              </div>
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 max-h-[600px] overflow-y-auto">
                {selectedTVInfos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 gap-3">
                    {selectedTVInfos.map((tv, index) => {
                      const isFirst = index === 0;
                      const isLast = index === selectedTVInfos.length - 1;
                      return (
                        <div
                          key={tv.id}
                          className="relative group"
                        >
                          <div
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleTV(tv.id);
                            }}
                            className="cursor-pointer relative [&_a]:pointer-events-none"
                            style={{ pointerEvents: "auto" }}
                          >
                            <div className="absolute top-2 right-2 z-10 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                              ✓
                            </div>
                            <TVCard tv={tv} />
                          </div>
                          {/* 左侧控制按钮 */}
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                moveTVForward(tv.id);
                              }}
                              disabled={isFirst}
                              className="px-3 py-2 bg-blue-600 text-white text-xl font-bold rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                              title="向前移动一格"
                            >
                              ←
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                moveTVToFirst(tv.id);
                              }}
                              disabled={isFirst}
                              className="px-3 py-2 bg-blue-600 text-white text-xl font-bold rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                              title="放到最前"
                            >
                              ⇐
                            </button>
                          </div>
                          {/* 右侧控制按钮 */}
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                moveTVBackward(tv.id);
                              }}
                              disabled={isLast}
                              className="px-3 py-2 bg-blue-600 text-white text-xl font-bold rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                              title="向后移动一格"
                            >
                              →
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                moveTVToLast(tv.id);
                              }}
                              disabled={isLast}
                              className="px-3 py-2 bg-blue-600 text-white text-xl font-bold rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                              title="放到最后"
                            >
                              ⇒
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                    未选择 TV
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 查看模式 */
        <div>
          <div className="mb-4">
            <p className="text-gray-600 dark:text-gray-400">
              包含 {tvInfos.length} 个 TV
            </p>
          </div>
          {tvInfos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {tvInfos.map((tv) => (
                <TVCard key={tv.id} tv={tv} showBadge={false} />
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-12">
              该系列暂无 TV
            </div>
          )}
        </div>
      )}
    </div>
  );
}
