import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 缓存元数据
export interface CachedVideo {
    tvId: number;
    episodeId: number;
    localUri: string;
    downloadedAt: string; // 缓存时间
    fileSize: number;
}

// 缓存进度回调
export type DownloadProgressCallback = (progress: number, totalBytes: number, downloadedBytes: number) => void;

// 下载任务状态
export enum DownloadStatus {
    PENDING = 'pending',
    DOWNLOADING = 'downloading',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELLED = 'cancelled',
}

// 下载任务
export interface DownloadTask {
    tvId: number;
    episodeId: number;
    videoUrl: string;
    headers?: Record<string, string>;
    status: DownloadStatus;
    progress: number;
    totalBytes: number;
    downloadedBytes: number;
    error?: string;
    startedAt?: string;
    completedAt?: string;
}

// 下载事件监听器
export type DownloadEventListener = (task: DownloadTask) => void;

// 确保FileSystem.documentDirectory存在的包装器
const getDocumentDirectory = (): string => {
    const docDir = FileSystem.documentDirectory;
    if (docDir) {
        return docDir;
    }
    throw new Error('FileSystem.documentDirectory is not available');
};

const CACHE_DIR = `${getDocumentDirectory()}video_cache/`;
const CACHE_METADATA_KEY = '@video_cache_metadata';

class VideoCache {
    private metadata: Map<string, CachedVideo> = new Map();
    private initialized = false;
    private activeDownloads: Map<string, any> = new Map();
    private downloadTasks: Map<string, DownloadTask> = new Map();
    private progressListeners: Map<string, Set<DownloadEventListener>> = new Map();
    private completeListeners: Map<string, Set<DownloadEventListener>> = new Map();
    private errorListeners: Map<string, Set<DownloadEventListener>> = new Map();

    // 全局监听器
    private globalCompleteListeners: Set<DownloadEventListener> = new Set();
    private globalErrorListeners: Set<DownloadEventListener> = new Set();

    // 并发控制
    private readonly MAX_CONCURRENT_DOWNLOADS = 3;
    private downloadQueue: string[] = []; // 等待下载的任务队列（存储key）
    private runningDownloads = 0; // 当前正在运行的下载数量

    // 初始化缓存系统
    async initialize(): Promise<void> {
        if (this.initialized) return;

        // 确保缓存目录存在
        const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
        }

