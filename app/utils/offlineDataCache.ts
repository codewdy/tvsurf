import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TVInfo, GetTVDetailsResponse, Tag } from '../api/types';

// 存储键
const OFFLINE_DATA_KEY = '@tvsurf_offline_data';
const PENDING_CHANGES_KEY = '@tvsurf_pending_changes';

// 离线数据结构
interface OfflineData {
    tvInfos: Record<number, TVInfo>; // tvId -> TVInfo
    tvDetails: Record<number, GetTVDetailsResponse>; // tvId -> TVDetails
    lastSync: string; // ISO datetime string
}

// 待上传的观看进度记录
interface PendingWatchProgress {
    tvId: number;
    episodeId: number;
    time: number;
    timestamp: number; // 记录时间戳，用于排序
}

// 待上传的 tag 变更记录
interface PendingTagChange {
    tvId: number;
    tag: Tag;
    timestamp: number; // 记录时间戳，用于排序
}

// 待上传的变更（持久化格式）
interface PendingChangesStorage {
    watchProgress: Record<string, PendingWatchProgress>; // key: "tvId_episodeId"
    tags: Record<number, PendingTagChange>; // key: tvId
}

// 离线数据缓存类
class OfflineDataCache {
    private initialized = false;
    private offlineData: OfflineData = {
        tvInfos: {},
        tvDetails: {},
        lastSync: '',
    };
    // 使用 Map 存储待上传数据，自动合并重复记录
    private pendingWatchProgress: Map<string, PendingWatchProgress> = new Map();
    private pendingTags: Map<number, PendingTagChange> = new Map();

    // 初始化缓存系统
    async initialize(): Promise<void> {
        if (this.initialized) return;

        await this.loadOfflineData();
        await this.loadPendingChanges();
        this.initialized = true;
    }

    // ==================== 离线数据管理 ====================

    // 加载离线数据
    private async loadOfflineData(): Promise<void> {
        try {
            const dataStr = await AsyncStorage.getItem(OFFLINE_DATA_KEY);
            if (dataStr) {
                this.offlineData = JSON.parse(dataStr);
            }
        } catch (error) {
            console.error('加载离线数据失败:', error);
            // 数据损坏时重置
            this.offlineData = {
                tvInfos: {},
                tvDetails: {},
                lastSync: '',
            };
        }
    }

