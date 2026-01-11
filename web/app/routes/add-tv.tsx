import { useState } from "react";
import type { Route } from "./+types/add-tv";

// 定义 API 响应类型
interface SourceUrl {
  source_key: string;
  source_name: string;
  channel_name: string;
  url: string;
}

interface Episode {
  source: SourceUrl;
  name: string;
}

interface Source {
  source: SourceUrl;
  name: string;
  cover_url: string;
  episodes: Episode[];
}

interface SearchError {
  source_name: string;
  source_key: string;
  error: string;
}

interface SearchTVResponse {
  source: Source[];
  search_error: SearchError[];
}

interface AddTVResponse {
  id: number;
}

interface Series {
  id: number;
  name: string;
  tvs: number[];
}

interface GetSeriesResponse {
  series: Series[];
}

interface AddSeriesResponse {
  id: number;
}

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "添加TV" },
    { name: "description", content: "搜索并添加新的TV" },
  ];
}

export default function AddTV() {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchErrors, setSearchErrors] = useState<SearchError[]>([]);
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [addError, setAddError] = useState<Map<number, string>>(new Map());
  const [hasSearched, setHasSearched] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmSource, setConfirmSource] = useState<Source | null>(null);
  const [confirmIndex, setConfirmIndex] = useState<number>(-1);
  const [confirmName, setConfirmName] = useState("");
  const [confirmTracking, setConfirmTracking] = useState(false);
  const [confirmSeries, setConfirmSeries] = useState<number[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [seriesSearchKeyword, setSeriesSearchKeyword] = useState("");
  const [creatingSeries, setCreatingSeries] = useState(false);
  // 保存对话框设置（除了名称）
  const [savedTracking, setSavedTracking] = useState(false);
  const [savedSeries, setSavedSeries] = useState<number[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setSearchErrors([]);
    setHasSearched(true);

    try {
      const response = await fetch("/api/search_tv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`搜索失败: ${response.statusText} - ${errorText}`);
      }

      const data: SearchTVResponse = await response.json();
      setResults(data.source || []);
      setSearchErrors(data.search_error || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "搜索时发生错误");
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSeries = async () => {
    try {
      setLoadingSeries(true);
      const response = await fetch("/api/get_series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: null }),
      });

      if (!response.ok) {
        throw new Error(`获取系列列表失败: ${response.statusText}`);
      }

      const data: GetSeriesResponse = await response.json();
      setSeriesList(data.series || []);
    } catch (err) {
      console.error("Fetch series error:", err);
    } finally {
      setLoadingSeries(false);
    }
  };

  const handleCreateSeries = async () => {
    if (!seriesSearchKeyword.trim()) {
      return;
    }

    try {
      setCreatingSeries(true);
      const response = await fetch("/api/add_series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: seriesSearchKeyword.trim() }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`创建系列失败: ${response.statusText} - ${errorText}`);
      }

      const data: AddSeriesResponse = await response.json();

      // 刷新系列列表
      await fetchSeries();

      // 将新系列添加到已选列表
      setConfirmSeries((prev) => [...prev, data.id]);

      // 清空输入
      setSeriesSearchKeyword("");
    } catch (err) {
      console.error("Create series error:", err);
      alert(err instanceof Error ? err.message : "创建系列时发生错误");
    } finally {
      setCreatingSeries(false);
    }
  };

  const handleAddTV = (source: Source, index: number) => {
    setConfirmSource(source);
    setConfirmIndex(index);
    setConfirmName(source.name); // 名称每次都重置为 source.name
    setConfirmTracking(savedTracking); // 使用保存的追更状态
    setConfirmSeries(savedSeries); // 使用保存的系列选择
    setShowConfirmDialog(true);
    fetchSeries();
  };

  const handleConfirmAdd = async () => {
    if (!confirmSource || confirmIndex === -1) {
      return;
    }

    setShowConfirmDialog(false);
    setAddingIds((prev) => new Set(prev).add(confirmIndex));
    setAddError((prev) => {
      const newMap = new Map(prev);
      newMap.delete(confirmIndex);
      return newMap;
    });

    try {
      const response = await fetch("/api/add_tv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: confirmName.trim(),
          source: confirmSource,
          tracking: confirmTracking,
          series: confirmSeries,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`添加失败: ${response.statusText} - ${errorText}`);
      }

      const data: AddTVResponse = await response.json();
      setAddedIds((prev) => new Set(prev).add(confirmIndex));

      // 保存当前设置（除了名称）
      setSavedTracking(confirmTracking);
      setSavedSeries(confirmSeries);

      console.log(`TV 添加成功，ID: ${data.id}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "添加时发生错误";
      setAddError((prev) => new Map(prev).set(confirmIndex, errorMessage));
      console.error("Add TV error:", err);
    } finally {
      setAddingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(confirmIndex);
        return newSet;
      });
      setConfirmSource(null);
      setConfirmIndex(-1);
    }
  };

  const handleCancelAdd = () => {
    // 保存当前设置（除了名称）
    setSavedTracking(confirmTracking);
    setSavedSeries(confirmSeries);

    setShowConfirmDialog(false);
    setConfirmSource(null);
    setConfirmIndex(-1);
    setConfirmName("");
    setSeriesSearchKeyword("");
  };

  const toggleSeries = (seriesId: number) => {
    setConfirmSeries((prev) => {
      if (prev.includes(seriesId)) {
        return prev.filter((id) => id !== seriesId);
      } else {
        return [...prev, seriesId];
      }
    });
  };

  const moveToSelected = (seriesId: number) => {
    if (!confirmSeries.includes(seriesId)) {
      setConfirmSeries((prev) => [...prev, seriesId]);
    }
  };

  const moveToAvailable = (seriesId: number) => {
    setConfirmSeries((prev) => prev.filter((id) => id !== seriesId));
  };

  const moveAllToSelected = () => {
    const filtered = seriesList.filter(
      (series) =>
        !confirmSeries.includes(series.id) &&
        series.name
          .toLowerCase()
          .includes(seriesSearchKeyword.toLowerCase())
    );
    const allIds = filtered.map((s) => s.id);
    setConfirmSeries((prev) => {
      const combined = [...new Set([...prev, ...allIds])];
      return combined;
    });
  };

  const moveAllToAvailable = () => {
    // 移除所有已选系列（不受搜索影响）
    setConfirmSeries([]);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 搜索表单 */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-4">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="输入电视剧名称..."
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !keyword.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            {loading ? "搜索中..." : "搜索"}
          </button>
        </div>
      </form>

      {/* 错误信息 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* 搜索错误信息 */}
      {searchErrors.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-3">
            搜索过程中部分来源出现错误 ({searchErrors.length})
          </h3>
          <div className="space-y-2">
            {searchErrors.map((searchError, index) => (
              <div
                key={index}
                className="p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded text-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-yellow-900 dark:text-yellow-200">
                      {searchError.source_name}
                    </p>
                    <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                      {searchError.error}
                    </p>
                  </div>
                  <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-200 dark:bg-yellow-800 px-2 py-1 rounded">
                    {searchError.source_key}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 搜索结果 */}
      {results.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            找到 {results.length} 个结果
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {results.map((source, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-visible relative flex flex-col"
              >
                <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700 overflow-hidden relative">
                  {source.cover_url ? (
                    <img
                      src={source.cover_url}
                      alt={source.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      无封面
                    </div>
                  )}
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 flex-1">
                      {source.name}
                    </h3>
                    <a
                      href={source.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors dark:bg-blue-700 dark:hover:bg-blue-600 flex-shrink-0"
                      title="前往源地址"
                    >
                      前往
                    </a>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      <p>
                        <span className="font-medium">来源:</span> {source.source.source_name}
                      </p>
                      <p>
                        <span className="font-medium">频道:</span> {source.source.channel_name}
                      </p>
                    </div>
                    {source.episodes && source.episodes.length > 0 && (
                      <details className="mb-2">
                        <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                          {source.episodes?.length || 0} 集
                        </summary>
                        <ul className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                          {source.episodes.map((episode, epIndex) => (
                            <li
                              key={epIndex}
                              className="text-xs text-gray-600 dark:text-gray-400 py-0.5 px-1.5 bg-gray-50 dark:bg-gray-700 rounded"
                            >
                              <a
                                href={episode.source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                              >
                                {episode.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                  <div className="mt-2">
                    {addedIds.has(index) ? (
                      <div className="px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-400 text-sm text-center">
                        ✓ 已添加
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddTV(source, index)}
                        disabled={addingIds.has(index)}
                        className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-green-700 dark:hover:bg-green-600"
                      >
                        {addingIds.has(index) ? "添加中..." : "添加"}
                      </button>
                    )}
                    {addError.has(index) && (
                      <div className="mt-1 px-2 py-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-xs">
                        {addError.get(index)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 无结果提示 */}
      {!loading && results.length === 0 && !error && hasSearched && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>未找到相关结果，请尝试其他关键词</p>
        </div>
      )}

      {/* 初始状态提示 */}
      {!loading && !hasSearched && !error && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>请输入关键词开始搜索</p>
        </div>
      )}

      {/* 确认对话框 */}
      {showConfirmDialog && confirmSource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                确认添加TV
              </h2>

              {/* 名称编辑 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  名称
                </label>
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="输入TV名称"
                />
              </div>

              {/* 追更选项 */}
              <div className="mb-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmTracking}
                    onChange={(e) => setConfirmTracking(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    追更
                  </span>
                </label>
              </div>

              {/* 系列选择 - 穿梭框 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  选择系列
                </label>
                {loadingSeries ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    加载中...
                  </div>
                ) : seriesList.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    暂无系列
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* 搜索框和新建按钮 */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={seriesSearchKeyword}
                        onChange={(e) => setSeriesSearchKeyword(e.target.value)}
                        placeholder="搜索系列或输入新系列名称..."
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleCreateSeries}
                        disabled={!seriesSearchKeyword.trim() || creatingSeries}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors dark:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                      >
                        {creatingSeries ? "创建中..." : "新建"}
                      </button>
                    </div>
                    {/* 穿梭框 */}
                    <div className="flex gap-4">
                      {/* 可用系列 */}
                      <div className="flex-1">
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          可用系列
                        </div>
                        <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                          <div className="max-h-64 overflow-y-auto">
                            {seriesList
                              .filter(
                                (series) =>
                                  !confirmSeries.includes(series.id) &&
                                  series.name
                                    .toLowerCase()
                                    .includes(
                                      seriesSearchKeyword.toLowerCase()
                                    )
                              )
                              .map((series) => (
                                <div
                                  key={series.id}
                                  onClick={() => moveToSelected(series.id)}
                                  className="px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                                >
                                  <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {series.name}
                                  </span>
                                </div>
                              ))}
                            {seriesList.filter(
                              (series) =>
                                !confirmSeries.includes(series.id) &&
                                series.name
                                  .toLowerCase()
                                  .includes(seriesSearchKeyword.toLowerCase())
                            ).length === 0 && (
                                <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                                  无可用系列
                                </div>
                              )}
                          </div>
                        </div>
                      </div>


                      {/* 已选系列 */}
                      <div className="flex-1">
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          已选系列 ({confirmSeries.length})
                        </div>
                        <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                          <div className="max-h-64 overflow-y-auto">
                            {seriesList
                              .filter((series) => confirmSeries.includes(series.id))
                              .map((series) => (
                                <div
                                  key={series.id}
                                  onClick={() => moveToAvailable(series.id)}
                                  className="px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                                >
                                  <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {series.name}
                                  </span>
                                </div>
                              ))}
                            {confirmSeries.length === 0 && (
                              <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                                未选择系列
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 按钮 */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCancelAdd}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmAdd}
                  disabled={!confirmName.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-green-700 dark:hover:bg-green-600"
                >
                  确认添加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
