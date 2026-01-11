import { useState, useEffect } from "react";
import type { Route } from "./+types/downloads";
import { getDownloadProgress } from "../api/client";
import type {
  DownloadProgress,
  DownloadProgressWithName,
  GetDownloadProgressResponse,
} from "../api/types";

// 格式化字节数
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let size = Math.abs(bytes);

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  if (size >= 100) {
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  } else if (size >= 10) {
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  } else {
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

// 格式化速度
function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return "0 B/s";
  return `${formatBytes(bytesPerSecond)}/s`;
}

// 格式化时间
function formatTime(seconds: number): string {
  if (seconds < 0 || !isFinite(seconds)) return "未知";

  if (seconds < 60) {
    return `${Math.floor(seconds)}秒`;
  }

  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  if (minutes < 60) {
    return `${minutes}分${secs}秒`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}小时${mins}分${secs}秒`;
}

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "下载进度" },
    { name: "description", content: "监控下载进度" },
  ];
}

export default function Downloads() {
  const [progressList, setProgressList] = useState<DownloadProgressWithName[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = async () => {
    try {
      const data = await getDownloadProgress({});
      setProgressList(data.progress || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取进度时发生错误");
      console.error("Fetch progress error:", err);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载和自动刷新
  useEffect(() => {
    fetchProgress();

    const interval = setInterval(fetchProgress, 1000); // 每1秒刷新一次
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getProgressPercentage = (progress: DownloadProgress): number => {
    if (!progress.downloading || progress.total_size <= 0) return 0;
    return Math.min((progress.downloaded_size / progress.total_size) * 100, 100);
  };

  const getRemainingTime = (progress: DownloadProgress): string => {
    if (!progress.downloading || progress.speed <= 0 || progress.total_size <= 0) {
      return "未知";
    }
    const remainingBytes = progress.total_size - progress.downloaded_size;
    if (remainingBytes <= 0) return "完成";
    const remainingSeconds = remainingBytes / progress.speed;
    return formatTime(remainingSeconds);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          下载进度
        </h1>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* 下载列表 */}
      {progressList.length === 0 && !loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>当前没有下载任务</p>
        </div>
      ) : (
        <div className="space-y-4">
          {progressList.map((item, index) => {
            const progress = item.progress;
            const percentage = getProgressPercentage(progress);
            const remainingTime = getRemainingTime(progress);

            return (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {item.name || "未知任务"}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>
                        状态:{" "}
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {progress.status || "未知"}
                        </span>
                      </span>
                      {progress.downloading && (
                        <>
                          <span>速度: {formatSpeed(progress.speed)}</span>
                          <span>剩余: {remainingTime}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* 进度条 */}
                {progress.downloading && progress.total_size > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatBytes(progress.downloaded_size)} /{" "}
                        {formatBytes(progress.total_size)}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 详细信息 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">已下载:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {formatBytes(progress.downloaded_size)}
                    </p>
                  </div>
                  {progress.total_size > 0 && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">总大小:</span>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {formatBytes(progress.total_size)}
                      </p>
                    </div>
                  )}
                  {progress.downloading && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">下载速度:</span>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {formatSpeed(progress.speed)}
                      </p>
                    </div>
                  )}
                  {progress.downloading && progress.total_size > 0 && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">剩余时间:</span>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {remainingTime}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 加载状态 */}
      {loading && progressList.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>加载中...</p>
        </div>
      )}
    </div>
  );
}