    // 保存离线数据
    private async saveOfflineData(): Promise<void> {
        try {
            await AsyncStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(this.offlineData));
        } catch (error) {
            console.error('保存离线数据失败:', error);
            throw error;
        }
    }

    // 批量保存 TVInfo
    async saveTVInfos(tvInfos: TVInfo[]): Promise<void> {
        await this.initialize();
        tvInfos.forEach((tvInfo) => {
            this.offlineData.tvInfos[tvInfo.id] = tvInfo;
        });
        this.offlineData.lastSync = new Date().toISOString();
        await this.saveOfflineData();
    }

    // 批量保存 TVDetails
    async saveTVDetails(tvDetails: GetTVDetailsResponse[]): Promise<void> {
        await this.initialize();
        tvDetails.forEach((detail) => {
            this.offlineData.tvDetails[detail.tv.id] = detail;
        });
        this.offlineData.lastSync = new Date().toISOString();
        await this.saveOfflineData();
    }

    // 获取缓存的 TVInfos（支持按 ID 筛选）
    async getTVInfos(ids: number[] | null): Promise<TVInfo[]> {
        await this.initialize();
        const allTvInfos = Object.values(this.offlineData.tvInfos);

        if (ids === null) {
            return allTvInfos;
        }

        return allTvInfos.filter((tv) => ids.includes(tv.id));
    }

    // 获取缓存的 TVDetails
    async getTVDetails(tvId: number): Promise<GetTVDetailsResponse | null> {
        await this.initialize();
        return this.offlineData.tvDetails[tvId] || null;
    }

    // 清除所有离线数据
    async clearOfflineData(): Promise<void> {
        await this.initialize();
        this.offlineData = {
            tvInfos: {},
            tvDetails: {},
            lastSync: '',
        };
        await this.saveOfflineData();
    }

    // 获取上次同步时间
    async getLastSyncTime(): Promise<string | null> {
        await this.initialize();
        return this.offlineData.lastSync || null;
    }

    // ==================== 待上传变更管理 ====================

    // 加载待上传变更
    private async loadPendingChanges(): Promise<void> {
        try {
            const changesStr = await AsyncStorage.getItem(PENDING_CHANGES_KEY);
            if (changesStr) {
                const changes: PendingChangesStorage = JSON.parse(changesStr);

                // 从 Record 转换为 Map
                this.pendingWatchProgress.clear();
                Object.entries(changes.watchProgress || {}).forEach(([key, value]) => {
                    this.pendingWatchProgress.set(key, value);
                });

                this.pendingTags.clear();
                Object.entries(changes.tags || {}).forEach(([key, value]) => {
                    this.pendingTags.set(Number(key), value);
                });
            }
        } catch (error) {
            console.error('加载待上传变更失败:', error);
            // 数据损坏时重置
            this.pendingWatchProgress.clear();
            this.pendingTags.clear();
        }
    }

    // 保存待上传变更
    private async savePendingChanges(): Promise<void> {
        try {
            // 从 Map 转换为 Record 以便 JSON 序列化
            const changes: PendingChangesStorage = {
                watchProgress: Object.fromEntries(this.pendingWatchProgress),
                tags: Object.fromEntries(this.pendingTags),
            };
            await AsyncStorage.setItem(PENDING_CHANGES_KEY, JSON.stringify(changes));
        } catch (error) {
            console.error('保存待上传变更失败:', error);
            throw error;
        }
    }

    // 记录观看进度变更（自动合并重复记录）
    async recordWatchProgress(tvId: number, episodeId: number, time: number): Promise<void> {
        await this.initialize();
        const key = `${tvId}_${episodeId}`;
        this.pendingWatchProgress.set(key, {
            tvId,
            episodeId,
            time,
            timestamp: Date.now(),
        });

        const newWatchProgress = {
            episode_id: episodeId,
            time: time,
        };
        const newLastUpdate = new Date().toISOString();

        // 同时更新离线数据中的观看进度
        if (this.offlineData.tvInfos[tvId]) {
            this.offlineData.tvInfos[tvId].user_data.watch_progress = newWatchProgress;
            this.offlineData.tvInfos[tvId].user_data.last_update = newLastUpdate;
        }

        // 同时更新 TVDetails 中的 info
        if (this.offlineData.tvDetails[tvId]) {
            this.offlineData.tvDetails[tvId].info.user_data.watch_progress = newWatchProgress;
            this.offlineData.tvDetails[tvId].info.user_data.last_update = newLastUpdate;
        }

        await this.saveOfflineData();
        await this.savePendingChanges();
    }

    // 记录 tag 变更（自动合并重复记录）
    async recordTagChange(tvId: number, tag: Tag): Promise<void> {
        await this.initialize();
        this.pendingTags.set(tvId, {
            tvId,
            tag,
            timestamp: Date.now(),
        });

        const newLastUpdate = new Date().toISOString();

        // 同时更新离线数据中的 tag
        if (this.offlineData.tvInfos[tvId]) {
            this.offlineData.tvInfos[tvId].user_data.tag = tag;
            this.offlineData.tvInfos[tvId].user_data.last_update = newLastUpdate;
        }

        // 同时更新 TVDetails 中的 info
        if (this.offlineData.tvDetails[tvId]) {
            this.offlineData.tvDetails[tvId].info.user_data.tag = tag;
            this.offlineData.tvDetails[tvId].info.user_data.last_update = newLastUpdate;
        }

        await this.saveOfflineData();
        await this.savePendingChanges();
    }

    // 获取所有待上传的观看进度
    async getPendingWatchProgress(): Promise<PendingWatchProgress[]> {
        await this.initialize();
        return Array.from(this.pendingWatchProgress.values());
    }

    // 获取所有待上传的 tag 变更
    async getPendingTagChanges(): Promise<PendingTagChange[]> {
        await this.initialize();
        return Array.from(this.pendingTags.values());
    }

    // 获取待同步数据总数
    async getPendingChangesCount(): Promise<{ watchProgress: number; tags: number; total: number }> {
        await this.initialize();
        const watchProgressCount = this.pendingWatchProgress.size;
        const tagsCount = this.pendingTags.size;
        return {
            watchProgress: watchProgressCount,
            tags: tagsCount,
            total: watchProgressCount + tagsCount,
        };
    }

    // 删除已上传的观看进度记录
    async removePendingWatchProgress(tvId: number, episodeId: number): Promise<void> {
        await this.initialize();
        const key = `${tvId}_${episodeId}`;
        this.pendingWatchProgress.delete(key);
        await this.savePendingChanges();
    }

    // 删除已上传的 tag 变更记录
    async removePendingTagChange(tvId: number): Promise<void> {
        await this.initialize();
        this.pendingTags.delete(tvId);
        await this.savePendingChanges();
    }

    // 清除所有待上传变更
    async clearPendingChanges(): Promise<void> {
        await this.initialize();
        this.pendingWatchProgress.clear();
        this.pendingTags.clear();
        await this.savePendingChanges();
    }

    // ==================== 统计信息 ====================

    // 获取缓存的 TV 数量
    async getCachedTVCount(): Promise<number> {
        await this.initialize();
        return Object.keys(this.offlineData.tvInfos).length;
    }

    // 检查是否有离线数据
    async hasOfflineData(): Promise<boolean> {
        await this.initialize();
        return Object.keys(this.offlineData.tvInfos).length > 0;
    }
}

// 导出单例
export const offlineDataCache = new OfflineDataCache();
