import type { TVInfo } from "../api/types";

export type { TVInfo };

interface TVCardProps {
  tv: TVInfo;
  showBadge?: boolean;
}

function getWatchedLabel(
  episodeId: number,
  time: number,
  totalEpisodes: number
): string {
  const total = totalEpisodes;
  const suffix = ` / 共 ${total} 集`;
  if (episodeId === 0 && time === 0) {
    return "未观看" + suffix;
  }
  if (episodeId >= total) {
    return "已看完" + suffix;
  }
  return `第 ${episodeId + 1} 集` + suffix;
}

export default function TVCard({ tv, showBadge = false }: TVCardProps) {
  const { episode_id, time } = tv.user_data.watch_progress;
  const unwatchedEpisodes =
    tv.total_episodes - tv.user_data.watch_progress.episode_id;

  return (
    <a
      href={`/tv/${tv.id}`}
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
      {showBadge && unwatchedEpisodes > 0 && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg z-10">
          {unwatchedEpisodes}
        </div>
      )}
      <div className="p-3">
        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">
          {tv.name}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {getWatchedLabel(episode_id, time, tv.total_episodes)}
        </p>
      </div>
    </a>
  );
}
