import { useState, useEffect, useCallback } from "react";
import type {
  GetTVDetailsResponse,
  Source,
  SearchError,
} from "../api/types";
import {
  setTVTracking,
  searchTV,
  updateTVSource,
  updateEpisodeSource,
  removeTV,
  scheduleEpisodeDownload,
} from "../api/client";

interface TVSettingsModalProps {
  show: boolean;
  details: GetTVDetailsResponse;
  onClose: () => void;
  onUpdate: () => Promise<void>;
}

export default function TVSettingsModal({
  show,
  details,
  onClose,
  onUpdate,
}: TVSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"general" | "source" | "delete">("general");
  // 删除相关状态
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  // 换源相关状态
  const [sourceSearchKeyword, setSourceSearchKeyword] = useState("");
  const [sourceSearchLoading, setSourceSearchLoading] = useState(false);
  const [sourceSearchResults, setSourceSearchResults] = useState<Source[]>([]);
  const [sourceSearchErrors, setSourceSearchErrors] = useState<SearchError[]>([]);
  const [sourceType, setSourceType] = useState<"tv" | "episode">("tv");
  const [selectedEpisodeForSource, setSelectedEpisodeForSource] = useState<number>(0);
  const [selectedSourceIndex, setSelectedSourceIndex] = useState<number | null>(null);
  const [selectedEpisodeInNewSource, setSelectedEpisodeInNewSource] = useState<number>(0);
  // 确认对话框相关状态
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  // 追更相关状态
  const [updatingTracking, setUpdatingTracking] = useState(false);
  // 重新下载相关状态
  const [reschedulingDownload, setReschedulingDownload] = useState(false);
  const [pendingSourceChange, setPendingSourceChange] = useState<{
    type: "tv" | "episode";
    sourceIndex: number;
    episodeIndex?: number;
    newEpisodeIndex?: number;
  } | null>(null);
  // 错误信息状态
  const [errorMessage, setErrorMessage] = useState<string>("");
  // 用于标记是否已经自动搜索过
  const [hasAutoSearched, setHasAutoSearched] = useState(false);

  // 执行搜索的通用函数
  const performSearch = useCallback(async (keyword: string, updateKeyword: boolean = false) => {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) return;

    if (updateKeyword) {
      setSourceSearchKeyword(trimmedKeyword);
    }
    setSourceSearchLoading(true);
    setSourceSearchResults([]);
    setSourceSearchErrors([]);

    try {
      const data = await searchTV({ keyword: trimmedKeyword });
      setSourceSearchResults(data.source || []);
      setSourceSearchErrors(data.search_error || []);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "搜索时发生错误");
      console.error("Search error:", err);
    } finally {
      setSourceSearchLoading(false);
    }
  }, []);

  // 当切换到换源标签页时，自动搜索TV名称
  useEffect(() => {
    if (show && activeTab === "source" && !hasAutoSearched && details?.tv?.name) {
      const tvName = details.tv.name.trim();
      if (tvName) {
        performSearch(tvName, true).then(() => {
          setHasAutoSearched(true);
        });
      }
    }
  }, [show, activeTab, hasAutoSearched, details, performSearch]);

  // 当模态框关闭时，重置自动搜索标记
  useEffect(() => {
    if (!show) {
      setHasAutoSearched(false);
    }
  }, [show]);

  const handleClose = () => {
    setShowConfirmDialog(false);
    // 重置状态
    setSourceSearchKeyword("");
    setSourceSearchResults([]);
    setSourceSearchErrors([]);
    setSelectedSourceIndex(null);
    setSelectedEpisodeInNewSource(0);
    setSourceType("tv");
    setSelectedEpisodeForSource(0);
    setPendingSourceChange(null);
    setDeleteConfirmName("");
    setActiveTab("general");
    setErrorMessage("");
    setHasAutoSearched(false);
    onClose();
  };

  if (!show) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <div
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">编辑</h2>
              <button
                onClick={handleClose}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tab 导航 */}
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
              <nav className="flex space-x-8">
                <button
                  onClick={() => setActiveTab("general")}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === "general"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                    }`}
                >
                  常规
                </button>
                <button
                  onClick={() => setActiveTab("source")}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === "source"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                    }`}
                >
                  换源
                </button>
                <button
                  onClick={() => {
                    setActiveTab("delete");
                    setDeleteConfirmName("");
                  }}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === "delete"
                    ? "border-red-500 text-red-600 dark:text-red-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                    }`}
                >
                  删除
                </button>
              </nav>
            </div>

            {/* 错误信息显示 */}
            {errorMessage && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
                      错误信息
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-400">
                      {errorMessage}
                    </p>
                  </div>
                  <button
                    onClick={() => setErrorMessage("")}
                    className="ml-4 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    aria-label="关闭错误信息"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 内容 */}
            {activeTab === "general" && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    追更设置
                  </label>
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                        自动追更
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {details.tv.track.tracking
                          ? "开启后，系统会自动检查并下载新剧集"
                          : "关闭后，系统将不再自动检查新剧集"}
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={details.tv.track.tracking}
                        onChange={async (e) => {
                          const newTracking = e.target.checked;
                          setUpdatingTracking(true);
                          setErrorMessage("");
                          try {
                            await setTVTracking({
                              tv_id: details.tv.id,
                              tracking: newTracking,
                            });
                            // 刷新详情
                            await onUpdate();
                          } catch (err) {
                            setErrorMessage(
                              err instanceof Error
                                ? err.message
                                : "更新追更状态时发生错误"
                            );
                            console.error("Set tracking error:", err);
                          } finally {
                            setUpdatingTracking(false);
                          }
                        }}
                        disabled={updatingTracking}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500 disabled:opacity-50"></div>
                    </label>
                  </div>
                  {updatingTracking && (
                    <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      更新中...
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    重新下载
                  </label>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                        重新下载剧集
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        选择需要重新下载的剧集，系统将取消当前下载任务并重新开始下载
                      </div>
                      <div className="flex gap-3">
                        <select
                          id="reschedule-episode-select"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          disabled={reschedulingDownload}
                        >
                          {details.tv.source.episodes.map((episode, index) => {
                            const storageEp = details.tv.storage.episodes[index];
                            const statusText =
                              storageEp?.status === "success"
                                ? "✓ 已下载"
                                : storageEp?.status === "running"
                                  ? "下载中"
                                  : storageEp?.status === "failed"
                                    ? "失败"
                                    : "未下载";
                            return (
                              <option key={index} value={index}>
                                {episode.name} ({statusText})
                              </option>
                            );
                          })}
                        </select>
                        <button
                          onClick={async () => {
                            const selectElement = document.getElementById(
                              "reschedule-episode-select"
                            ) as HTMLSelectElement;
                            const episodeId = selectElement
                              ? parseInt(selectElement.value)
                              : -1;

                            if (episodeId < 0 || isNaN(episodeId)) {
                              setErrorMessage("请选择要重新下载的剧集");
                              return;
                            }

                            setReschedulingDownload(true);
                            setErrorMessage("");
                            try {
                              await scheduleEpisodeDownload({
                                tv_id: details.tv.id,
                                episode_ids: [episodeId],
                              });
                              // 刷新详情以更新状态
                              await onUpdate();
                            } catch (err) {
                              setErrorMessage(
                                err instanceof Error
                                  ? err.message
                                  : "重新提交下载任务时发生错误"
                              );
                              console.error("Schedule download error:", err);
                            } finally {
                              setReschedulingDownload(false);
                            }
                          }}
                          disabled={reschedulingDownload}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-blue-700 dark:hover:bg-blue-600"
                        >
                          {reschedulingDownload ? "提交中..." : "重新下载"}
                        </button>
                      </div>
                      {reschedulingDownload && (
                        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          正在提交下载任务...
                        </div>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                        批量操作
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={async () => {
                            // 找到所有失败的剧集
                            const failedEpisodeIds: number[] = [];
                            details.tv.storage.episodes.forEach((ep, index) => {
                              if (ep.status === "failed") {
                                failedEpisodeIds.push(index);
                              }
                            });

                            if (failedEpisodeIds.length === 0) {
                              setErrorMessage("没有失败的剧集需要重新下载");
                              return;
                            }

                            setReschedulingDownload(true);
                            setErrorMessage("");
                            try {
                              await scheduleEpisodeDownload({
                                tv_id: details.tv.id,
                                episode_ids: failedEpisodeIds,
                              });
                              // 刷新详情以更新状态
                              await onUpdate();
                            } catch (err) {
                              setErrorMessage(
                                err instanceof Error
                                  ? err.message
                                  : "重新提交下载任务时发生错误"
                              );
                              console.error("Schedule download error:", err);
                            } finally {
                              setReschedulingDownload(false);
                            }
                          }}
                          disabled={reschedulingDownload}
                          className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-orange-700 dark:hover:bg-orange-600"
                        >
                          重新下载失败集
                        </button>
                        <button
                          onClick={async () => {
                            // 获取所有剧集的ID
                            const allEpisodeIds = details.tv.source.episodes.map((_, index) => index);

                            if (allEpisodeIds.length === 0) {
                              setErrorMessage("没有可下载的剧集");
                              return;
                            }

                            // 确认操作
                            if (!confirm(`确定要重新下载所有 ${allEpisodeIds.length} 集吗？这将取消所有当前下载任务并重新开始下载。`)) {
                              return;
                            }

                            setReschedulingDownload(true);
                            setErrorMessage("");
                            try {
                              await scheduleEpisodeDownload({
                                tv_id: details.tv.id,
                                episode_ids: allEpisodeIds,
                              });
                              // 刷新详情以更新状态
                              await onUpdate();
                            } catch (err) {
                              setErrorMessage(
                                err instanceof Error
                                  ? err.message
                                  : "重新提交下载任务时发生错误"
                              );
                              console.error("Schedule download error:", err);
                            } finally {
                              setReschedulingDownload(false);
                            }
                          }}
                          disabled={reschedulingDownload}
                          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-red-700 dark:hover:bg-red-600"
                        >
                          重新下载所有集
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "source" && (
              <div className="space-y-6">
                {/* 选择换源类型 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    换源类型
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        value="tv"
                        checked={sourceType === "tv"}
                        onChange={(e) => setSourceType(e.target.value as "tv" | "episode")}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">更换整部剧源</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        value="episode"
                        checked={sourceType === "episode"}
                        onChange={(e) => setSourceType(e.target.value as "tv" | "episode")}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">更换单集源</span>
                    </label>
                  </div>
                </div>

                {/* 选择剧集（仅当更换单集源时显示） */}
                {sourceType === "episode" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      选择剧集
                    </label>
                    <select
                      value={selectedEpisodeForSource}
                      onChange={(e) => setSelectedEpisodeForSource(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      {details.tv.source.episodes.map((episode, index) => (
                        <option key={index} value={index}>
                          {episode.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 搜索框 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    搜索新源
                  </label>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await performSearch(sourceSearchKeyword, false);
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={sourceSearchKeyword}
                      onChange={(e) => setSourceSearchKeyword(e.target.value)}
                      placeholder="输入搜索关键词..."
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      disabled={sourceSearchLoading}
                    />
                    <button
                      type="submit"
                      disabled={sourceSearchLoading || !sourceSearchKeyword.trim()}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-blue-700 dark:hover:bg-blue-600"
                    >
                      {sourceSearchLoading ? "搜索中..." : "搜索"}
                    </button>
                  </form>
                </div>

                {/* 搜索错误信息 */}
                {sourceSearchErrors.length > 0 && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                      搜索过程中部分来源出现错误 ({sourceSearchErrors.length})
                    </h3>
                    <div className="space-y-1">
                      {sourceSearchErrors.map((searchError, index) => (
                        <div
                          key={index}
                          className="p-2 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded text-xs"
                        >
                          <p className="font-medium text-yellow-900 dark:text-yellow-200">
                            {searchError.source_name}: {searchError.error}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 搜索结果 */}
                {sourceSearchResults.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      找到 {sourceSearchResults.length} 个结果
                    </h3>
                    <div className="overflow-x-auto pb-2" style={{ maxHeight: "400px" }}>
                      <div className="flex gap-4 pb-2" style={{ minWidth: "max-content" }}>
                        {sourceSearchResults.map((source, index) => (
                          <div
                            key={index}
                            className={`bg-gray-50 dark:bg-gray-700 rounded-lg border-2 transition-colors flex-shrink-0 ${selectedSourceIndex === index
                              ? "border-blue-500 dark:border-blue-400"
                              : "border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer"
                              }`}
                            style={{ width: "320px", height: "180px" }}
                            onClick={() => {
                              if (sourceType === "tv") {
                                // 整部剧源显示确认对话框
                                setPendingSourceChange({
                                  type: "tv",
                                  sourceIndex: index,
                                });
                                setShowConfirmDialog(true);
                              } else {
                                // 单集源需要先选择，然后选择剧集
                                setSelectedSourceIndex(index);
                                setSelectedEpisodeInNewSource(0);
                              }
                            }}
                          >
                            <div className="flex h-full">
                              {/* 封面 */}
                              <div className="w-32 h-full bg-gray-200 dark:bg-gray-600 rounded-l-lg overflow-hidden flex-shrink-0">
                                {source.cover_url ? (
                                  <img
                                    src={source.cover_url}
                                    alt={source.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                    无封面
                                  </div>
                                )}
                              </div>
                              {/* 信息 */}
                              <div className="flex-1 p-3 flex flex-col justify-between overflow-hidden">
                                <div>
                                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                                    {source.name}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                    <p className="truncate">来源: {source.source.source_name}</p>
                                    <p className="truncate">频道: {source.source.channel_name}</p>
                                    <p>剧集数: {source.episodes.length}</p>
                                  </div>
                                </div>
                                {selectedSourceIndex === index && sourceType === "episode" && (
                                  <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
                                    已选择
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Episode 源选择剧集 */}
                    {sourceType === "episode" && selectedSourceIndex !== null && (
                      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                          选择新源中的剧集（当前要更换的剧集：{details.tv.source.episodes[selectedEpisodeForSource]?.name}）
                        </h4>
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            选择剧集
                          </label>
                          <select
                            value={selectedEpisodeInNewSource}
                            onChange={(e) => setSelectedEpisodeInNewSource(parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          >
                            {sourceSearchResults[selectedSourceIndex]?.episodes.map((episode, index) => (
                              <option key={index} value={index}>
                                {episode.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              const selectedSource = sourceSearchResults[selectedSourceIndex];
                              const selectedEp = selectedSource.episodes[selectedEpisodeInNewSource];
                              if (!selectedEp) {
                                setErrorMessage("所选剧集不存在");
                                return;
                              }
                              // 显示确认对话框
                              setPendingSourceChange({
                                type: "episode",
                                sourceIndex: selectedSourceIndex,
                                episodeIndex: selectedEpisodeForSource,
                                newEpisodeIndex: selectedEpisodeInNewSource,
                              });
                              setShowConfirmDialog(true);
                            }}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors dark:bg-green-700 dark:hover:bg-green-600"
                          >
                            确认更换
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSourceIndex(null);
                              setSelectedEpisodeInNewSource(0);
                            }}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {sourceSearchLoading && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p>搜索中，可能需要最多1分钟时间</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "delete" && (
              <div className="space-y-6">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">
                    ⚠️ 警告：此操作不可撤销
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-400">
                    删除此电视剧将永久移除所有相关数据，包括下载的剧集、观看进度等信息。此操作无法恢复。
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    请输入电视剧名称以确认删除
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    请输入 "<span className="font-semibold">{details.tv.name}</span>" 以确认删除
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    placeholder={details.tv.name}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={deleting}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      if (deleteConfirmName !== details.tv.name) {
                        setErrorMessage("输入的电视剧名称不匹配");
                        return;
                      }

                      setDeleting(true);
                      setErrorMessage("");
                      try {
                        await removeTV({ id: details.tv.id });
                        // 删除成功后跳转到列表页
                        window.location.href = "/";
                      } catch (err) {
                        setErrorMessage(err instanceof Error ? err.message : "删除时发生错误");
                        console.error("Remove TV error:", err);
                        setDeleting(false);
                      }
                    }}
                    disabled={deleting || deleteConfirmName !== details.tv.name}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-red-700 dark:hover:bg-red-600"
                  >
                    {deleting ? "删除中..." : "确认删除"}
                  </button>
                  <button
                    onClick={() => {
                      setDeleteConfirmName("");
                      setErrorMessage("");
                    }}
                    disabled={deleting}
                    className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors disabled:opacity-50"
                  >
                    清空
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 换源确认对话框 */}
      {showConfirmDialog && pendingSourceChange && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                确认换源
              </h2>

              {pendingSourceChange.type === "tv" ? (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      当前源
                    </h3>
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      <p className="font-medium">{details.tv.source.name}</p>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">
                        来源: {details.tv.source.source.source_name} | 频道: {details.tv.source.source.channel_name}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">
                        剧集数: {details.tv.source.episodes.length}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      新源
                    </h3>
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      <p className="font-medium">{sourceSearchResults[pendingSourceChange.sourceIndex]?.name}</p>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">
                        来源: {sourceSearchResults[pendingSourceChange.sourceIndex]?.source.source_name} | 频道: {sourceSearchResults[pendingSourceChange.sourceIndex]?.source.channel_name}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">
                        剧集数: {sourceSearchResults[pendingSourceChange.sourceIndex]?.episodes.length}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      ⚠️ 更换整部剧源将替换所有剧集的源，已下载的剧集可能需要重新下载。
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      当前剧集
                    </h3>
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      <p className="font-medium text-base mb-1">{details.tv.name}</p>
                      <p className="font-medium">
                        {details.tv.source.episodes[pendingSourceChange.episodeIndex || 0]?.name}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">
                        来源: {details.tv.source.episodes[pendingSourceChange.episodeIndex || 0]?.source.source_name} | 频道: {details.tv.source.episodes[pendingSourceChange.episodeIndex || 0]?.source.channel_name}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      新源剧集
                    </h3>
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      <p className="font-medium text-base mb-1">{sourceSearchResults[pendingSourceChange.sourceIndex]?.name}</p>
                      <p className="font-medium">
                        {sourceSearchResults[pendingSourceChange.sourceIndex]?.episodes[pendingSourceChange.newEpisodeIndex || 0]?.name}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">
                        来源: {sourceSearchResults[pendingSourceChange.sourceIndex]?.episodes[pendingSourceChange.newEpisodeIndex || 0]?.source.source_name} | 频道: {sourceSearchResults[pendingSourceChange.sourceIndex]?.episodes[pendingSourceChange.newEpisodeIndex || 0]?.source.channel_name}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={async () => {
                    try {
                      if (pendingSourceChange.type === "tv") {
                        const selectedSource = sourceSearchResults[pendingSourceChange.sourceIndex];
                        await updateTVSource({
                          id: details.tv.id,
                          source: selectedSource,
                        });
                      } else {
                        const selectedSource = sourceSearchResults[pendingSourceChange.sourceIndex];
                        const selectedEp = selectedSource.episodes[pendingSourceChange.newEpisodeIndex || 0];
                        if (!selectedEp) {
                          setErrorMessage("所选剧集不存在");
                          return;
                        }
                        await updateEpisodeSource({
                          tv_id: details.tv.id,
                          episode_id: pendingSourceChange.episodeIndex || 0,
                          source: selectedEp.source,
                        });
                      }
                      // 刷新详情
                      await onUpdate();
                      handleClose();
                    } catch (err) {
                      setErrorMessage(err instanceof Error ? err.message : "更新源时发生错误");
                      console.error("Update source error:", err);
                      setShowConfirmDialog(false);
                      setPendingSourceChange(null);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors dark:bg-blue-700 dark:hover:bg-blue-600"
                >
                  确认换源
                </button>
                <button
                  onClick={() => {
                    setShowConfirmDialog(false);
                    setPendingSourceChange(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
