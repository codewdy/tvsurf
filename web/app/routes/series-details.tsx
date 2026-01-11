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
  const [showAddTVModal, setShowAddTVModal] = useState(false);
  const [draggedTVId, setDraggedTVId] = useState<number | null>(null);
  const [dragTargetTVId, setDragTargetTVId] = useState<number | null>(null);

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

  // 监听 ESC 键关闭添加 TV 模态框
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showAddTVModal) {
        setShowAddTVModal(false);
      }
    };

    if (showAddTVModal) {
      window.addEventListener("keydown", handleEscape);
      return () => {
        window.removeEventListener("keydown", handleEscape);
      };
    }
  }, [showAddTVModal]);

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
      setShowAddTVModal(false);
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
      setShowAddTVModal(false);
    } catch (err) {
      console.error("Update series TVs error:", err);
      setError(err instanceof Error ? err.message : "更新系列失败");
    } finally {
      setSaving(false);
    }
  };

  // 删除 TV
  const removeTV = (tvId: number) => {
    setSelectedTVs((prev) => prev.filter((id) => id !== tvId));
  };

  // 添加 TV
  const addTV = (tvId: number) => {
    if (!selectedTVs.includes(tvId)) {
      setSelectedTVs((prev) => [...prev, tvId]);
    }
  };

  // 拖拽处理函数
  const handleDragStart = (e: React.DragEvent, tvId: number) => {
    setDraggedTVId(tvId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", tvId.toString());
  };

  const handleDragOver = (e: React.DragEvent, targetTVId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedTVId !== null && draggedTVId !== targetTVId) {
      setDragTargetTVId(targetTVId);
    }
  };

  const createDragOverHandler = (targetTVId: number) => {
    return (e: React.DragEvent) => {
      handleDragOver(e, targetTVId);
    };
  };

  const handleDrop = (e: React.DragEvent, targetTVId: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedTVId === null || draggedTVId === targetTVId) {
      setDraggedTVId(null);
      setDragTargetTVId(null);
      return;
    }

    setSelectedTVs((prev) => {
      const draggedIndex = prev.indexOf(draggedTVId);
      const targetIndex = prev.indexOf(targetTVId);

      if (draggedIndex === -1 || targetIndex === -1) {
        return prev;
      }

      const newTVs = [...prev];
      newTVs.splice(draggedIndex, 1);
      newTVs.splice(targetIndex, 0, draggedTVId);
      return newTVs;
    });

    setDraggedTVId(null);
    setDragTargetTVId(null);
  };

  const handleDragEnd = () => {
    setDraggedTVId(null);
    setDragTargetTVId(null);
  };

  const handleDragLeave = () => {
    setDragTargetTVId(null);
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              系列：{series.name}
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
          {/* 已选 TV 列表 */}
          <div>
            <div className="mb-4">
              <p className="text-gray-600 dark:text-gray-400">
                包含 {selectedTVInfos.length} 个 TV
                <span className="text-gray-500 dark:text-gray-500">（拖拽卡片以排序）</span>
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {selectedTVInfos.map((tv) => {
                const isDragging = draggedTVId === tv.id;
                const isDragTarget = dragTargetTVId === tv.id && !isDragging;
                return (
                  <div
                    key={tv.id}
                    draggable="true"
                    onDragStart={(e) => handleDragStart(e, tv.id)}
                    onDragOver={createDragOverHandler(tv.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, tv.id)}
                    onDragEnd={handleDragEnd}
                    className={`relative cursor-move ${isDragging ? "opacity-50" : ""} ${isDragTarget ? "ring-2 ring-blue-500" : ""}`}
                  >
                    <div className="relative [&_a]:pointer-events-none">
                      {/* 删除角标 */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeTV(tv.id);
                        }}
                        className="absolute -top-2 -right-2 z-20 bg-red-500 hover:bg-red-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-colors"
                        title="删除"
                      >
                        ×
                      </button>
                      <TVCard tv={tv} />
                    </div>
                  </div>
                );
              })}
              {/* 虚拟的新 card */}
              <div
                onClick={() => setShowAddTVModal(true)}
                className="block bg-gray-100 dark:bg-gray-700 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400"
              >
                <div className="aspect-[2/3] flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl text-gray-400 dark:text-gray-500 mb-2">
                      +
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      添加 TV
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 添加 TV 模态框 */}
          {showAddTVModal && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowAddTVModal(false)}
            >
              <div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 模态框头部 */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    添加 TV
                  </h3>
                  <button
                    onClick={() => setShowAddTVModal(false)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>

                {/* 搜索框 */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="搜索 TV..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* 可用 TV 列表 */}
                <div className="flex-1 overflow-y-auto p-4">
                  {availableTVInfos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {availableTVInfos.map((tv) => (
                        <div
                          key={tv.id}
                          onClick={() => addTV(tv.id)}
                          className="cursor-pointer [&_a]:pointer-events-none"
                        >
                          <TVCard tv={tv} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                      {searchKeyword ? "未找到匹配的 TV" : "无可用 TV"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
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
