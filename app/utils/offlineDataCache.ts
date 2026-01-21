import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TVInfo, GetTVDetailsResponse, Tag, Series } from '../api/types';

// 存储键
const OFFLINE_DATA_KEY = '@tvsurf_offline_data';
const PENDING_CHANGES_KEY = '@tvsurf_pending_changes';
const TEMP_ID_MAPPING_KEY = '@tvsurf_temp_id_mapping';
const NEXT_TEMP_ID_KEY = '@tvsurf_next_temp_id';

// 离线数据结构
interface OfflineData {
    tvInfos: Record<number, TVInfo>; // tvId -> TVInfo
    tvDetails: Record<number, GetTVDetailsResponse>; // tvId -> TVDetails
    series: Record<number, Series>; // seriesId -> Series
    lastSync: string; // ISO datetime string
}

// 操作类型
enum OperationType {
    WATCH_PROGRESS = 'watch_progress',
    TAG_CHANGE = 'tag_change',
    UPDATE_SERIES_TVS = 'update_series_tvs',
    ADD_SERIES = 'add_series',
    REMOVE_SERIES = 'remove_series',
}

// 观看进度数据
interface WatchProgressData {
    tvId: number;
    episodeId: number;
    time: number;
}

// 标签变更数据
interface TagChangeData {
    tvId: number;
    tag: Tag;
}

// 更新播放列表TV数据
interface UpdateSeriesTVsData {
    seriesId: number;  // 可能是临时ID
    tvs: number[];
}

// 创建播放列表数据
interface AddSeriesData {
    tempId: number;  // 临时ID（负数）
    name: string;
}

// 删除播放列表数据
interface RemoveSeriesData {
    seriesId: number;  // 可能是临时ID
}

// 统一操作结构
interface Operation {
    type: OperationType;
    data: WatchProgressData | TagChangeData | UpdateSeriesTVsData | AddSeriesData | RemoveSeriesData;
}

// 操作队列存储格式
interface OperationQueueStorage {
    operations: Operation[];
}

// 离线数据缓存类
class OfflineDataCache {
    private initialized = false;
    private offlineData: OfflineData = {
        tvInfos: {},
        tvDetails: {},
        series: {},
        lastSync: '',
    };
    // 使用数组存储待上传操作，按顺序执行
    private operations: Operation[] = [];
    // 临时ID映射表：临时ID -> 真实ID（null表示尚未映射）
    private tempIdMapping: Record<number, number | null> = {};
    // 下一个要分配的临时ID（负数递减）
    private nextTempSeriesId = -1;

