import { useState, useEffect, useRef, useCallback } from "react";
import type { Route } from "./+types/tv-details";
import {
  getTVDetails,
  setTVTag,
  setWatchProgress,
  getSeries,
} from "../api/client";
import type {
  Tag,
  GetTVDetailsResponse,
  Series,
  GetSeriesResponse,
} from "../api/types";
import { TAG_NAMES } from "../api/types";
import TVSettingsModal from "../components/TVSettingsModal";
import Player from "xgplayer";
import "xgplayer/dist/index.min.css";

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
  const lastProgressUpdateRef = useRef<number>(0);
  const playerRef = useRef<Player | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef<boolean>(true);
  // 编辑模态框相关状态
  const [showEditModal, setShowEditModal] = useState(false);

  const updateWatchProgress = useCallback(async (episodeId: number, time: number) => {
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
  }, [details]);

  const handleEpisodeSelect = useCallback((episodeIndex: number, autoPlay: boolean = false) => {
    if (details) {
      updateWatchProgress(episodeIndex, 0);
    }

    setSelectedEpisode(episodeIndex);
    const newVideoUrl = details?.episodes[episodeIndex] || null;

    if (newVideoUrl && playerRef.current) {
      // 更新播放器视频源
      playerRef.current.src = newVideoUrl;
      setVideoTime(0);
      const now = Date.now();
      lastProgressUpdateRef.current = now; // 重置更新时间
      if (autoPlay) {
        playerRef.current.once("canplay", () => {
          playerRef.current?.play().catch((err: unknown) => {
            console.error('自动播放失败:', err);
          });
        });
      }
    } else if (!newVideoUrl && playerRef.current) {
      // 如果下一集没有视频（下载中、下载失败或未下载），停止并清空播放器
      playerRef.current.pause();
      playerRef.current.src = '';
      setVideoTime(0);
      setIsPlaying(false);
    }
  }, [details, updateWatchProgress]);

  useEffect(() => {
    if (id) {
      setLoading(true);
      fetchTVDetails(parseInt(id));
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (details) {
      isInitialLoadRef.current = true;
      setSelectedEpisode(details.info.user_data.watch_progress.episode_id);
      // 其他初始化逻辑会在初始化 xgplayer 时执行

      // 同步 ref
      lastProgressUpdateRef.current = Date.now();
    }
  }, [details]);

  useEffect(() => {
    if (details && details.info.series.length > 0) {
      fetchSeries(details.info.series);
    }
  }, [details]);

  // 初始化 xgplayer
  useEffect(() => {
    if (!playerContainerRef.current || !details) return;

    // 如果播放器已存在，先销毁
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    const currentVideoUrl = details.episodes[selectedEpisode];
    if (!currentVideoUrl) return;

    // 创建播放器实例
    const player = new Player({
      el: playerContainerRef.current,
      url: currentVideoUrl,
      autoplay: false,
      volume: 0.6,
      playbackRate: [0.5, 0.75, 1, 1.25, 1.5, 2],
      defaultPlaybackRate: 1,
      fluid: true,
      lang: "zh-cn",
    });

    playerRef.current = player;

    // 只在初始加载时恢复播放进度
    const shouldRestoreProgress = isInitialLoadRef.current &&
      details.info.user_data.watch_progress.episode_id === selectedEpisode;

    if (shouldRestoreProgress) {
      const savedTime = details.info.user_data.watch_progress.time;
      if (savedTime > 0) {
        player.once("canplay", () => {
          player.currentTime = savedTime;
          // 恢复进度后，标记初始加载完成
          isInitialLoadRef.current = false;
        });
      } else {
        // 如果没有保存的进度，直接标记初始加载完成
        isInitialLoadRef.current = false;
      }
    } else {
      // 如果不是需要恢复进度的情况，标记初始加载完成
      isInitialLoadRef.current = false;
    }

    // 监听播放事件
    player.on("play", () => {
      setIsPlaying(true);
    });

    // 监听暂停事件
    player.on("pause", () => {
      setIsPlaying(false);
      if (playerRef.current) {
        updateWatchProgress(selectedEpisode, playerRef.current.currentTime);
        const now = Date.now();
        lastProgressUpdateRef.current = now;
      }
    });

    // 监听时间更新事件
    player.on("timeupdate", () => {
      if (playerRef.current) {
        const currentTime = playerRef.current.currentTime;
        setVideoTime(currentTime);

        // 每5秒更新一次播放进度
        const now = Date.now();
        if (now - lastProgressUpdateRef.current >= 5000) {
          updateWatchProgress(selectedEpisode, currentTime);
          lastProgressUpdateRef.current = now;
        }
      }
    });

    // 监听跳转完成事件
    player.on("seeked", () => {
      if (playerRef.current) {
        updateWatchProgress(selectedEpisode, playerRef.current.currentTime);
        const now = Date.now();
        lastProgressUpdateRef.current = now;
      }
    });

    // 监听播放结束事件
    player.on("ended", () => {
      // 播放完成后，更新为下一集的第0秒
      const nextEpisode = selectedEpisode + 1;
      updateWatchProgress(nextEpisode, 0);
      const now = Date.now();
      lastProgressUpdateRef.current = now;

      handleEpisodeSelect(nextEpisode, true);
    });

    // 清理函数
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [details, selectedEpisode, updateWatchProgress, handleEpisodeSelect]);

  const fetchTVDetails = async (tvId: number) => {
    setError(null);
    try {
      const data = await getTVDetails({ id: tvId });
      setDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取电视剧详情时发生错误");
      console.error("Fetch TV details error:", err);
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
                      <span className="text-gray-600 dark:text-gray-400">播放列表:</span>
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
                    <span className="text-gray-600 dark:text-gray-400">追更状态:</span>
                    <span
                      className={`font-medium ${details.tv.track.tracking ? "text-green-600 dark:text-green-400" : "text-gray-400 dark:text-gray-500"
                        }`}
                    >
                      {details.tv.track.tracking ? "追更中" : "未追更"}
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
              <div className="space-y-4">
                <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
                  {/* 播放器容器始终渲染，但根据情况隐藏 */}
                  <div ref={playerContainerRef} className={`w-full h-full ${hasVideo && selectedEpisode < details.tv.source.episodes.length ? '' : 'hidden'}`}></div>

                  {/* 播放完成提示 */}
                  {selectedEpisode >= details.tv.source.episodes.length && (
                    <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2">播放完成</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          您已观看完所有剧集
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 无视频时的提示 */}
                  {!hasVideo && selectedEpisode < details.tv.source.episodes.length && (
                    <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
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
                  )}
                </div>

                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                  {selectedEpisode >= details.tv.source.episodes.length ? (
                    <span>播放完成</span>
                  ) : hasVideo ? (
                    <>
                      <span>
                        正在播放: {details.tv.source.episodes[selectedEpisode]?.name || "全部集数已播放完成"}
                      </span>
                      {playerRef.current && (
                        <span>
                          {formatTime(videoTime)} / {formatTime(playerRef.current.duration || 0)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span>
                      {details.tv.source.episodes[selectedEpisode]?.name || `第 ${selectedEpisode + 1} 集`}
                    </span>
                  )}
                </div>
              </div>
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
      {details && (
        <TVSettingsModal
          show={showEditModal}
          details={details}
          onClose={() => setShowEditModal(false)}
          onUpdate={async () => {
            if (details) {
              await fetchTVDetails(details.tv.id);
            }
          }}
        />
      )}
    </div>
  );
}
