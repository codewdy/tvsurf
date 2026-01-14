import { useState, useEffect } from "react";
import type { Route } from "./+types/config";
import { getConfig, setConfig } from "../api/client";
import type {
  Config,
  GetConfigResponse,
  SetConfigRequest,
} from "../api/types";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "系统配置" },
    { name: "description", content: "查看和修改系统配置信息" },
  ];
}

// TimeDelta格式说明的tooltip组件
function TimeDeltaTooltip() {
  return (
    <div className="group relative inline-block">
      <svg
        className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help inline-block ml-1"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-80 p-3 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
        <div className="space-y-1">
          <div className="font-semibold mb-2">支持的TimeDelta格式：</div>
          <div>• 简单格式：<code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">1d</code>, <code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">2h</code>, <code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">30m</code>, <code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">45s</code></div>
          <div>• 组合格式：<code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">1d2h30m</code>, <code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">2h30m</code>, <code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">1h30m15s</code></div>
          <div>• ISO 8601格式：<code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">P1D</code>, <code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">PT1H</code>, <code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">PT30M</code>, <code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">P1DT2H30M</code></div>
          <div className="mt-2 pt-2 border-t border-gray-700">
            <div className="text-gray-300">单位：d=天, h=小时, m=分钟, s=秒</div>
          </div>
        </div>
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
          <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
        </div>
      </div>
    </div>
  );
}

// ByteSize格式说明的tooltip组件
function ByteSizeTooltip() {
  return (
    <div className="group relative inline-block">
      <svg
        className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help inline-block ml-1"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-80 p-3 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
        <div className="space-y-1">
          <div className="font-semibold mb-2">支持的ByteSize格式：</div>
          <div>• 纯数字（字节数）：<code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">1024</code>, <code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">1048576</code></div>
          <div>• 带单位格式：<code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">1KB</code>, <code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">1MB</code>, <code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">512KB</code></div>
          <div>• 支持单位：<code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">B</code>, <code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">KB</code>, <code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">MB</code>, <code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">GB</code>, <code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">TB</code>, <code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">PB</code>, <code className="bg-gray-800 dark:bg-gray-600 px-1 rounded">EB</code></div>
          <div className="mt-2 pt-2 border-t border-gray-700">
            <div className="text-gray-300">单位换算：1KB=1024B, 1MB=1024KB, 1GB=1024MB, 以此类推</div>
          </div>
        </div>
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
          <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
        </div>
      </div>
    </div>
  );
}

// 将ISO 8601格式的TimeDelta转换为可读格式
// 例如: "PT1M" -> "1m", "PT1H" -> "1h", "P1D" -> "1d", "P14D" -> "14d", "PT1H30M" -> "1h30m"
function parseTimeDelta(isoString: string): string {
  // 如果已经是简单格式（如"1m", "1h", "1d"），直接返回
  if (!isoString.startsWith("P")) {
    return isoString;
  }

  // ISO 8601 持续时间格式: P[n]D T[n]H[n]M[n]S
  // 完整匹配: P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?
  const fullMatch = isoString.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);

  if (!fullMatch) {
    return isoString; // 如果无法解析，返回原值
  }

  const days = fullMatch[1] ? parseInt(fullMatch[1]) : 0;
  const hours = fullMatch[2] ? parseInt(fullMatch[2]) : 0;
  const minutes = fullMatch[3] ? parseInt(fullMatch[3]) : 0;
  const seconds = fullMatch[4] ? parseInt(fullMatch[4]) : 0;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);

  return parts.length > 0 ? parts.join("") : "0s";
}

// 将字节数转换为可读格式
// 例如: 1048576 -> "1MB", 512000 -> "500KB"
function parseByteSize(bytes: number | string): string {
  if (typeof bytes === "string") {
    // 如果已经是字符串格式（如"1MB", "512KB"），直接返回
    if (/^\d+(\.\d+)?[KMGT]?B$/i.test(bytes.trim())) {
      return bytes.trim();
    }
    // 尝试解析为数字
    const num = parseInt(bytes);
    if (isNaN(num)) return bytes;
    bytes = num;
  }

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  // 如果是整数，不显示小数
  if (size === Math.floor(size)) {
    return `${Math.floor(size)}${units[unitIndex]}`;
  }
  // 保留最多2位小数，但去掉末尾的0
  return `${parseFloat(size.toFixed(2))}${units[unitIndex]}`;
}

// 转换配置对象，将TimeDelta和ByteSize转换为可读格式
function normalizeConfig(config: Config): Config {
  const normalized = JSON.parse(JSON.stringify(config)); // 深拷贝

  // 转换TimeDelta字段
  normalized.updater.update_interval = parseTimeDelta(normalized.updater.update_interval);
  normalized.updater.tracking_timeout = parseTimeDelta(normalized.updater.tracking_timeout);
  normalized.download.connect_timeout = parseTimeDelta(normalized.download.connect_timeout);
  normalized.download.download_timeout = parseTimeDelta(normalized.download.download_timeout);
  normalized.download.retry_interval = parseTimeDelta(normalized.download.retry_interval);
  normalized.db.save_interval = parseTimeDelta(normalized.db.save_interval);

  // 转换ByteSize字段
  normalized.download.chunk_size = parseByteSize(normalized.download.chunk_size);

  return normalized;
}

