import { useState } from "react";
import type { Route } from "./+types/search";

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

interface SearchTVResponse {
  source: Source[];
}

interface AddTVResponse {
  id: number;
}

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "搜索电视剧" },
    { name: "description", content: "搜索电视剧资源" },
  ];
}

export default function Search() {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">搜索电视剧</h1>
          <a
            href="/downloads"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
          >
            查看下载进度
          </a>
        </div>

        {/* 搜索表单 */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-4">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="输入电视剧名称..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !keyword.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "搜索中..." : "搜索"}
            </button>
          </div>
        </form>

        {/* 错误信息 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* 搜索结果 */}
        {results.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">
              找到 {results.length} 个结果
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((source, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {source.cover_url && (
                    <img
                      src={source.cover_url}
                      alt={source.name}
                      className="w-full h-64 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {source.name}
                    </h3>
                    <div className="text-sm text-gray-600 mb-3">
                      <p>
                        <span className="font-medium">来源:</span>{" "}
                        {source.source.source_name}
                      </p>
                      <p>
                        <span className="font-medium">频道:</span>{" "}
                        {source.source.channel_name}
                      </p>
                      <p>
                        <span className="font-medium">集数:</span>{" "}
                        {source.episodes?.length || 0} 集
                      </p>
                    </div>
                    {source.episodes && source.episodes.length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                          查看剧集列表 ({source.episodes.length})
                        </summary>
                        <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                          {source.episodes.map((episode, epIndex) => (
                            <li
                              key={epIndex}
                              className="text-xs text-gray-600 py-1 px-2 bg-gray-50 rounded"
                            >
                              {episode.name}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <div className="mt-4">
                      {addedIds.has(index) ? (
                        <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm text-center">
                          ✓ 已添加
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddTV(source, index)}
                          disabled={addingIds.has(index)}
                          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {addingIds.has(index) ? "添加中..." : "添加到列表"}
                        </button>
                      )}
                      {addError.has(index) && (
                        <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
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
          <div className="text-center py-12 text-gray-500">
            <p>未找到相关结果，请尝试其他关键词</p>
          </div>
        )}

        {/* 初始状态提示 */}
        {!loading && results.length === 0 && !keyword && !error && (
          <div className="text-center py-12 text-gray-500">
            <p>请输入关键词开始搜索</p>
          </div>
        )}
      </div>
    </div>
  );
}