    // 初始化缓存系统
    async initialize(): Promise<void> {
        if (this.initialized) return;

        await this.loadOfflineData();
        await this.loadPendingChanges();
        await this.loadTempIdMapping();
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
                series: {},
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

    // 批量保存 Series
    async saveSeries(seriesList: Series[]): Promise<void> {
        await this.initialize();
        seriesList.forEach((series) => {
            this.offlineData.series[series.id] = series;
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

    // 获取缓存的 Series（支持按 ID 筛选）
    async getSeries(ids: number[] | null): Promise<Series[]> {
        await this.initialize();
        const allSeries = Object.values(this.offlineData.series);

        if (ids === null) {
            return allSeries;
        }

        return allSeries.filter((series) => ids.includes(series.id));
    }

    // 清除所有离线数据（包括临时ID映射表）
    async clearOfflineData(): Promise<void> {
        await this.initialize();
        this.offlineData = {
            tvInfos: {},
            tvDetails: {},
            series: {},
            lastSync: '',
        };
        await this.saveOfflineData();

        // 同时清空临时ID映射表
        await this.clearTempIdMapping();
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
                const storage: OperationQueueStorage = JSON.parse(changesStr);
                this.operations = storage.operations || [];
            }
        } catch (error) {
            console.error('加载待上传变更失败:', error);
            // 数据损坏时重置
            this.operations = [];
        }
    }

    // 保存待上传变更
    private async savePendingChanges(): Promise<void> {
        try {
            const storage: OperationQueueStorage = {
                operations: this.operations,
            };
            await AsyncStorage.setItem(PENDING_CHANGES_KEY, JSON.stringify(storage));
        } catch (error) {
            console.error('保存待上传变更失败:', error);
            throw error;
        }
    }

    // 记录观看进度变更（删除同TV的旧操作，追加新操作）
    async recordWatchProgress(tvId: number, episodeId: number, time: number): Promise<void> {
        await this.initialize();

        // 用 filter 删除该TV所有旧的观看进度操作
        this.operations = this.operations.filter(op =>
            !(op.type === OperationType.WATCH_PROGRESS && (op.data as WatchProgressData).tvId === tvId)
        );

        // append新操作到末尾
        this.operations.push({
            type: OperationType.WATCH_PROGRESS,
            data: { tvId, episodeId, time },
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

    // 记录 tag 变更（删除同TV的旧操作，追加新操作）
    async recordTagChange(tvId: number, tag: Tag): Promise<void> {
        await this.initialize();

        // 用 filter 删除该TV所有旧的标签操作
        this.operations = this.operations.filter(op =>
            !(op.type === OperationType.TAG_CHANGE && (op.data as TagChangeData).tvId === tvId)
        );

        // append新操作到末尾
        this.operations.push({
            type: OperationType.TAG_CHANGE,
            data: { tvId, tag },
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

    // 获取所有操作（按顺序）
    async getAllOperationsInOrder(): Promise<Operation[]> {
        await this.initialize();
        // 返回数组副本，避免外部直接修改内部状态
        return [...this.operations];
    }

    // 获取所有待上传的观看进度（保留用于兼容性）
    async getPendingWatchProgress(): Promise<WatchProgressData[]> {
        await this.initialize();
        return this.operations
            .filter(op => op.type === OperationType.WATCH_PROGRESS)
            .map(op => op.data as WatchProgressData);
    }

    // 获取所有待上传的 tag 变更（保留用于兼容性）
    async getPendingTagChanges(): Promise<TagChangeData[]> {
        await this.initialize();
        return this.operations
            .filter(op => op.type === OperationType.TAG_CHANGE)
            .map(op => op.data as TagChangeData);
    }

    // 获取待同步数据总数
    async getPendingChangesCount(): Promise<{ watchProgress: number; tags: number; total: number }> {
        await this.initialize();
        const watchProgressCount = this.operations.filter(op => op.type === OperationType.WATCH_PROGRESS).length;
        const tagsCount = this.operations.filter(op => op.type === OperationType.TAG_CHANGE).length;
        return {
            watchProgress: watchProgressCount,
            tags: tagsCount,
            total: this.operations.length,
        };
    }

    // 删除已上传的观看进度记录
    async removePendingWatchProgress(tvId: number, episodeId: number): Promise<void> {
        await this.initialize();
        this.operations = this.operations.filter(op => {
            if (op.type !== OperationType.WATCH_PROGRESS) return true;
            const data = op.data as WatchProgressData;
            return !(data.tvId === tvId && data.episodeId === episodeId);
        });
        await this.savePendingChanges();
    }

    // 删除已上传的 tag 变更记录
    async removePendingTagChange(tvId: number): Promise<void> {
        await this.initialize();
        this.operations = this.operations.filter(op => {
            if (op.type !== OperationType.TAG_CHANGE) return true;
            const data = op.data as TagChangeData;
            return data.tvId !== tvId;
        });
        await this.savePendingChanges();
    }

    // 按索引删除操作
    async removeOperationAt(index: number): Promise<void> {
        await this.initialize();
        if (index >= 0 && index < this.operations.length) {
            this.operations.splice(index, 1);
            await this.savePendingChanges();
        }
    }

    // 清除所有待上传变更
    async clearPendingChanges(): Promise<void> {
        await this.initialize();
        this.operations = [];
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

    // ==================== 临时ID映射表管理 ====================

    // 加载临时ID映射表
    private async loadTempIdMapping(): Promise<void> {
        try {
            const mappingStr = await AsyncStorage.getItem(TEMP_ID_MAPPING_KEY);
            if (mappingStr) {
                this.tempIdMapping = JSON.parse(mappingStr);
            }

            const nextIdStr = await AsyncStorage.getItem(NEXT_TEMP_ID_KEY);
            if (nextIdStr) {
                this.nextTempSeriesId = parseInt(nextIdStr, 10);
            }
        } catch (error) {
            console.error('加载临时ID映射失败:', error);
            // 数据损坏时重置
            this.tempIdMapping = {};
            this.nextTempSeriesId = -1;
        }
    }

    // 保存临时ID映射表
    private async saveTempIdMapping(): Promise<void> {
        try {
            await AsyncStorage.setItem(TEMP_ID_MAPPING_KEY, JSON.stringify(this.tempIdMapping));
            await AsyncStorage.setItem(NEXT_TEMP_ID_KEY, this.nextTempSeriesId.toString());
        } catch (error) {
            console.error('保存临时ID映射失败:', error);
            throw error;
        }
    }

    // 生成新的临时ID
    async generateTempSeriesId(): Promise<number> {
        await this.initialize();
        const tempId = this.nextTempSeriesId--;
        this.tempIdMapping[tempId] = null;  // 初始映射为 null
        await this.saveTempIdMapping();
        return tempId;
    }

    // 判断是否是临时ID
    isTempId(id: number): boolean {
        return id < 0;
    }

    // 设置真实ID（仅更新映射表）
    async setRealId(tempId: number, realId: number): Promise<void> {
        await this.initialize();
        if (!this.isTempId(tempId)) {
            throw new Error(`${tempId} 不是临时ID`);
        }
        if (!(tempId in this.tempIdMapping)) {
            throw new Error(`临时ID ${tempId} 不在映射表中`);
        }

        // 只更新映射表
        this.tempIdMapping[tempId] = realId;
        await this.saveTempIdMapping();

        // 注意：不更新本地缓存和操作队列
        // 操作队列中保持临时ID，上传时通过 resolveId 解析
        // 本地缓存中保持临时ID，退出离线模式后会清空所有离线数据
    }

    // 获取真实ID（如果已映射）
    getRealId(tempId: number): number | null {
        return this.tempIdMapping[tempId] || null;
    }

    // 解析ID：如果是临时ID且已映射，返回真实ID；否则返回原ID
    resolveId(id: number): number {
        if (this.isTempId(id)) {
            const realId = this.getRealId(id);
            return realId !== null ? realId : id;
        }
        return id;
    }

    // 清空临时ID映射表
    async clearTempIdMapping(): Promise<void> {
        this.tempIdMapping = {};
        this.nextTempSeriesId = -1;
        await this.saveTempIdMapping();
    }

    // ==================== Series 编辑操作记录 ====================

    // 记录更新播放列表TV操作
    async recordUpdateSeriesTVs(seriesId: number, tvs: number[]): Promise<void> {
        await this.initialize();

        // 删除该Series之前的所有更新操作（去重）
        this.operations = this.operations.filter(op =>
            !(op.type === OperationType.UPDATE_SERIES_TVS &&
                (op.data as UpdateSeriesTVsData).seriesId === seriesId)
        );

        // 追加新操作
        this.operations.push({
            type: OperationType.UPDATE_SERIES_TVS,
            data: { seriesId, tvs },
        });

        // 更新本地缓存
        if (this.offlineData.series[seriesId]) {
            this.offlineData.series[seriesId].tvs = tvs;
            this.offlineData.series[seriesId].last_update = new Date().toISOString();
        }

        await this.saveOfflineData();
        await this.savePendingChanges();
    }

    // 记录创建播放列表操作
    async recordAddSeries(tempId: number, name: string): Promise<void> {
        await this.initialize();

        if (!this.isTempId(tempId)) {
            throw new Error(`${tempId} 不是临时ID`);
        }

        // 追加操作
        this.operations.push({
            type: OperationType.ADD_SERIES,
            data: { tempId, name },
        });

        // 添加到本地缓存
        const newSeries: Series = {
            id: tempId,
            name,
            tvs: [],
            last_update: new Date().toISOString(),
        };
        this.offlineData.series[tempId] = newSeries;

        await this.saveOfflineData();
        await this.savePendingChanges();
    }

    // 记录删除播放列表操作
    async recordRemoveSeries(seriesId: number): Promise<void> {
        await this.initialize();

        // 删除该Series之前的所有操作（包括创建、更新）
        this.operations = this.operations.filter(op => {
            if (op.type === OperationType.ADD_SERIES) {
                return (op.data as AddSeriesData).tempId !== seriesId;
            }
            if (op.type === OperationType.UPDATE_SERIES_TVS) {
                return (op.data as UpdateSeriesTVsData).seriesId !== seriesId;
            }
            if (op.type === OperationType.REMOVE_SERIES) {
                return (op.data as RemoveSeriesData).seriesId !== seriesId;
            }
            return true;
        });

        // 如果是临时ID且从未上传过（即只存在ADD操作），则不需要记录删除操作
        const wasNeverUploaded = this.isTempId(seriesId) && this.tempIdMapping[seriesId] === null;

        if (!wasNeverUploaded) {
            // 追加删除操作
            this.operations.push({
                type: OperationType.REMOVE_SERIES,
                data: { seriesId },
            });
        }

        // 从本地缓存中删除
        delete this.offlineData.series[seriesId];

        // 如果是临时ID，从映射表中删除
        if (this.isTempId(seriesId)) {
            delete this.tempIdMapping[seriesId];
            await this.saveTempIdMapping();
        }

        await this.saveOfflineData();
        await this.savePendingChanges();
    }
}

// 导出单例
export const offlineDataCache = new OfflineDataCache();
