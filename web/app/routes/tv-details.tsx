import { useState, useEffect, useRef } from "react";
import type { Route } from "./+types/tv-details";

// 定义 API 响应类型
interface WatchProgress {
  episode_id: number;
  time: number;
}

type Tag = "watching" | "wanted" | "watched" | "on_hold" | "not_tagged";

interface UserTVData {
  tv_id: number;
  tag: Tag;
  watch_progress: WatchProgress;
  last_update: string;
}

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

type DownloadStatus = "running" | "success" | "failed";

interface StorageEpisode {
  name: string;
  filename: string;
  status: DownloadStatus;
}

interface Storage {
  directory: string;
  episodes: StorageEpisode[];
  cover: string;
}

interface TrackStatus {
  tracking: boolean;
  latest_update: string;
}

interface TV {
  id: number;
  name: string;
  source: Source;
  storage: Storage;
  track: TrackStatus;
  series: number[];
}

interface TVInfo {
  id: number;
  name: string;
  cover_url: string;
  series: number[];
  last_update: string;
  user_data: UserTVData;
}

interface GetTVDetailsResponse {
  tv: TV;
  info: TVInfo;
  episodes: (string | null)[];
}

interface SetTVTagRequest {
  tv_id: number;
  tag: Tag;
}

interface Series {
  id: number;
  name: string;
  tvs: number[];
  last_update: string;
}

interface GetSeriesResponse {
  series: Series[];
}

const TAG_NAMES: Record<Tag, string> = {
  watching: "观看中",
  wanted: "想看",
  watched: "已看完",
  on_hold: "暂停",
  not_tagged: "未标记",
};

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
      const response = await fetch("/api/get_tv_details", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: tvId }),
      });

      if (!response.ok) {
        throw new Error(`获取电视剧详情失败: ${response.statusText}`);
      }

      const data: GetTVDetailsResponse = await response.json();
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
      const response = await fetch("/api/get_series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: seriesIds }),
      });

      if (!response.ok) {
        console.error("获取系列信息失败");
        return;
      }

      const data: GetSeriesResponse = await response.json();
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
      const request: SetTVTagRequest = {
        tv_id: details.tv.id,
        tag: newTag,
      };

      const response = await fetch("/api/set_tv_tag", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`更新标签失败: ${response.statusText}`);
      }

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
      const response = await fetch("/api/set_watch_progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tv_id: details.tv.id,
          episode_id: episodeId,
          time: time,
        }),
      });

      if (!response.ok) {
        console.error("更新播放进度失败:", response.statusText);
      }
    } catch (err) {
      console.error("Update watch progress error:", err);
    }
  };

  const handleEpisodeSelect = (episodeIndex: number) => {
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
            href="/tv-list"
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{details.tv.name}</h1>
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
                        handleEpisodeSelect(nextEpisode);
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
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-12 text-center text-gray-500 dark:text-gray-400">
                  {details.tv.storage.episodes[selectedEpisode]?.status === "running" ? (
                    <div>
                      <p className="mb-2">该集正在下载中...</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500">
                        {details.tv.storage.episodes[selectedEpisode].name}
                      </p>
                    </div>
                  ) : details.tv.storage.episodes[selectedEpisode]?.status === "failed" ? (
                    <div>
                      <p className="mb-2 text-red-600 dark:text-red-400">该集下载失败</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500">
                        {details.tv.storage.episodes[selectedEpisode].name}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="mb-2">该集尚未下载</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500">
                        {details.tv.source.episodes[selectedEpisode]?.name || `第 ${selectedEpisode + 1} 集`}
                      </p>
                    </div>
                  )}
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
                      onClick={() => handleEpisodeSelect(index)}
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
    </div>
  );
}
