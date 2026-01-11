import { useState, useEffect } from "react";
import type { Route } from "./+types/series-list";

// 定义类型
type Tag = "watching" | "wanted" | "watched" | "on_hold" | "not_tagged";

interface WatchProgress {
  episode_id: number;
  time: number;
}

interface UserTVData {
  tv_id: number;
  tag: Tag;
  watch_progress: WatchProgress;
  last_update: string; // ISO datetime string
}

interface TVInfo {
  id: number;
  name: string;
  cover_url: string;
  series: number[];
  last_update: string; // ISO datetime string
  total_episodes: number;
  user_data: UserTVData;
}

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

  // 获取系列列表和 TV 信息
  const fetchSeries = async () => {
    try {
      setLoading(true);
      setError(null);

      // 获取系列列表
      const seriesResponse = await fetch("/api/get_series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: null }),
      });

      if (!seriesResponse.ok) {
        throw new Error(`HTTP error! status: ${seriesResponse.status}`);
      }

      const seriesData: GetSeriesResponse = await seriesResponse.json();

      // 收集所有 TV ID
      const allTVIds = new Set<number>();
      seriesData.series.forEach((series) => {
        series.tvs.forEach((tvId) => allTVIds.add(tvId));
      });

      // 获取所有 TV 信息
      const tvResponse = await fetch("/api/get_tv_infos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: Array.from(allTVIds) }),
      });

      if (!tvResponse.ok) {
        throw new Error(`HTTP error! status: ${tvResponse.status}`);
      }

      const tvData: GetTVInfosResponse = await tvResponse.json();

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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-600">错误: {error}</div>
        <button
          onClick={fetchSeries}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          系列列表
        </h1>
      </div>

      {seriesList.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">
          暂无系列
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {seriesList.map((series) => {
            const firstTV = series.tvInfos[0];
            const coverUrl = firstTV?.cover_url || null;

            return (
              <div
                key={series.id}
                className="block bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-visible relative"
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
