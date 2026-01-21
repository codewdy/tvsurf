import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineDataCache } from './offlineDataCache';
import { videoCache } from './videoCache';
import {
    getTVInfos as getTVInfosApi,
    getTVDetails as getTVDetailsApi,
    getSeries as getSeriesApi
} from '../api/client';
import { setWatchProgress as setWatchProgressApi, setTVTag as setTVTagApi } from '../api/client';
import type { Tag } from '../api/types';

// 注意：这里导入的是 client 而不是 client-proxy，因为 offlineModeManager 
// 在进入/退出离线模式时需要直接调用底层 API，不需要经过 proxy 的离线检查

// 离线模式状态存储键
const OFFLINE_MODE_KEY = '@tvsurf_offline_mode';

// 上传结果
export interface SyncResult {
    success: boolean;
    errors: SyncError[];
}

export interface SyncError {
    type: 'watch_progress' | 'tag';
    tvId: number;
    episodeId?: number;
    error: string;
}

// 下载进度回调
export type DownloadProgressCallback = (current: number, total: number, message: string) => void;

// 上传进度回调
export type UploadProgressCallback = (current: number, total: number, message: string) => void;

// 离线模式管理器
class OfflineModeManager {
    private offlineMode = false;
    private initialized = false;

    // 初始化
    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            const modeStr = await AsyncStorage.getItem(OFFLINE_MODE_KEY);
            this.offlineMode = modeStr === 'true';
            this.initialized = true;
        } catch (error) {
            console.error('初始化离线模式状态失败:', error);
            this.offlineMode = false;
            this.initialized = true;
        }
    }

    // 检查是否处于离线模式
    isOffline(): boolean {
        return this.offlineMode;
    }

    // 获取离线模式状态（异步版本，确保已初始化）
    async getOfflineMode(): Promise<boolean> {
        await this.initialize();
        return this.offlineMode;
    }

    // 设置离线模式状态
    private async setOfflineMode(mode: boolean): Promise<void> {
        this.offlineMode = mode;
        try {
            await AsyncStorage.setItem(OFFLINE_MODE_KEY, mode ? 'true' : 'false');
        } catch (error) {
            console.error('保存离线模式状态失败:', error);
            throw error;
        }
    }

    // 进入离线模式
    async enterOfflineMode(onProgress?: DownloadProgressCallback): Promise<void> {
        await this.initialize();

        if (this.offlineMode) {
            throw new Error('已经处于离线模式');
        }

        try {
            onProgress?.(0, 4, '准备下载数据...');

            await offlineDataCache.clearOfflineData();

            // 1. 获取所有 TV 的 TVInfo
            onProgress?.(1, 4, '下载所有TV信息...');
            const tvInfosResponse = await getTVInfosApi({ ids: null });
            const tvInfos = tvInfosResponse.tvs;
            await offlineDataCache.saveTVInfos(tvInfos);

            // 2. 获取所有 Series
            onProgress?.(2, 4, '下载所有播放列表...');
            const seriesResponse = await getSeriesApi({ ids: null });
            const seriesList = seriesResponse.series;
            await offlineDataCache.saveSeries(seriesList);

            // 3. 提取所有 TV ID
            const tvIds = tvInfos.map(tv => tv.id);

            // 4. 顺序下载这些 TV 的 TVDetails（任何一个失败都会导致整个操作失败）
            const tvDetailsResults = [];
            for (let i = 0; i < tvIds.length; i++) {
                const tvId = tvIds[i];
                onProgress?.(3, 4, `下载TV详情 (${i + 1}/${tvIds.length})...`);
                const details = await getTVDetailsApi({ id: tvId });
                tvDetailsResults.push(details);
            }

            await offlineDataCache.saveTVDetails(tvDetailsResults);

            onProgress?.(4, 4, '进入离线模式成功');

            // 5. 设置离线模式状态
            await this.setOfflineMode(true);
        } catch (error) {
            console.error('进入离线模式失败:', error);
            throw error;
        }
    }

    // 退出离线模式
    // force: 如果为 true，即使同步失败也会强制退出，并删除所有未同步的数据
    async exitOfflineMode(onProgress?: UploadProgressCallback, force: boolean = false): Promise<SyncResult> {
        await this.initialize();

        if (!this.offlineMode) {
            throw new Error('当前不在离线模式');
        }

        const errors: SyncError[] = [];

        try {
            // 1. 获取统一的操作队列
            const operations = await offlineDataCache.getAllOperationsInOrder();
            const totalChanges = operations.length;

            if (totalChanges === 0) {
                // 没有待上传数据，直接退出离线模式
                onProgress?.(0, 0, '没有待同步数据');
                await this.setOfflineMode(false);
                return { success: true, errors: [] };
            }

            // 2. 按序列顺序上传每个操作（使用 while 循环，始终处理索引 0）
            let current = 0;
            while (operations.length > 0) {
                const operation = operations[0]; // 始终处理第一个操作

                try {
                    if (operation.type === 'watch_progress') {
                        // 上传观看进度
                        const data = operation.data as { tvId: number; episodeId: number; time: number };
                        await setWatchProgressApi({
                            tv_id: data.tvId,
                            episode_id: data.episodeId,
                            time: data.time,
                        });
                        current++;
                        onProgress?.(current, totalChanges, `上传观看进度 [TV ${data.tvId} 第${data.episodeId}集]`);
                    } else if (operation.type === 'tag_change') {
                        // 上传标签变更
                        const data = operation.data as { tvId: number; tag: Tag };
                        await setTVTagApi({
                            tv_id: data.tvId,
                            tag: data.tag,
                        });
                        current++;
                        onProgress?.(current, totalChanges, `上传标签变更 [TV ${data.tvId}]`);
                    }

                    // 上传成功，删除该操作（删除第一个元素，数组自动前移）
                    await offlineDataCache.removeOperationAt(0);
                    operations.shift(); // 同步本地副本（因为 getAllOperationsInOrder 返回的是副本）
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : '未知错误';

                    // 记录错误
                    if (operation.type === 'watch_progress') {
                        const data = operation.data as { tvId: number; episodeId: number; time: number };
                        errors.push({
                            type: 'watch_progress',
                            tvId: data.tvId,
                            episodeId: data.episodeId,
                            error: errorMsg,
                        });
                        console.error(`上传观看进度失败 [TV ${data.tvId} 第${data.episodeId}集]:`, error);
                    } else if (operation.type === 'tag_change') {
                        const data = operation.data as { tvId: number; tag: Tag };
                        errors.push({
                            type: 'tag',
                            tvId: data.tvId,
                            error: errorMsg,
                        });
                        console.error(`上传标签失败 [TV ${data.tvId}]:`, error);
                    }

                    // 遇到错误立即停止
                    break;
                }
            }

            // 如果有上传失败
            if (errors.length > 0) {
                if (force) {
                    // 强制退出：删除所有未同步的数据
                    onProgress?.(0, 0, '强制退出：清除未同步数据...');
                    await offlineDataCache.clearPendingChanges();
                    await this.setOfflineMode(false);
                    return { success: false, errors };
                } else {
                    // 正常模式：保留数据，保持离线状态
                    return { success: false, errors };
                }
            }

            // 3. 全部上传成功，退出离线模式
            onProgress?.(totalChanges, totalChanges, '同步完成');
            await this.setOfflineMode(false);

            return { success: true, errors: [] };
        } catch (error) {
            console.error('退出离线模式失败:', error);
            if (force) {
                // 即使出现异常，强制模式下也要尝试清除数据并退出
                try {
                    onProgress?.(0, 0, '强制退出：清除未同步数据...');
                    await offlineDataCache.clearPendingChanges();
                    await this.setOfflineMode(false);
                } catch (cleanupError) {
                    console.error('强制退出时清理数据失败:', cleanupError);
                }
                return { success: false, errors };
            }
            throw error;
        }
    }

    // 记录观看进度（供离线模式下使用）
    async recordWatchProgress(tvId: number, episodeId: number, time: number): Promise<void> {
        await offlineDataCache.recordWatchProgress(tvId, episodeId, time);
    }

    // 记录 tag 变更（供离线模式下使用）
    async recordTagChange(tvId: number, tag: Tag): Promise<void> {
        await offlineDataCache.recordTagChange(tvId, tag);
    }

    // 获取待同步数据统计
    async getPendingChangesCount(): Promise<{ watchProgress: number; tags: number; total: number }> {
        return await offlineDataCache.getPendingChangesCount();
    }

    // 获取离线缓存的 TV 数量
    async getCachedTVCount(): Promise<number> {
        return await offlineDataCache.getCachedTVCount();
    }

    // 检查是否有离线数据
    async hasOfflineData(): Promise<boolean> {
        return await offlineDataCache.hasOfflineData();
    }

    // 清除所有离线数据（谨慎使用）
    async clearAllOfflineData(): Promise<void> {
        await offlineDataCache.clearOfflineData();
        await offlineDataCache.clearPendingChanges();
        await this.setOfflineMode(false);
    }
}

// 导出单例
export const offlineModeManager = new OfflineModeManager();
