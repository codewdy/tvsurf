import { AppState } from 'react-native';
import * as api from '../api/client';
import { offlineDataCache } from './offlineDataCache';
import type { Tag } from '../api/types';

export function isUnavailable(error: unknown): boolean {
    return !!error && typeof error === 'object' && 'unavailable' in error && error.unavailable === true;
}

function isRejected(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('status' in error)) return false;
    return typeof error.status === 'number' && error.status >= 400 && error.status < 500 && !isUnavailable(error);
}

// Serialize cache changes and uploads so a completed upload cannot remove a newer edit.
class DataSync {
    private refreshPending = false;
    private unavailableUntil = 0;
    private unavailableError: unknown;
    private tail: Promise<unknown> = Promise.resolve();
    private retryReads = new Map<string, { scope: string; fetchData: () => Promise<unknown> }>();

    private exclusive<T>(work: () => Promise<T>): Promise<T> {
        const result = this.tail.then(work);
        this.tail = result.catch(() => {});
        return result;
    }

    async read<T>(key: string, fetchData: () => Promise<T>, cached: () => Promise<T | null>): Promise<T> {
        return this.exclusive(async () => {
            await offlineDataCache.initialize();
            try {
                this.checkAvailability();
                await this.flush();
                const result = await fetchData();
                this.retryReads.delete(key);
                return result;
            } catch (error) {
                if (!isUnavailable(error)) throw error;
                this.defer(error);
                this.retryReads.set(key, { scope: await this.scope(), fetchData });
                const data = await cached();
                if (data !== null) return data;
                throw error;
            }
        });
    }

    async write<T>(record: () => Promise<T>): Promise<T> {
        return this.exclusive(async () => {
            await offlineDataCache.initialize();
            return offlineDataCache.batchPendingChangesNotifications(async () => {
                // Finish earlier operations before recording another edit when reachable.
                try {
                    await this.flush();
                } catch (error) {
                    if (!isUnavailable(error)) throw error;
                    this.defer(error);
                }
                const snapshot = offlineDataCache.snapshotData();
                const result = await record();
                try {
                    await this.flush();
                } catch (error) {
                    if (!isUnavailable(error)) {
                        if (isRejected(error)) await offlineDataCache.restoreData(snapshot);
                        throw error;
                    }
                    this.defer(error);
                }
                return result;
            });
        });
    }

    private defer(error: unknown): void {
        if (Date.now() < this.unavailableUntil) return;
        this.unavailableError = error;
        this.unavailableUntil = Date.now() + 30000;
    }

    private checkAvailability(): void {
        if (Date.now() < this.unavailableUntil) throw this.unavailableError;
    }

    private async flush(): Promise<void> {
        this.checkAvailability();
        for (const operation of await offlineDataCache.getAllOperationsInOrder()) {
            try {
                switch (operation.type) {
                    case 'watch_progress': {
                        const d = operation.data as { tvId: number; episodeId: number; time: number };
                        await api.setWatchProgress({ tv_id: d.tvId, episode_id: d.episodeId, time: d.time });
                        break;
                    }
                    case 'tag_change': {
                        const d = operation.data as { tvId: number; tag: Tag };
                        await api.setTVTag({ tv_id: d.tvId, tag: d.tag });
                        break;
                    }
                    case 'tracking_change': {
                        const d = operation.data as { tvId: number; tracking: boolean };
                        await api.setTVTracking({ tv_id: d.tvId, tracking: d.tracking });
                        break;
                    }
                    case 'add_series': {
                        const d = operation.data as { tempId: number; name: string };
                        if (offlineDataCache.resolveId(d.tempId) === d.tempId) {
                            const response = await api.addSeries({ name: d.name });
                            await offlineDataCache.setRealId(d.tempId, response.id);
                        }
                        break;
                    }
                    case 'update_series_tvs': {
                        const d = operation.data as { seriesId: number; tvs: number[] };
                        await api.updateSeriesTVs({ id: offlineDataCache.resolveId(d.seriesId), tvs: d.tvs });
                        break;
                    }
                    case 'remove_series': {
                        const d = operation.data as { seriesId: number };
                        await api.removeSeries({ id: offlineDataCache.resolveId(d.seriesId) });
                        break;
                    }
                }
            } catch (error) {
                if (isRejected(error)) await offlineDataCache.removeOperationAt(0);
                throw error;
            }
            await offlineDataCache.removeOperationAt(0);
        }
    }

    private async scope(): Promise<string> {
        return JSON.stringify([await api.getApiBaseUrl(), await api.getApiToken()]);
    }

    configure(work: () => Promise<void>): Promise<void> {
        return this.exclusive(async () => {
            await work();
            this.unavailableUntil = 0;
            this.retryReads.clear();
            this.refreshPending = false;
            await offlineDataCache.initialize();
        });
    }

    private async refreshOfflineData(): Promise<void> {
        const snapshot = await api.snapshot();
        await offlineDataCache.replaceOfflineData(snapshot);
    }

    retry(refreshAll = false): Promise<void> {
        return this.exclusive(async () => {
            if (!(await api.getApiToken())) return;
            this.refreshPending ||= refreshAll;
            this.unavailableUntil = 0;
            await offlineDataCache.initialize();
            await this.flush();
            if (this.refreshPending) {
                try {
                    await this.refreshOfflineData();
                    this.refreshPending = false;
                } catch (error) {
                    if (isUnavailable(error)) this.defer(error);
                    throw error;
                }
            }
            const scope = await this.scope();
            for (const [key, pending] of this.retryReads) {
                if (pending.scope !== scope) { this.retryReads.delete(key); continue; }
                try {
                    await pending.fetchData();
                    this.retryReads.delete(key);
                } catch (error) {
                    if (!isUnavailable(error)) this.retryReads.delete(key);
                    throw error;
                }
            }
        });
    }

    start(): () => void {
        const retry = (refreshAll = false) => { void this.retry(refreshAll).catch(error => console.warn('数据同步稍后重试:', error)); };
        retry(true);
        const timer = setInterval(() => {
            if (AppState.currentState === 'active') retry();
        }, 30000);
        let previousState = AppState.currentState;
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active' && previousState !== 'active') retry(true);
            previousState = state;
        });
        return () => { clearInterval(timer); subscription.remove(); };
    }
}

export const dataSync = new DataSync();
