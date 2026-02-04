import { useState, useEffect } from "react";
import type { Route } from "./+types/add-tv";
import {
  searchTV,
  addTV,
  getSeries,
  addSeries,
  setTVTag,
  getTVInfos,
} from "../api/client";
import type {
  Tag,
  Source,
  SearchTVResponse,
  AddTVResponse,
  Series,
  GetSeriesResponse,
  AddSeriesResponse,
  SearchError,
  TVInfo,
} from "../api/types";
import { TAG_NAMES } from "../api/types";

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
  const [confirmTag, setConfirmTag] = useState<Tag>("not_tagged");
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [seriesSearchKeyword, setSeriesSearchKeyword] = useState("");
  const [seriesNameError, setSeriesNameError] = useState<string | null>(null);
  const [creatingSeries, setCreatingSeries] = useState(false);
  // 保存对话框设置（除了名称）
  const [savedTracking, setSavedTracking] = useState(false);
  const [savedSeries, setSavedSeries] = useState<number[]>([]);
  const [savedTag, setSavedTag] = useState<Tag>("not_tagged");
  // TV 名称验证
  const [tvList, setTvList] = useState<TVInfo[]>([]);
  const [nameExists, setNameExists] = useState(false);

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
      const data = await searchTV({ keyword: keyword.trim() });
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
      const data = await getSeries({ ids: null });
      setSeriesList(data.series || []);
    } catch (err) {
      console.error("Fetch series error:", err);
    } finally {
      setLoadingSeries(false);
    }
  };

  const fetchTVList = async () => {
    try {
      const data = await getTVInfos({ ids: null });
      setTvList(data.tvs || []);
      return data.tvs || [];
    } catch (err) {
      console.error("Fetch TV list error:", err);
      return [];
    }
  };

  // 页面加载时获取 TV 列表
  useEffect(() => {
    fetchTVList();
  }, []);

  const checkNameExists = (name: string) => {
    if (!name.trim()) {
      setNameExists(false);
      return;
    }

    try {
      const trimmedName = name.trim();
      const exists = tvList.some(
        (tv) => tv.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      setNameExists(exists);
    } catch (err) {
      console.error("Check name exists error:", err);
      setNameExists(false);
    }
  };

  // 检查搜索结果中的名称是否已存在
  const isNameExistsInTVList = (name: string): boolean => {
    if (!name.trim() || tvList.length === 0) {
      return false;
    }
    const trimmedName = name.trim();
    return tvList.some(
      (tv) => tv.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
  };

  // 检查播放列表名称是否已存在
  const checkSeriesName = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSeriesNameError(null);
      return;
    }

    const exists = seriesList.some(series => series.name === trimmedName);
    if (exists) {
      setSeriesNameError(`播放列表名称 '${trimmedName}' 已存在`);
    } else {
      setSeriesNameError(null);
    }
  };

  const handleCreateSeries = async () => {
    if (!seriesSearchKeyword.trim() || seriesNameError) {
      return;
    }

    try {
      setCreatingSeries(true);
      const data = await addSeries({ name: seriesSearchKeyword.trim() });

      // 刷新播放列表列表
      await fetchSeries();

      // 将新播放列表添加到已选列表
      setConfirmSeries((prev) => [...prev, data.id]);

      // 清空输入
      setSeriesSearchKeyword("");
      setSeriesNameError(null);
      setSeriesNameError(null);
    } catch (err) {
      console.error("Create series error:", err);
      alert(err instanceof Error ? err.message : "创建播放列表时发生错误");
    } finally {
      setCreatingSeries(false);
    }
  };

  const handleAddTV = (source: Source, index: number) => {
    setConfirmSource(source);
    setConfirmIndex(index);
    setConfirmName(source.name); // 名称每次都重置为 source.name
    setConfirmTracking(savedTracking); // 使用保存的追更状态
    setConfirmSeries(savedSeries); // 使用保存的播放列表选择
    setConfirmTag(savedTag); // 使用保存的tag
    setNameExists(false); // 重置名称存在状态
    setShowConfirmDialog(true);
    fetchSeries();
    checkNameExists(source.name); // 检查初始名称（使用缓存的 TV 列表）
  };

  const handleConfirmAdd = async () => {
    if (!confirmSource || confirmIndex === -1) {
      return;
    }

    // 如果名称已存在，不允许添加
    if (nameExists) {
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
      const data = await addTV({
        name: confirmName.trim(),
        source: confirmSource,
        tracking: confirmTracking,
        series: confirmSeries,
      });
      setAddedIds((prev) => new Set(prev).add(confirmIndex));

      // 保存当前设置（除了名称）
      setSavedTracking(confirmTracking);
      setSavedSeries(confirmSeries);
      setSavedTag(confirmTag);

      // 设置tag
      if (confirmTag !== "not_tagged") {
        try {
          await setTVTag({
            tv_id: data.id,
            tag: confirmTag,
          });
        } catch (err) {
          console.error("Set TV tag error:", err);
        }
      }

      console.log(`TV 添加成功，ID: ${data.id}`);

      // 更新 TV 列表缓存
      await fetchTVList();
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
    setSavedTag(confirmTag);

    setShowConfirmDialog(false);
    setConfirmSource(null);
    setConfirmIndex(-1);
    setConfirmName("");
    setSeriesSearchKeyword("");
    setSeriesNameError(null);
    setNameExists(false);
  };

  // 监听ESC键
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showConfirmDialog) {
        // 保存当前设置（除了名称）
        setSavedTracking(confirmTracking);
        setSavedSeries(confirmSeries);
        setSavedTag(confirmTag);

        setShowConfirmDialog(false);
        setConfirmSource(null);
        setConfirmIndex(-1);
        setConfirmName("");
        setSeriesSearchKeyword("");
        setSeriesNameError(null);
        setNameExists(false);
      }
    };

    if (showConfirmDialog) {
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [showConfirmDialog, confirmTracking, confirmSeries, confirmTag]);

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
    // 移除所有已选播放列表（不受搜索影响）
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
            placeholder="输入TV名称..."
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
                onClick={() => {
                  if (!addedIds.has(index) && !addingIds.has(index)) {
                    handleAddTV(source, index);
                  }
                }}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-visible relative flex flex-col ${isNameExistsInTVList(source.name)
                  ? "border-2 border-green-500 dark:border-green-600"
                  : ""
                  } ${addedIds.has(index) || addingIds.has(index)
                    ? ""
                    : "cursor-pointer"
                  }`}
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
                  {/* 名称已存在标记 */}
                  {isNameExistsInTVList(source.name) && (
                    <div className="absolute top-2 right-2 bg-green-500 dark:bg-green-600 text-white text-xs font-semibold px-2 py-1 rounded shadow-lg flex items-center gap-1">
                      <span>✓</span>
                      <span>已添加</span>
                    </div>
                  )}
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">
                    {source.name}
                  </h3>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p>
                            <span className="font-medium">来源:</span> {source.source.source_name}
                          </p>
                          <p>
                            <span className="font-medium">频道:</span> {source.source.channel_name}
                          </p>
                        </div>
                        <a
                          href={source.source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors dark:bg-blue-700 dark:hover:bg-blue-600 flex-shrink-0"
                          title="前往源地址"
                        >
                          前往源地址
                        </a>
                      </div>
                    </div>
                    {source.episodes && source.episodes.length > 0 && (
                      <details className="mb-2" onClick={(e) => e.stopPropagation()}>
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
                                onClick={(e) => e.stopPropagation()}
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
                    {addingIds.has(index) ? (
                      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded text-gray-700 dark:text-gray-400 text-sm text-center">
                        添加中...
                      </div>
                    ) : null}
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

      {loading && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>搜索中，可能需要最多1分钟时间</p>
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
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* 名称编辑 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  名称
                </label>
                <input
                  type="text"
                  value={confirmName}
                  onChange={(e) => {
                    setConfirmName(e.target.value);
                    checkNameExists(e.target.value);
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${nameExists
                    ? "border-red-500 focus:ring-red-500 dark:border-red-500"
                    : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                    }`}
                  placeholder="输入TV名称"
                />
                {nameExists && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    该名称已存在，请使用其他名称
                  </p>
                )}
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
                  <div className="group relative inline-block ml-2">
                    <svg
                      className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                      <div className="space-y-1">
                        <div className="font-semibold mb-1">追更功能说明：</div>
                        <div className="text-gray-300">
                          开启后，系统会自动检测该TV的新剧集更新，并在有新剧集时自动下载。
                        </div>
                      </div>
                      <div className="absolute top-full left-4 -mt-1">
                        <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                      </div>
                    </div>
                  </div>
                </label>
              </div>

              {/* Tag选择 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  标签
                </label>
                <select
                  value={confirmTag}
                  onChange={(e) => setConfirmTag(e.target.value as Tag)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {Object.entries(TAG_NAMES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 播放列表选择 - 穿梭框 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <span className="flex items-center">
                    选择播放列表
                    <div className="group relative inline-block ml-2">
                      <svg
                        className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                        <div className="space-y-1">
                          <div className="font-semibold mb-1">播放列表说明：</div>
                          <div className="text-gray-300">
                            播放列表用于管理一系列番剧或电视剧，可以将相关的TV归类到同一个播放列表中，方便统一管理和查看。
                          </div>
                        </div>
                        <div className="absolute top-full left-4 -mt-1">
                          <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                        </div>
                      </div>
                    </div>
                  </span>
                </label>
                {loadingSeries ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    加载中...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* 搜索框和新建按钮 */}
                    <div className="space-y-1">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={seriesSearchKeyword}
                          onChange={(e) => {
                            setSeriesSearchKeyword(e.target.value);
                            checkSeriesName(e.target.value);
                          }}
                          placeholder="搜索播放列表或输入新播放列表名称..."
                          className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm ${seriesNameError
                            ? "border-red-500 focus:ring-red-500 dark:border-red-500"
                            : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
                            }`}
                        />
                        <button
                          type="button"
                          onClick={handleCreateSeries}
                          disabled={!seriesSearchKeyword.trim() || creatingSeries || !!seriesNameError}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors dark:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                        >
                          {creatingSeries ? "创建中..." : "新建"}
                        </button>
                      </div>
                      {seriesNameError && (
                        <p className="text-sm text-red-600 dark:text-red-400">
                          {seriesNameError}
                        </p>
                      )}
                    </div>
                    {/* 穿梭框 */}
                    <div className="flex gap-4">
                      {/* 可用播放列表 */}
                      <div className="flex-1">
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          可用播放列表
                        </div>
                        <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                          <div className="h-48 overflow-y-auto">
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
                                  无可用播放列表
                                </div>
                              )}
                          </div>
                        </div>
                      </div>


                      {/* 已选播放列表 */}
                      <div className="flex-1">
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          已选播放列表 ({confirmSeries.length})
                        </div>
                        <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                          <div className="h-48 overflow-y-auto">
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
                                未选择播放列表
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
                  disabled={!confirmName.trim() || nameExists}
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
