import { useState } from "react";
import type { Route } from "./+types/add-tv";

// 定义 API 响应类型
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

interface SearchError {
  source_name: string;
  source_key: string;
  error: string;
}

interface SearchTVResponse {
  source: Source[];
  search_error: SearchError[];
}

interface AddTVResponse {
  id: number;
}

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "添加TV" },
    { name: "description", content: "搜索并添加新的TV" },
  ];
}

export default function AddTV() {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchErrors, setSearchErrors] = useState<SearchError[]>([]);
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [addError, setAddError] = useState<Map<number, string>>(new Map());

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setSearchErrors([]);

    try {
      const response = await fetch("/api/search_tv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`搜索失败: ${response.statusText} - ${errorText}`);
      }

      const data: SearchTVResponse = await response.json();
      setResults(data.source || []);
      setSearchErrors(data.search_error || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "搜索时发生错误");
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTV = async (source: Source, index: number) => {
    setAddingIds((prev) => new Set(prev).add(index));
    setAddError((prev) => {
      const newMap = new Map(prev);
      newMap.delete(index);
      return newMap;
    });

    try {
      const response = await fetch("/api/add_tv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: source.name,
          source: source,
          tracking: false,
          series: [],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`添加失败: ${response.statusText} - ${errorText}`);
      }

      const data: AddTVResponse = await response.json();
      setAddedIds((prev) => new Set(prev).add(index));
      console.log(`TV 添加成功，ID: ${data.id}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "添加时发生错误";
      setAddError((prev) => new Map(prev).set(index, errorMessage));
      console.error("Add TV error:", err);
    } finally {
      setAddingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 搜索表单 */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-4">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="输入电视剧名称..."
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !keyword.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            {loading ? "搜索中..." : "搜索"}
          </button>
        </div>
      </form>

      {/* 错误信息 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* 搜索错误信息 */}
      {searchErrors.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-3">
            搜索过程中部分来源出现错误 ({searchErrors.length})
          </h3>
          <div className="space-y-2">
            {searchErrors.map((searchError, index) => (
              <div
                key={index}
                className="p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded text-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-yellow-900 dark:text-yellow-200">
                      {searchError.source_name}
                    </p>
                    <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                      {searchError.error}
                    </p>
                  </div>
                  <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-200 dark:bg-yellow-800 px-2 py-1 rounded">
                    {searchError.source_key}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 搜索结果 */}
      {results.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            找到 {results.length} 个结果
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {results.map((source, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-visible relative"
              >
                <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700 overflow-hidden relative">
                  {source.cover_url ? (
                    <img
                      src={source.cover_url}
                      alt={source.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      无封面
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 flex-1">
                      {source.name}
                    </h3>
                    <a
                      href={source.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors dark:bg-blue-700 dark:hover:bg-blue-600 flex-shrink-0"
                      title="前往源地址"
                    >
                      前往
                    </a>
                  </div>
                  {source.episodes && source.episodes.length > 0 && (
                    <details className="mb-2">
                      <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                        {source.episodes?.length || 0} 集
                      </summary>
                      <ul className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                        {source.episodes.map((episode, epIndex) => (
                          <li
                            key={epIndex}
                            className="text-xs text-gray-600 dark:text-gray-400 py-0.5 px-1.5 bg-gray-50 dark:bg-gray-700 rounded"
                          >
                            <a
                              href={episode.source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                            >
                              {episode.name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <div className="mt-2">
                    {addedIds.has(index) ? (
                      <div className="px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-400 text-sm text-center">
                        ✓ 已添加
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddTV(source, index)}
                        disabled={addingIds.has(index)}
                        className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-green-700 dark:hover:bg-green-600"
                      >
                        {addingIds.has(index) ? "添加中..." : "添加"}
                      </button>
                    )}
                    {addError.has(index) && (
                      <div className="mt-1 px-2 py-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-xs">
                        {addError.get(index)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 无结果提示 */}
      {!loading && results.length === 0 && keyword && !error && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>未找到相关结果，请尝试其他关键词</p>
        </div>
      )}

      {/* 初始状态提示 */}
      {!loading && results.length === 0 && !keyword && !error && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>请输入关键词开始搜索</p>
        </div>
      )}
    </div>
  );
}
