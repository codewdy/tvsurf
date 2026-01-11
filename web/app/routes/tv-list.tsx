import { useState, useEffect } from "react";
import type { Route } from "./+types/tv-list";

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

interface GetTVInfosResponse {
  tvs: TVInfo[];
}

// Tag 显示名称映射
const TAG_NAMES: Record<Tag, string> = {
  watching: "观看中",
  wanted: "想看",
  watched: "已看",
  on_hold: "暂停",
  not_tagged: "未标记",
};

// Tag 顺序
const TAG_ORDER: Tag[] = ["watching", "wanted", "on_hold", "watched", "not_tagged"];

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "TV 列表" },
    { name: "description", content: "所有 TV 列表，按标签分组" },
  ];
}

export default function TVList() {
  const [tvs, setTVs] = useState<TVInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 折叠状态：watching 默认展开，其他默认折叠
  const [expandedTags, setExpandedTags] = useState<Record<Tag, boolean>>({
    watching: true,
    wanted: false,
    watched: false,
    on_hold: false,
    not_tagged: false,
  });

  // 获取 TV 列表
  const fetchTVs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/get_tv_infos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: null }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: GetTVInfosResponse = await response.json();
      setTVs(data.tvs);
    } catch (err) {
      console.error("Fetch TVs error:", err);
      setError(err instanceof Error ? err.message : "获取 TV 列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTVs();
  }, []);

  // 按 tag 分组并排序
  const groupedTVs = () => {
    const groups: Record<Tag, TVInfo[]> = {
      watching: [],
      wanted: [],
      watched: [],
      on_hold: [],
      not_tagged: [],
    };

    // 按 tag 分组
    tvs.forEach((tv) => {
      groups[tv.user_data.tag].push(tv);
    });

    // 对每个组进行排序：按 User 更新时间和 TV 更新时间较大值排序
    Object.keys(groups).forEach((tag) => {
      groups[tag as Tag].sort((a, b) => {
        const aMaxTime = Math.max(
          new Date(a.last_update).getTime(),
          new Date(a.user_data.last_update).getTime()
        );
        const bMaxTime = Math.max(
          new Date(b.last_update).getTime(),
          new Date(b.user_data.last_update).getTime()
        );
        return bMaxTime - aMaxTime; // 降序，最新的在前
      });
    });

    return groups;
  };

  const groups = groupedTVs();

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
          onClick={fetchTVs}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {TAG_ORDER.map((tag) => {
        const tagTVs = groups[tag];
        if (tagTVs.length === 0) return null;

        const isExpanded = expandedTags[tag];

        return (
          <div key={tag} className="mb-8">
            <button
              onClick={() => {
                setExpandedTags((prev) => ({
                  ...prev,
                  [tag]: !prev[tag],
                }));
              }}
              className="flex items-center gap-2 mb-4 text-gray-800 dark:text-gray-200 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg
                className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-90" : ""
                  }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              <h2 className="text-2xl font-semibold">
                {TAG_NAMES[tag]} ({tagTVs.length})
              </h2>
            </button>
            {isExpanded && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {tagTVs.map((tv) => {
                  const unwatchedEpisodes =
                    tv.total_episodes - tv.user_data.watch_progress.episode_id;
                  const showBadge = tag === "watching" && unwatchedEpisodes > 0;

                  return (
                    <a
                      key={tv.id}
                      href={`/tv-details/${tv.id}`}
                      className="block bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-visible relative"
                    >
                      <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700 overflow-hidden relative">
                        {tv.cover_url ? (
                          <img
                            src={tv.cover_url}
                            alt={tv.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            无封面
                          </div>
                        )}
                      </div>
                      {showBadge && (
                        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg z-10">
                          {unwatchedEpisodes}
                        </div>
                      )}
                      <div className="p-3">
                        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">
                          {tv.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {tv.user_data.watch_progress.episode_id > 0
                            ? `第 ${tv.user_data.watch_progress.episode_id} 集 / 共 ${tv.total_episodes} 集`
                            : `未观看 / 共 ${tv.total_episodes} 集`}
                        </p>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {tvs.length === 0 && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">
          暂无 TV
        </div>
      )}
    </div>
  );
}
