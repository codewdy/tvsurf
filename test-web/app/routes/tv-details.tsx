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

interface SetWatchProgressRequest {
  tv_id: number;
  episode_id: number;
  time: number;
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
  const [savingProgress, setSavingProgress] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (id) {
      fetchTVDetails(parseInt(id));
    }
    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
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

  const handleEpisodeSelect = (episodeIndex: number) => {
    // 保存当前集数的观看进度
    saveWatchProgress(selectedEpisode);

    setSelectedEpisode(episodeIndex);
    if (videoRef.current) {
      const newVideoUrl = details?.episodes[episodeIndex] || null;
      if (newVideoUrl) {
        videoRef.current.src = newVideoUrl;
        videoRef.current.load();
        setVideoTime(0);
      }
    }
  };

  const handleVideoPlay = () => {
    setIsPlaying(true);
    // 开始定期保存观看进度
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }
    progressTimerRef.current = setInterval(() => {
      if (videoRef.current) {
        setVideoTime(videoRef.current.currentTime);
        saveWatchProgress(selectedEpisode, videoRef.current.currentTime, false);
      }
    }, 5000); // 每5秒保存一次
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    // 暂停时立即保存进度
    if (videoRef.current) {
      saveWatchProgress(selectedEpisode, videoRef.current.currentTime, true);
    }
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      setVideoTime(videoRef.current.currentTime);
    }
  };

  const saveWatchProgress = async (
    episodeId: number,
    time?: number,
    immediate: boolean = false
  ) => {
    if (!details || savingProgress) return;
    if (!immediate && time !== undefined && Date.now() % 10000 >= 5000) {
      // 如果不是立即保存，且不是每10秒的节点，跳过
      return;
    }

    const currentTime = time ?? videoRef.current?.currentTime ?? 0;
    if (currentTime < 1) return; // 忽略初始加载时间

    setSavingProgress(true);
    try {
      const request: SetWatchProgressRequest = {
        tv_id: details.tv.id,
        episode_id: episodeId,
        time: currentTime,
      };

      const response = await fetch("/api/set_watch_progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        console.error("保存观看进度失败");
        return;
      }

      // 更新本地状态
      setDetails({
        ...details,
        info: {
          ...details.info,
          user_data: {
            ...details.info.user_data,
            watch_progress: {
              episode_id: episodeId,
              time: currentTime,
            },
          },
        },
      });
    } catch (err) {
      console.error("Save watch progress error:", err);
    } finally {
      setSavingProgress(false);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error || "未找到电视剧详情"}
          </div>
          <a
            href="/tv-list"
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* 导航栏 */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href="/tv-list"
              className="text-blue-600 hover:text-blue-800 transition-colors"
            >
              ← 返回列表
            </a>
            <h1 className="text-3xl font-bold text-gray-900">{details.tv.name}</h1>
          </div>
          <div className="flex gap-2">
            <a
              href="/search"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              搜索
            </a>
            <a
              href="/tv-list"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
            >
              列表
            </a>
          </div>
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：电视剧信息 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    标签
                  </label>
                  <select
                    value={details.info.user_data.tag}
                    onChange={(e) => handleTagChange(e.target.value as Tag)}
                    disabled={updatingTag}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {Object.entries(TAG_NAMES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">来源:</span>
                    <span className="font-medium">{details.tv.source.source.source_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">频道:</span>
                    <span className="font-medium">{details.tv.source.source.channel_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">追踪状态:</span>
                    <span
                      className={`font-medium ${details.tv.track.tracking ? "text-green-600" : "text-gray-400"
                        }`}
                    >
                      {details.tv.track.tracking ? "追踪中" : "未追踪"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">最后更新:</span>
                    <span className="font-medium">{formatDate(details.tv.track.latest_update)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">总集数:</span>
                    <span className="font-medium">{details.tv.source.episodes.length} 集</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">已下载:</span>
                    <span className="font-medium">
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
                  <div className="pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
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
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">播放</h2>
              {hasVideo ? (
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
                      onEnded={() => {
                        // 播放结束后，自动切换到下一集
                        if (selectedEpisode < details.tv.source.episodes.length - 1) {
                          const nextEpisode = selectedEpisode + 1;
                          if (details.episodes[nextEpisode]) {
                            handleEpisodeSelect(nextEpisode);
                            // 更新观看进度为下一集
                            saveWatchProgress(nextEpisode, 0, true);
                          }
                        }
                      }}
                    >
                      您的浏览器不支持视频播放
                    </video>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>
                      正在播放: {details.tv.source.episodes[selectedEpisode]?.name || `第 ${selectedEpisode + 1} 集`}
                    </span>
                    {videoRef.current && (
                      <span>
                        {formatTime(videoTime)} / {formatTime(videoRef.current.duration || 0)}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-100 rounded-lg p-12 text-center text-gray-500">
                  {details.tv.storage.episodes[selectedEpisode]?.status === "running" ? (
                    <div>
                      <p className="mb-2">该集正在下载中...</p>
                      <p className="text-sm text-gray-400">
                        {details.tv.storage.episodes[selectedEpisode].name}
                      </p>
                    </div>
                  ) : details.tv.storage.episodes[selectedEpisode]?.status === "failed" ? (
                    <div>
                      <p className="mb-2 text-red-600">该集下载失败</p>
                      <p className="text-sm text-gray-400">
                        {details.tv.storage.episodes[selectedEpisode].name}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="mb-2">该集尚未下载</p>
                      <p className="text-sm text-gray-400">
                        {details.tv.source.episodes[selectedEpisode]?.name || `第 ${selectedEpisode + 1} 集`}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 剧集列表 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">剧集列表</h2>
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
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                        } ${!hasDownloaded && !isDownloading
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer hover:shadow-md"
                        } ${isWatched ? "bg-green-50" : ""}`}
                    >
                      <div className="text-sm font-medium text-gray-900 mb-1 truncate">
                        {episode.name}
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>第 {index + 1} 集</span>
                        <span>
                          {hasDownloaded ? (
                            <span className="text-green-600">✓</span>
                          ) : isDownloading ? (
                            <span className="text-blue-600">下载中</span>
                          ) : isFailed ? (
                            <span className="text-red-600">失败</span>
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
