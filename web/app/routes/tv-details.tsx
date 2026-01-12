import { useState, useEffect, useRef } from "react";
import type { Route } from "./+types/tv-details";
import {
  getTVDetails,
  setTVTag,
  setWatchProgress,
  getSeries,
  searchTV,
  updateTVSource,
  updateEpisodeSource,
  removeTV,
} from "../api/client";
import type {
  Tag,
  GetTVDetailsResponse,
  Series,
  GetSeriesResponse,
  Source,
  SearchTVResponse,
  SearchError,
  SourceUrl,
} from "../api/types";
import { TAG_NAMES } from "../api/types";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "电视剧详情" },
    { name: "description", content: "电视剧详情和播放" },
  ];
}

export default function TVDetails({ params }: Route.ComponentProps) {
  const id = params?.id;
  const [details, setDetails] = useState<GetTVDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(0);
  const [videoTime, setVideoTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [updatingTag, setUpdatingTag] = useState(false);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [lastProgressUpdate, setLastProgressUpdate] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  // 编辑模态框相关状态
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"source" | "delete">("source");
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
  const [pendingSourceChange, setPendingSourceChange] = useState<{
    type: "tv" | "episode";
    sourceIndex: number;
    episodeIndex?: number;
    newEpisodeIndex?: number;
  } | null>(null);

  useEffect(() => {
    if (id) {
      fetchTVDetails(parseInt(id));
    }
  }, [id]);

  useEffect(() => {
    if (details && details.info.user_data.watch_progress.episode_id >= 0) {
      setSelectedEpisode(details.info.user_data.watch_progress.episode_id);
      if (videoRef.current) {
        videoRef.current.currentTime =
          details.info.user_data.watch_progress.time;
      }
    }
  }, [details]);

  useEffect(() => {
    if (details && details.info.series.length > 0) {
      fetchSeries(details.info.series);
    }
  }, [details]);

  const fetchTVDetails = async (tvId: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTVDetails({ id: tvId });
      setDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取电视剧详情时发生错误");
      console.error("Fetch TV details error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSeries = async (seriesIds: number[]) => {
    if (seriesIds.length === 0) return;

    try {
      const data = await getSeries({ ids: seriesIds });
      setSeriesList(data.series);
    } catch (err) {
      console.error("Fetch series error:", err);
    }
  };

  const handleTagChange = async (newTag: Tag) => {
    if (!details) return;

    setUpdatingTag(true);
    setError(null);
    try {
      await setTVTag({
        tv_id: details.tv.id,
        tag: newTag,
      });

      // 更新本地状态
      setDetails({
        ...details,
        info: {
          ...details.info,
          user_data: { ...details.info.user_data, tag: newTag },
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新标签时发生错误");
      console.error("Set tag error:", err);
    } finally {
      setUpdatingTag(false);
    }
  };

  const updateWatchProgress = async (episodeId: number, time: number) => {
    if (!details) return;

    try {
      await setWatchProgress({
        tv_id: details.tv.id,
        episode_id: episodeId,
        time: time,
      });
    } catch (err) {
      console.error("Update watch progress error:", err);
    }
  };

  const handleEpisodeSelect = (episodeIndex: number, autoPlay: boolean = false) => {
    // 换集前，先更新上一集的进度
    if (videoRef.current && details) {
      updateWatchProgress(episodeIndex, 0);
    }

    setSelectedEpisode(episodeIndex);
    if (videoRef.current) {
      const newVideoUrl = details?.episodes[episodeIndex] || null;
      if (newVideoUrl) {
        videoRef.current.src = newVideoUrl;
        videoRef.current.load();
        setVideoTime(0);
        setLastProgressUpdate(Date.now()); // 重置更新时间
        if (autoPlay) {
          videoRef.current.addEventListener('loadeddata', () => {
            videoRef.current?.play().catch(err => {
              console.error('自动播放失败:', err);
            });
          }, { once: true });
        }
      } else {
        // 如果下一集没有视频（下载中、下载失败或未下载），停止并清空播放器
        videoRef.current.pause();
        videoRef.current.src = '';
        videoRef.current.load();
        setVideoTime(0);
        setIsPlaying(false);
      }
    }
  };

  const handleVideoPlay = () => {
    setIsPlaying(true);
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
    // 暂停时更新播放进度
    if (videoRef.current) {
      updateWatchProgress(selectedEpisode, videoRef.current.currentTime);
      setLastProgressUpdate(Date.now());
    }
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      setVideoTime(currentTime);

      // 每5秒更新一次播放进度
      const now = Date.now();
      if (now - lastProgressUpdate >= 5000) {
        updateWatchProgress(selectedEpisode, currentTime);
        setLastProgressUpdate(now);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === "0001-01-01T00:00:00") {
      return "从未更新";
    }
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("zh-CN");
    } catch {
      return "未知时间";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
            {error || "未找到电视剧详情"}
          </div>
          <a
            href="/"
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
          >
            返回列表
          </a>
        </div>
      </div>
    );
  }

  const currentVideoUrl = details.episodes[selectedEpisode];
  const hasVideo = currentVideoUrl !== null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* 导航栏 */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{details.tv.name}</h1>
          <button
            onClick={() => setShowEditModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            编辑
          </button>
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：电视剧信息 */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 sticky top-4">
              {details.info.cover_url && (
                <img
                  src={details.info.cover_url}
                  alt={details.tv.name}
                  className="w-full rounded-lg mb-4"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    标签
                  </label>
                  <select
                    value={details.info.user_data.tag}
                    onChange={(e) => handleTagChange(e.target.value as Tag)}
                    disabled={updatingTag}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50"
                  >
                    {Object.entries(TAG_NAMES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 text-sm">
                  {seriesList.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">系列:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {seriesList.map((series, index) => (
                          <span key={series.id}>
                            {index > 0 && ", "}
                            <a
                              href={`/series/${series.id}`}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                            >
                              {series.name}
                            </a>
                          </span>
                        ))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">来源:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{details.tv.source.source.source_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">频道:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{details.tv.source.source.channel_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">追踪状态:</span>
                    <span
                      className={`font-medium ${details.tv.track.tracking ? "text-green-600 dark:text-green-400" : "text-gray-400 dark:text-gray-500"
                        }`}
                    >
                      {details.tv.track.tracking ? "追踪中" : "未追踪"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">最后更新:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{formatDate(details.tv.track.latest_update)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">总集数:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{details.tv.source.episodes.length} 集</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">已下载:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {
                        details.tv.storage.episodes.filter(
                          (ep) => ep.status === "success"
                        ).length
                      }{" "}
                      集
                    </span>
                  </div>
                </div>

                {details.info.user_data.watch_progress.episode_id > 0 && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <div className="font-medium mb-1">观看进度</div>
                      <div>
                        第 {details.info.user_data.watch_progress.episode_id + 1} 集
                      </div>
                      <div>
                        {formatTime(details.info.user_data.watch_progress.time)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右侧：播放器和剧集列表 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 视频播放器 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">播放</h2>
              {selectedEpisode >= details.tv.source.episodes.length ? (
                <div className="space-y-4">
                  <div className="relative bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
                    <div className="text-center">
                      <p className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2">播放完成</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        您已观看完所有剧集
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>播放完成</span>
                  </div>
                </div>
              ) : hasVideo ? (
                <div className="space-y-4">
                  <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
                    <video
                      ref={videoRef}
                      src={currentVideoUrl}
                      controls
                      className="w-full h-full"
                      onPlay={handleVideoPlay}
                      onPause={handleVideoPause}
                      onTimeUpdate={handleVideoTimeUpdate}
                      onSeeked={() => {
                        // Seek 完成后更新播放进度
                        if (videoRef.current) {
                          updateWatchProgress(selectedEpisode, videoRef.current.currentTime);
                          setLastProgressUpdate(Date.now());
                        }
                      }}
                      onEnded={() => {
                        // 播放完成后，更新为下一集的第0秒
                        const nextEpisode = selectedEpisode + 1;
                        updateWatchProgress(nextEpisode, 0);
                        setLastProgressUpdate(Date.now());

                        // 如果不是最后一集，自动切换到下一集
                        handleEpisodeSelect(nextEpisode, true);
                      }}
                    >
                      您的浏览器不支持视频播放
                    </video>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>
                      正在播放: {details.tv.source.episodes[selectedEpisode]?.name || "全部集数已播放完成"}
                    </span>
                    {videoRef.current && (
                      <span>
                        {formatTime(videoTime)} / {formatTime(videoRef.current.duration || 0)}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
                    <div className="text-center text-gray-500 dark:text-gray-400">
                      {details.tv.storage.episodes[selectedEpisode]?.status === "running" ? (
                        <div>
                          <p className="mb-2 text-lg font-semibold text-gray-700 dark:text-gray-300">该集正在下载中...</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {details.tv.storage.episodes[selectedEpisode].name}
                          </p>
                        </div>
                      ) : details.tv.storage.episodes[selectedEpisode]?.status === "failed" ? (
                        <div>
                          <p className="mb-2 text-lg font-semibold text-red-600 dark:text-red-400">该集下载失败</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {details.tv.storage.episodes[selectedEpisode].name}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="mb-2 text-lg font-semibold text-gray-700 dark:text-gray-300">该集尚未下载</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {details.tv.source.episodes[selectedEpisode]?.name || `第 ${selectedEpisode + 1} 集`}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>
                      {details.tv.source.episodes[selectedEpisode]?.name || `第 ${selectedEpisode + 1} 集`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 剧集列表 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">剧集列表</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
                {details.tv.source.episodes.map((episode, index) => {
                  const storageEp = details.tv.storage.episodes[index];
                  const hasDownloaded = storageEp?.status === "success";
                  const isDownloading = storageEp?.status === "running";
                  const isFailed = storageEp?.status === "failed";
                  const isSelected = index === selectedEpisode;
                  const isWatched =
                    details.info.user_data.watch_progress.episode_id > index ||
                    (details.info.user_data.watch_progress.episode_id === index &&
                      details.info.user_data.watch_progress.time > 0);

                  return (
                    <button
                      key={index}
                      onClick={() => handleEpisodeSelect(index, true)}
                      disabled={!hasDownloaded && !isDownloading}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${isSelected
                        ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                        } ${!hasDownloaded && !isDownloading
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer hover:shadow-md"
                        } ${isWatched ? "bg-green-50 dark:bg-green-900/20" : ""} bg-white dark:bg-gray-800`}
                    >
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1 truncate">
                        {episode.name}
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>
                          {hasDownloaded ? (
                            <span className="text-green-600 dark:text-green-400">✓</span>
                          ) : isDownloading ? (
                            <span className="text-blue-600 dark:text-blue-400">下载中</span>
                          ) : isFailed ? (
                            <span className="text-red-600 dark:text-red-400">失败</span>
                          ) : (
                            <span>-</span>
                          )}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 编辑模态框 */}
      {showEditModal && details && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => {
            setShowEditModal(false);
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
            setActiveTab("source");
          }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">编辑</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
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
                    setActiveTab("source");
                  }}
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

              {/* Tab 内容 */}
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
                        if (!sourceSearchKeyword.trim()) return;

                        setSourceSearchLoading(true);
                        setSourceSearchResults([]);
                        setSourceSearchErrors([]);

                        try {
                          const data = await searchTV({ keyword: sourceSearchKeyword.trim() });
                          setSourceSearchResults(data.source || []);
                          setSourceSearchErrors(data.search_error || []);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "搜索时发生错误");
                          console.error("Search error:", err);
                        } finally {
                          setSourceSearchLoading(false);
                        }
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
                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 overflow-hidden" style={{
                                      display: "-webkit-box",
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: "vertical",
                                    }}>
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
                                  setError("所选剧集不存在");
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
                          setError("输入的电视剧名称不匹配");
                          return;
                        }

                        setDeleting(true);
                        setError(null);
                        try {
                          await removeTV({ id: details.tv.id });
                          // 删除成功后跳转到列表页
                          window.location.href = "/";
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "删除时发生错误");
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
                        setError(null);
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
      )}

      {/* 换源确认对话框 */}
      {showConfirmDialog && pendingSourceChange && details && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => {
            setShowConfirmDialog(false);
            setPendingSourceChange(null);
          }}
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
                          setError("所选剧集不存在");
                          return;
                        }
                        await updateEpisodeSource({
                          tv_id: details.tv.id,
                          episode_id: pendingSourceChange.episodeIndex || 0,
                          source: selectedEp.source,
                        });
                      }
                      // 刷新详情
                      await fetchTVDetails(details.tv.id);
                      setShowEditModal(false);
                      setShowConfirmDialog(false);
                      setSourceSearchResults([]);
                      setSourceSearchKeyword("");
                      setSelectedSourceIndex(null);
                      setPendingSourceChange(null);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "更新源时发生错误");
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
    </div>
  );
}