export default function Config() {
  const [config, setConfigState] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const data: GetConfigResponse = await getConfig({});
      // 转换TimeDelta和ByteSize为可读格式
      const normalizedConfig = normalizeConfig(data.config);
      setConfigState(normalizedConfig);
    } catch (err) {
      console.error("Fetch config error:", err);
      setError(err instanceof Error ? err.message : "获取配置失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const request: SetConfigRequest = { config };
      await setConfig(request);

      setSuccess("配置保存成功！");
      // 3秒后清除成功消息
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Save config error:", err);
      setError(err instanceof Error ? err.message : "保存配置失败");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm("确定要重置为原始配置吗？未保存的更改将丢失。")) {
      fetchConfig();
    }
  };

  const updateConfig = (path: string[], value: string | number) => {
    if (!config) return;

    const newConfig = JSON.parse(JSON.stringify(config)); // 深拷贝
    let current: any = newConfig;

    // 导航到目标对象
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }

    // 设置值
    const lastKey = path[path.length - 1];
    if (typeof value === "number") {
      current[lastKey] = value;
    } else {
      current[lastKey] = value;
    }

    setConfigState(newConfig);
  };

  useEffect(() => {
    fetchConfig();
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
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
        <button
          onClick={fetchConfig}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>未找到配置信息</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            系统配置
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            查看和修改系统配置信息
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={saving || loading}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            重置
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading || !config}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "保存中..." : "保存配置"}
          </button>
        </div>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* 成功信息 */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400">
          {success}
        </div>
      )}

      {config && (
        <form onSubmit={handleSave} className="space-y-6">
          {/* 更新器配置 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              更新器配置 (Updater)
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                  更新间隔 (TimeDelta格式)
                  <TimeDeltaTooltip />
                </label>
                <input
                  type="text"
                  value={config.updater.update_interval}
                  onChange={(e) => updateConfig(["updater", "update_interval"], e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1d"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                  追踪超时 (TimeDelta格式)
                  <TimeDeltaTooltip />
                </label>
                <input
                  type="text"
                  value={config.updater.tracking_timeout}
                  onChange={(e) => updateConfig(["updater", "tracking_timeout"], e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="14d"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  并行更新数
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.updater.update_parallel}
                  onChange={(e) => updateConfig(["updater", "update_parallel"], parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 下载配置 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              下载配置 (Download)
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                  连接超时 (TimeDelta格式)
                  <TimeDeltaTooltip />
                </label>
                <input
                  type="text"
                  value={config.download.connect_timeout}
                  onChange={(e) => updateConfig(["download", "connect_timeout"], e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1m"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                  块大小 (ByteSize格式)
                  <ByteSizeTooltip />
                </label>
                <input
                  type="text"
                  value={config.download.chunk_size}
                  onChange={(e) => updateConfig(["download", "chunk_size"], e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1MB"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  最大并发片段数
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.download.max_concurrent_fragments}
                  onChange={(e) => updateConfig(["download", "max_concurrent_fragments"], parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  最大并发下载数
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.download.max_concurrent_downloads}
                  onChange={(e) => updateConfig(["download", "max_concurrent_downloads"], parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  最大重试次数
                </label>
                <input
                  type="number"
                  min="0"
                  value={config.download.max_retries}
                  onChange={(e) => updateConfig(["download", "max_retries"], parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                  下载超时 (TimeDelta格式)
                  <TimeDeltaTooltip />
                </label>
                <input
                  type="text"
                  value={config.download.download_timeout}
                  onChange={(e) => updateConfig(["download", "download_timeout"], e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1h"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                  重试间隔 (TimeDelta格式)
                  <TimeDeltaTooltip />
                </label>
                <input
                  type="text"
                  value={config.download.retry_interval}
                  onChange={(e) => updateConfig(["download", "retry_interval"], e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1m"
                />
              </div>
            </div>
          </div>

          {/* 数据库配置 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              数据库配置 (DB)
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                  保存间隔 (TimeDelta格式)
                  <TimeDeltaTooltip />
                </label>
                <input
                  type="text"
                  value={config.db.save_interval}
                  onChange={(e) => updateConfig(["db", "save_interval"], e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1m"
                />
              </div>
            </div>
          </div>

          {/* 原始JSON显示 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              原始配置 (JSON)
            </h2>
            <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm text-gray-800 dark:text-gray-200">
              {JSON.stringify(config, null, 2)}
            </pre>
          </div>

          {/* 底部保存按钮 */}
          <div className="flex justify-end gap-2 pb-8">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving || loading}
              className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              重置
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "保存中..." : "保存配置"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
