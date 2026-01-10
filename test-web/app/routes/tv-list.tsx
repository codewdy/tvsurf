import { useState, useEffect, useMemo } from "react";
import type { Route } from "./+types/tv-list";

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
  last_update: string; // ISO datetime string
}

interface TVInfo {
  id: number;
  name: string;
  series: number[];
  last_update: string; // ISO datetime string
  user_data: UserTVData;
}

interface GetTVInfosResponse {
  tvs: TVInfo[];
}

interface SetTVTagRequest {
  tv_id: number;
  tag: Tag;
}

const TAG_NAMES: Record<Tag, string> = {
  watching: "观看中",
  wanted: "想看",
  watched: "已看完",
  on_hold: "暂停",
  not_tagged: "未标记",
};

const TAG_ORDER: Tag[] = ["watching", "wanted", "on_hold", "watched", "not_tagged"];

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "电视剧列表" },
    { name: "description", content: "按标签分组的电视剧列表" },
  ];
}

export default function TVList() {
  const [tvs, setTvs] = useState<TVInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingTags, setUpdatingTags] = useState<Set<number>>(new Set());

  const fetchTVs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/get_tv_infos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`获取电视剧列表失败: ${response.statusText}`);
      }

      const data: GetTVInfosResponse = await response.json();
      setTvs(data.tvs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取电视剧列表时发生错误");
      console.error("Fetch TVs error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTVs();
  }, []);

  const handleTagChange = async (tvId: number, newTag: Tag) => {
    setUpdatingTags((prev) => new Set(prev).add(tvId));
    setError(null);
    try {
      const request: SetTVTagRequest = {
        tv_id: tvId,
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

      // 刷新列表
      await fetchTVs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新标签时发生错误");
      console.error("Set tag error:", err);
    } finally {
      setUpdatingTags((prev) => {
        const newSet = new Set(prev);
        newSet.delete(tvId);
        return newSet;
      });
    }
  };

  // 按 tag 分组，并按更新时间排序
  const groupedTVs = useMemo(() => {
    // 计算每个 TV 的最大更新时间
    const tvsWithMaxUpdate = tvs.map((tv) => {
      const tvUpdate = new Date(tv.last_update).getTime();
      const userUpdate = new Date(tv.user_data.last_update).getTime();
      const maxUpdate = Math.max(tvUpdate, userUpdate);
      return { ...tv, maxUpdate };
    });

    // 按 tag 分组
    const grouped: Record<Tag, typeof tvsWithMaxUpdate> = {
      watching: [],
      wanted: [],
      watched: [],
      on_hold: [],
      not_tagged: [],
    };

    tvsWithMaxUpdate.forEach((tv) => {
      grouped[tv.user_data.tag].push(tv);
    });

    // 每组内按最大更新时间降序排序（最新的在前）
    Object.keys(grouped).forEach((tag) => {
      grouped[tag as Tag].sort((a, b) => b.maxUpdate - a.maxUpdate);
    });

    return grouped;
  }, [tvs]);

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === "0001-01-01T00:00:00") {
      return "从未更新";
    }
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return "今天";
      } else if (diffDays === 1) {
        return "昨天";
      } else if (diffDays < 7) {
        return `${diffDays} 天前`;
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} 周前`;
      } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} 个月前`;
      } else {
        return date.toLocaleDateString("zh-CN");
      }
    } catch {
      return "未知时间";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">电视剧列表</h1>
          <div className="flex gap-2">
            <a
              href="/search"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-sm"
            >
              搜索电视剧
            </a>
            <a
              href="/series"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors text-sm"
            >
              系列管理
            </a>
            <a
              href="/downloads"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors text-sm"
            >
              下载进度
            </a>
          </div>
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* 加载状态 */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <p>加载中...</p>
          </div>
        ) : (
          // 按 tag 分组显示
          <div className="space-y-8">
            {TAG_ORDER.map((tag) => {
              const tagTVs = groupedTVs[tag];
              if (tagTVs.length === 0) {
                return null;
              }

              return (
                <div key={tag} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {TAG_NAMES[tag]} ({tagTVs.length})
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tagTVs.map((tv) => {
                        const tvUpdate = new Date(tv.last_update).getTime();
                        const userUpdate = new Date(tv.user_data.last_update).getTime();
                        const maxUpdate = Math.max(tvUpdate, userUpdate);
                        const isUpdating = updatingTags.has(tv.id);

                        return (
                          <div
                            key={tv.id}
                            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <h3 className="text-lg font-semibold text-gray-900 flex-1">
                                {tv.name}
                              </h3>
                              <select
                                value={tv.user_data.tag}
                                onChange={(e) =>
                                  handleTagChange(tv.id, e.target.value as Tag)
                                }
                                disabled={isUpdating}
                                className="ml-2 px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {TAG_ORDER.map((t) => (
                                  <option key={t} value={t}>
                                    {TAG_NAMES[t]}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-2 text-sm text-gray-600">
                              <div className="flex justify-between">
                                <span className="font-medium">TV 更新时间:</span>
                                <span>{formatDate(tv.last_update)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium">用户更新时间:</span>
                                <span>{formatDate(tv.user_data.last_update)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium">最后活动:</span>
                                <span className="font-semibold text-blue-600">
                                  {formatDate(new Date(maxUpdate).toISOString())}
                                </span>
                              </div>
                              {tv.series.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-200">
                                  <span className="text-xs text-gray-500">
                                    包含在 {tv.series.length} 个系列中
                                  </span>
                                </div>
                              )}
                              {tv.user_data.watch_progress.episode_id > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-200">
                                  <span className="text-xs text-gray-500">
                                    看到第 {tv.user_data.watch_progress.episode_id} 集
                                  </span>
                                </div>
                              )}
                            </div>

                            {isUpdating && (
                              <div className="mt-2 text-xs text-blue-600">更新中...</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 如果没有 TV */}
            {tvs.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>当前没有电视剧，前往搜索页面添加电视剧</p>
                <a
                  href="/search"
                  className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  搜索电视剧
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