        // 加载元数据
        await this.loadMetadata();
        this.initialized = true;
    }

    // 加载缓存元数据
    private async loadMetadata(): Promise<void> {
        try {
            const metadataStr = await AsyncStorage.getItem(CACHE_METADATA_KEY);
            if (metadataStr) {
                const metadataArray: CachedVideo[] = JSON.parse(metadataStr);
                this.metadata.clear();
                metadataArray.forEach((item) => {
                    const key = this.getCacheKey(item.tvId, item.episodeId);
                    this.metadata.set(key, item);
                });
            }
        } catch (error) {
            console.error('加载缓存元数据失败:', error);
        }
    }

    // 保存缓存元数据
    private async saveMetadata(): Promise<void> {
        try {
            const metadataArray = Array.from(this.metadata.values());
            await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadataArray));
        } catch (error) {
            console.error('保存缓存元数据失败:', error);
        }
    }

    // 生成缓存键
    private getCacheKey(tvId: number, episodeId: number): string {
        return `${tvId}_${episodeId}`;
    }

    // 生成本地文件路径
    private getLocalFilePath(tvId: number, episodeId: number): string {
        return `${CACHE_DIR}${tvId}_${episodeId}.mp4`;
    }

    // 检查视频是否已缓存
    async isCached(tvId: number, episodeId: number): Promise<boolean> {
        await this.initialize();
        const key = this.getCacheKey(tvId, episodeId);
        const cached = this.metadata.get(key);

        if (!cached) return false;

        // 验证文件是否真实存在
        const fileInfo = await FileSystem.getInfoAsync(cached.localUri);
        if (!fileInfo.exists) {
            // 文件不存在，清除元数据
            this.metadata.delete(key);
            await this.saveMetadata();
            return false;
        }

        return true;
    }

    // 获取缓存的视频URI
    async getCachedVideoUri(tvId: number, episodeId: number): Promise<string | null> {
        await this.initialize();
        const key = this.getCacheKey(tvId, episodeId);
        const cached = this.metadata.get(key);

        if (!cached) return null;

        // 验证文件是否存在
        const fileInfo = await FileSystem.getInfoAsync(cached.localUri);
        if (!fileInfo.exists) {
            this.metadata.delete(key);
            await this.saveMetadata();
            return null;
        }

        return cached.localUri;
    }

    // 缓存视频到本地
    async downloadVideo(
        tvId: number,
        episodeId: number,
        videoUrl: string,
        headers?: Record<string, string>,
        onProgress?: DownloadProgressCallback
    ): Promise<string> {
        await this.initialize();

        const key = this.getCacheKey(tvId, episodeId);

        // 检查是否正在缓存中
        if (this.activeDownloads.has(key)) {
            throw new Error('该视频正在缓存中');
        }

        // 检查是否已缓存
        const existingCache = await this.getCachedVideoUri(tvId, episodeId);
        if (existingCache) {
            return existingCache;
        }

        const localUri = this.getLocalFilePath(tvId, episodeId);

        try {
            const downloadResumable = FileSystem.createDownloadResumable(
                videoUrl,
                localUri,
                { headers },
                (downloadProgress) => {
                    const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                    onProgress?.(
                        progress,
                        downloadProgress.totalBytesExpectedToWrite,
                        downloadProgress.totalBytesWritten
                    );
                }
            );

            this.activeDownloads.set(key, downloadResumable);

            const result = await downloadResumable.downloadAsync();

            if (!result) {
                throw new Error('缓存失败');
            }

            // 获取文件大小
            const fileInfo = await FileSystem.getInfoAsync(result.uri);
            const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

            // 保存元数据
            const cachedVideo: CachedVideo = {
                tvId,
                episodeId,
                localUri: result.uri,
                downloadedAt: new Date().toISOString(),
                fileSize,
            };

            this.metadata.set(key, cachedVideo);
            await this.saveMetadata();

            return result.uri;
        } catch (error) {
            // 缓存失败，清理临时文件
            const fileInfo = await FileSystem.getInfoAsync(localUri);
            if (fileInfo.exists) {
                await FileSystem.deleteAsync(localUri, { idempotent: true });
            }
            throw error;
        } finally {
            this.activeDownloads.delete(key);
        }
    }

    // 取消缓存
    async cancelDownload(tvId: number, episodeId: number): Promise<void> {
        const key = this.getCacheKey(tvId, episodeId);
        const downloadResumable = this.activeDownloads.get(key);

        if (downloadResumable) {
            await downloadResumable.pauseAsync();
            this.activeDownloads.delete(key);
        }
    }

    // 删除缓存的视频
    async deleteCache(tvId: number, episodeId: number): Promise<void> {
        await this.initialize();

        const key = this.getCacheKey(tvId, episodeId);

        // 取消正在进行的缓存
        await this.cancelDownload(tvId, episodeId);

        const cached = this.metadata.get(key);
        if (cached) {
            // 删除文件
            const fileInfo = await FileSystem.getInfoAsync(cached.localUri);
            if (fileInfo.exists) {
                await FileSystem.deleteAsync(cached.localUri, { idempotent: true });
            }

            // 删除元数据
            this.metadata.delete(key);
            await this.saveMetadata();
        }
    }

    // 获取所有缓存的视频
    async getAllCachedVideos(): Promise<CachedVideo[]> {
        await this.initialize();
        return Array.from(this.metadata.values());
    }

    // 获取缓存总大小（字节）
    async getTotalCacheSize(): Promise<number> {
        await this.initialize();
        let totalSize = 0;

        for (const cached of this.metadata.values()) {
            totalSize += cached.fileSize;
        }

        return totalSize;
    }

    // 删除某个TV的所有缓存
    async deleteTvCache(tvId: number): Promise<void> {
        await this.initialize();

        // 找到该TV的所有缓存视频
        const tvCachedVideos: CachedVideo[] = [];
        for (const cached of this.metadata.values()) {
            if (cached.tvId === tvId) {
                tvCachedVideos.push(cached);
            }
        }

        // 删除所有找到的缓存
        for (const cached of tvCachedVideos) {
            await this.deleteCache(cached.tvId, cached.episodeId);
        }
    }

    // 清除已观看的缓存
    async clearWatchedCache(watchedVideos: Array<{ tvId: number; episodeId: number }>): Promise<void> {
        await this.initialize();

        for (const { tvId, episodeId } of watchedVideos) {
            await this.deleteCache(tvId, episodeId);
        }
    }

    // 清除所有缓存
    async clearAllCache(): Promise<void> {
        await this.initialize();

        // 取消所有缓存任务
        for (const [key] of this.activeDownloads) {
            const parts = key.split('_');
            await this.cancelDownload(parseInt(parts[0]), parseInt(parts[1]));
        }

        // 清空下载队列和任务
        this.downloadQueue = [];
        this.downloadTasks.clear();
        this.runningDownloads = 0;

        // 删除缓存目录
        const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
        if (dirInfo.exists) {
            await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
            await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
        }

        // 清空元数据
        this.metadata.clear();
        await this.saveMetadata();
    }

    // 检查是否正在缓存
    isDownloading(tvId: number, episodeId: number): boolean {
        const key = this.getCacheKey(tvId, episodeId);
        return this.activeDownloads.has(key);
    }

    // ==================== 新的任务管理 API ====================

    // 提交下载任务（不等待完成）
    async submitDownload(
        tvId: number,
        episodeId: number,
        videoUrl: string,
        headers?: Record<string, string>
    ): Promise<void> {
        await this.initialize();

        const key = this.getCacheKey(tvId, episodeId);

        // 检查是否已缓存
        const isCached = await this.isCached(tvId, episodeId);
        if (isCached) {
            throw new Error('该视频已缓存');
        }

        // 检查是否已有下载任务
        const existingTask = this.downloadTasks.get(key);
        if (
            existingTask &&
            (existingTask.status === DownloadStatus.DOWNLOADING ||
                existingTask.status === DownloadStatus.PENDING)
        ) {
            throw new Error('该视频正在下载中或等待中');
        }

        // 创建下载任务
        const task: DownloadTask = {
            tvId,
            episodeId,
            videoUrl,
            headers,
            status: DownloadStatus.PENDING,
            progress: 0,
            totalBytes: 0,
            downloadedBytes: 0,
            startedAt: new Date().toISOString(),
        };

        this.downloadTasks.set(key, task);

        // 加入下载队列
        this.downloadQueue.push(key);

        // 尝试处理队列
        this.processQueue();
    }

    // 处理下载队列
    private processQueue(): void {
        // 如果已达到最大并发数，则不处理
        if (this.runningDownloads >= this.MAX_CONCURRENT_DOWNLOADS) {
            return;
        }

        // 从队列中取出任务
        while (this.runningDownloads < this.MAX_CONCURRENT_DOWNLOADS && this.downloadQueue.length > 0) {
            const key = this.downloadQueue.shift();
            if (!key) break;

            const task = this.downloadTasks.get(key);
            if (!task) continue;

            // 开始下载
            this.runningDownloads++;
            this.executeDownload(task.tvId, task.episodeId, task.videoUrl, task.headers)
                .catch((error) => {
                    console.error(`下载失败 [${task.tvId}-${task.episodeId}]:`, error);
                })
                .finally(() => {
                    this.runningDownloads--;
                    // 下载完成后，继续处理队列
                    this.processQueue();
                });
        }
    }

    // 执行下载（内部方法）
    private async executeDownload(
        tvId: number,
        episodeId: number,
        videoUrl: string,
        headers?: Record<string, string>
    ): Promise<void> {
        const key = this.getCacheKey(tvId, episodeId);
        const task = this.downloadTasks.get(key);

        if (!task) {
            return;
        }

        try {
            // 更新状态为下载中
            task.status = DownloadStatus.DOWNLOADING;
            this.notifyProgress(task);

            const localUri = this.getLocalFilePath(tvId, episodeId);

            const downloadResumable = FileSystem.createDownloadResumable(
                videoUrl,
                localUri,
                { headers },
                (downloadProgress) => {
                    const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                    task.progress = progress;
                    task.totalBytes = downloadProgress.totalBytesExpectedToWrite;
                    task.downloadedBytes = downloadProgress.totalBytesWritten;
                    this.notifyProgress(task);
                }
            );

            this.activeDownloads.set(key, downloadResumable);

            const result = await downloadResumable.downloadAsync();

            if (!result) {
                throw new Error('下载失败');
            }

            // 获取文件大小
            const fileInfo = await FileSystem.getInfoAsync(result.uri);
            const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

            // 保存元数据
            const cachedVideo: CachedVideo = {
                tvId,
                episodeId,
                localUri: result.uri,
                downloadedAt: new Date().toISOString(),
                fileSize,
            };

            this.metadata.set(key, cachedVideo);
            await this.saveMetadata();

            // 更新任务状态
            task.status = DownloadStatus.COMPLETED;
            task.progress = 1;
            task.completedAt = new Date().toISOString();
            this.notifyComplete(task);

            // 清理任务（延迟清理，让监听器有时间处理）
            setTimeout(() => {
                this.downloadTasks.delete(key);
            }, 2000);
        } catch (error) {
            // 下载失败
            task.status = DownloadStatus.FAILED;
            task.error = error instanceof Error ? error.message : '未知错误';
            this.notifyError(task);

            // 清理临时文件
            const localUri = this.getLocalFilePath(tvId, episodeId);
            const fileInfo = await FileSystem.getInfoAsync(localUri);
            if (fileInfo.exists) {
                await FileSystem.deleteAsync(localUri, { idempotent: true });
            }

            // 延迟清理任务
            setTimeout(() => {
                this.downloadTasks.delete(key);
            }, 5000);
        } finally {
            this.activeDownloads.delete(key);
        }
    }

    // 获取下载任务状态
    getDownloadTask(tvId: number, episodeId: number): DownloadTask | null {
        const key = this.getCacheKey(tvId, episodeId);
        return this.downloadTasks.get(key) || null;
    }

    // 获取所有下载任务
    getAllDownloadTasks(): DownloadTask[] {
        return Array.from(this.downloadTasks.values());
    }

    // 取消下载任务
    async cancelDownloadTask(tvId: number, episodeId: number): Promise<void> {
        const key = this.getCacheKey(tvId, episodeId);
        const task = this.downloadTasks.get(key);

        if (!task) {
            return;
        }

        // 从队列中移除（如果在队列中）
        const queueIndex = this.downloadQueue.indexOf(key);
        if (queueIndex !== -1) {
            this.downloadQueue.splice(queueIndex, 1);
        }

        // 如果正在下载，减少计数
        if (task.status === DownloadStatus.DOWNLOADING) {
            // 取消下载
            await this.cancelDownload(tvId, episodeId);
            this.runningDownloads--;
            // 继续处理队列中的其他任务
            this.processQueue();
        }

        // 更新任务状态
        task.status = DownloadStatus.CANCELLED;
        this.downloadTasks.delete(key);

        // 清理临时文件
        const localUri = this.getLocalFilePath(tvId, episodeId);
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (fileInfo.exists) {
            await FileSystem.deleteAsync(localUri, { idempotent: true });
        }
    }

    // ==================== 事件监听 ====================

    // 注册进度监听器
    onProgress(tvId: number, episodeId: number, listener: DownloadEventListener): () => void {
        const key = this.getCacheKey(tvId, episodeId);
        if (!this.progressListeners.has(key)) {
            this.progressListeners.set(key, new Set());
        }
        this.progressListeners.get(key)!.add(listener);

        // 返回取消监听的函数
        return () => {
            this.progressListeners.get(key)?.delete(listener);
        };
    }

    // 注册完成监听器
    onComplete(tvId: number, episodeId: number, listener: DownloadEventListener): () => void {
        const key = this.getCacheKey(tvId, episodeId);
        if (!this.completeListeners.has(key)) {
            this.completeListeners.set(key, new Set());
        }
        this.completeListeners.get(key)!.add(listener);

        return () => {
            this.completeListeners.get(key)?.delete(listener);
        };
    }

    // 注册错误监听器
    onError(tvId: number, episodeId: number, listener: DownloadEventListener): () => void {
        const key = this.getCacheKey(tvId, episodeId);
        if (!this.errorListeners.has(key)) {
            this.errorListeners.set(key, new Set());
        }
        this.errorListeners.get(key)!.add(listener);

        return () => {
            this.errorListeners.get(key)?.delete(listener);
        };
    }

    // 通知进度更新
    private notifyProgress(task: DownloadTask): void {
        const key = this.getCacheKey(task.tvId, task.episodeId);
        const listeners = this.progressListeners.get(key);
        if (listeners) {
            listeners.forEach((listener) => listener({ ...task }));
        }
    }

    // 通知下载完成
    private notifyComplete(task: DownloadTask): void {
        const key = this.getCacheKey(task.tvId, task.episodeId);
        const listeners = this.completeListeners.get(key);
        if (listeners) {
            listeners.forEach((listener) => listener({ ...task }));
        }

        // 通知全局监听器
        this.globalCompleteListeners.forEach((listener) => listener({ ...task }));
    }

    // 通知下载错误
    private notifyError(task: DownloadTask): void {
        const key = this.getCacheKey(task.tvId, task.episodeId);
        const listeners = this.errorListeners.get(key);
        if (listeners) {
            listeners.forEach((listener) => listener({ ...task }));
        }

        // 通知全局监听器
        this.globalErrorListeners.forEach((listener) => listener({ ...task }));
    }

    // 清除所有监听器
    clearListeners(tvId: number, episodeId: number): void {
        const key = this.getCacheKey(tvId, episodeId);
        this.progressListeners.delete(key);
        this.completeListeners.delete(key);
        this.errorListeners.delete(key);
    }

    // 注册全局完成监听器（监听所有任务的完成事件）
    onAnyComplete(listener: DownloadEventListener): () => void {
        this.globalCompleteListeners.add(listener);
        return () => {
            this.globalCompleteListeners.delete(listener);
        };
    }

    // 注册全局错误监听器（监听所有任务的错误事件）
    onAnyError(listener: DownloadEventListener): () => void {
        this.globalErrorListeners.add(listener);
        return () => {
            this.globalErrorListeners.delete(listener);
        };
    }

    // ==================== 队列状态查询 ====================

    // 获取当前正在下载的任务数量
    getRunningDownloadsCount(): number {
        return this.runningDownloads;
    }

    getTotalDownloadTasksCount(): number {
        return this.downloadQueue.length + this.runningDownloads;
    }

    // 获取等待中的任务数量
    getQueuedDownloadsCount(): number {
        return this.downloadQueue.length;
    }

    // 获取最大并发下载数
    getMaxConcurrentDownloads(): number {
        return this.MAX_CONCURRENT_DOWNLOADS;
    }
}

// 导出单例
export const videoCache = new VideoCache();
