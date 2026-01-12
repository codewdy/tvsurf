import { useState, useEffect } from "react";
import type { Route } from "./+types/series-list";
import { getSeries, getTVInfos, addSeries, removeSeries } from "../api/client";
import type {
  Series,
  GetSeriesResponse,
  TVInfo,
  GetTVInfosResponse,
} from "../api/types";

interface SeriesWithTVs extends Series {
  tvInfos: TVInfo[];
}

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "系列列表" },
    { name: "description", content: "所有系列列表" },
  ];
}

export default function SeriesList() {
  const [seriesList, setSeriesList] = useState<SeriesWithTVs[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddSeriesModal, setShowAddSeriesModal] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Set<number>>(new Set());
  const [searchKeyword, setSearchKeyword] = useState("");

  // 获取系列列表和 TV 信息
  const fetchSeries = async () => {
    try {
      setLoading(true);
      setError(null);

      // 获取系列列表
      const seriesData = await getSeries({ ids: null });

      // 收集所有 TV ID
      const allTVIds = new Set<number>();
      seriesData.series.forEach((series) => {
        series.tvs.forEach((tvId) => allTVIds.add(tvId));
      });

      // 获取所有 TV 信息
      const tvData = await getTVInfos({ ids: Array.from(allTVIds) });

      // 创建 TV ID 到 TVInfo 的映射
      const tvMap = new Map<number, TVInfo>();
      tvData.tvs.forEach((tv) => {
        tvMap.set(tv.id, tv);
      });

      // 组合系列和 TV 信息
      const seriesWithTVs: SeriesWithTVs[] = seriesData.series.map((series) => ({
        ...series,
        tvInfos: series.tvs
          .map((tvId) => tvMap.get(tvId))
          .filter((tv): tv is TVInfo => tv !== undefined)
          .sort((a, b) => {
            // 按更新时间排序，最新的在前
            return (
              new Date(b.last_update).getTime() -
              new Date(a.last_update).getTime()
            );
          }),
      }));

      // 计算每个系列的最大更新时间并缓存
      const maxTimeCache = new Map<number, number>();
      const getMaxUpdateTime = (series: SeriesWithTVs): number => {
        if (maxTimeCache.has(series.id)) {
          return maxTimeCache.get(series.id)!;
        }

        const times: number[] = [];

        // 添加 series 的 last_update
        if (series.last_update) {
          times.push(new Date(series.last_update).getTime());
        }

        // 添加所有 TV 的 last_update 和 user_data.last_update 的最大值
        series.tvInfos.forEach((tv) => {
          const tvUpdateTime = new Date(tv.last_update).getTime();
          const userUpdateTime = new Date(tv.user_data.last_update).getTime();
          times.push(Math.max(tvUpdateTime, userUpdateTime));
        });

        // 如果没有时间值，返回 0
        const maxTime = times.length === 0 ? 0 : Math.max(...times);
        maxTimeCache.set(series.id, maxTime);
        return maxTime;
      };

      // 根据系列中所有 TV 的 last_update、user_data.last_update 和 series.last_update 的最大值进行排序
      const sortedSeries = seriesWithTVs.sort((a, b) => {
        const aMaxTime = getMaxUpdateTime(a);
        const bMaxTime = getMaxUpdateTime(b);

        // 降序排序，最新的在前
        return bMaxTime - aMaxTime;
      });

      setSeriesList(sortedSeries);
    } catch (err) {
      console.error("Fetch series error:", err);
      setError(err instanceof Error ? err.message : "获取系列列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeries();
  }, []);

  // 根据搜索关键词过滤系列列表
  const filteredSeriesList = seriesList.filter((series) => {
    if (!searchKeyword.trim()) {
      return true;
    }

    const keyword = searchKeyword.trim().toLowerCase();

    // 检查系列名字是否匹配
    if (series.name.toLowerCase().includes(keyword)) {
      return true;
    }

    // 检查TV名字是否匹配
    return series.tvInfos.some((tv) =>
      tv.name.toLowerCase().includes(keyword)
    );
  });

  // 监听 ESC 键关闭添加系列模态框
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showAddSeriesModal) {
        setShowAddSeriesModal(false);
        setNewSeriesName("");
      }
    };

    if (showAddSeriesModal) {
      window.addEventListener("keydown", handleEscape);
      return () => {
        window.removeEventListener("keydown", handleEscape);
      };
    }
  }, [showAddSeriesModal]);

  // 切换编辑模式
  const handleEdit = () => {
    setIsEditing(true);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setIsEditing(false);
    setShowAddSeriesModal(false);
    setNewSeriesName("");
    setNameError(null);
  };

  // 检查系列名称是否已存在
  const checkSeriesName = (name: string) => {
    if (!name) {
      setNameError(null);
      return;
    }

    const exists = seriesList.some(series => series.name === name);
    if (exists) {
      setNameError(`系列名称 '${name}' 已存在`);
    } else {
      setNameError(null);
    }
  };

  // 添加系列
  const handleAddSeries = async () => {
    if (!newSeriesName.trim() || adding || nameError) return;

    try {
      setAdding(true);
      setError(null);
      await addSeries({ name: newSeriesName.trim() });
      setShowAddSeriesModal(false);
      setNewSeriesName("");
      setNameError(null);
      await fetchSeries();
    } catch (err) {
      console.error("Add series error:", err);
      setError(err instanceof Error ? err.message : "添加系列失败");
      // 失败时也关闭模态框和退出编辑模式，以便展示错误信息
      setShowAddSeriesModal(false);
      setNewSeriesName("");
      setNameError(null);
    } finally {
      setAdding(false);
    }
  };

  // 删除系列
  const handleDeleteSeries = async (seriesId: number) => {
    if (deleting.has(seriesId)) return;

    if (!confirm("确定要删除这个系列吗？")) {
      return;
    }

    try {
      setDeleting((prev) => new Set(prev).add(seriesId));
      setError(null);
      await removeSeries({ id: seriesId });
      await fetchSeries();
    } catch (err) {
      console.error("Delete series error:", err);
      setError(err instanceof Error ? err.message : "删除系列失败");
    } finally {
      setDeleting((prev) => {
        const newSet = new Set(prev);
        newSet.delete(seriesId);
        return newSet;
      });
    }
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
      {/* 头部 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            系列列表
          </h1>
          {!isEditing ? (
            <button
              onClick={handleEdit}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
            >
              编辑
            </button>
          ) : (
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 transition-colors"
            >
              取消编辑
            </button>
          )}
        </div>
        {/* 搜索框 */}
        <div className="mb-4">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="搜索系列名称或TV名称..."
            className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredSeriesList.map((series) => {
          const firstTV = series.tvInfos[0];
          const coverUrl = firstTV?.cover_url || null;
          const isDeleting = deleting.has(series.id);

          return (
            <div
              key={series.id}
              className="block bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-visible relative"
            >
              {isEditing ? (
                <div className="block [&_a]:pointer-events-none">
                  <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700 overflow-hidden relative">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={series.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        无封面
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {series.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      包含 {series.tvInfos.length} 个 TV
                    </p>
                  </div>
                </div>
              ) : (
                <a
                  href={`/series/${series.id}`}
                  className="block [&_a]:pointer-events-none"
                >
                  <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700 overflow-hidden relative">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={series.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        无封面
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {series.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      包含 {series.tvInfos.length} 个 TV
                    </p>
                  </div>
                </a>
              )}
              {/* 删除按钮 - 仅在编辑模式下显示 */}
              {isEditing && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteSeries(series.id);
                  }}
                  disabled={isDeleting}
                  className="absolute -top-2 -right-2 z-20 bg-red-500 hover:bg-red-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="删除"
                >
                  {isDeleting ? "..." : "×"}
                </button>
              )}
            </div>
          );
        })}
        {/* 添加系列卡片 - 仅在编辑模式下显示 */}
        {isEditing && (
          <div
            onClick={() => setShowAddSeriesModal(true)}
            className="block bg-gray-100 dark:bg-gray-700 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400"
          >
            <div className="aspect-[2/3] flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl text-gray-400 dark:text-gray-500 mb-2">
                  +
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  添加系列
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 添加系列模态框 */}
      {showAddSeriesModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowAddSeriesModal(false);
            setNewSeriesName("");
            setNameError(null);
          }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 模态框头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                添加系列
              </h3>
              <button
                onClick={() => {
                  setShowAddSeriesModal(false);
                  setNewSeriesName("");
                  setNameError(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* 输入框 */}
            <div className="p-4">
              <input
                type="text"
                value={newSeriesName}
                onChange={(e) => {
                  setNewSeriesName(e.target.value);
                  checkSeriesName(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSeriesName.trim() && !nameError) {
                    handleAddSeries();
                  }
                }}
                placeholder="输入系列名称..."
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${nameError
                  ? "border-red-500 focus:ring-red-500 dark:border-red-500"
                  : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                  }`}
                autoFocus
              />
              {nameError && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {nameError}
                </p>
              )}
            </div>

            {/* 按钮 */}
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowAddSeriesModal(false);
                  setNewSeriesName("");
                  setNameError(null);
                }}
                disabled={adding}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                onClick={handleAddSeries}
                disabled={adding || !newSeriesName.trim() || !!nameError}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? "添加中..." : "添加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
