/**
 * 自动更新：从 {service}/package/package.json 读取版本，
 * 与当前版本比较，若有更新则下载 {service}/package/tvsurf-android.apk 并安装。
 * 仅支持 Android。
 */
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getApiBaseUrl, getApiToken } from '../api/client';
import * as IntentLauncher from 'expo-intent-launcher';

export interface PackageJson {
    version: string;
}

async function getBaseUrlAndToken(): Promise<{ baseUrl: string; token: string }> {
    const baseUrl = await getApiBaseUrl();
    const token = await getApiToken();
    if (!baseUrl || !token) throw new Error('未登录或未配置服务地址');
    return { baseUrl: baseUrl.replace(/\/$/, ''), token };
}

/** 从服务端获取 package/package.json */
export async function fetchPackageJson(): Promise<PackageJson> {
    const { baseUrl, token } = await getBaseUrlAndToken();
    const url = `${baseUrl}/package/package.json`;
    const res = await fetch(url, {
        method: 'GET',
        headers: { Cookie: `tvsurf_token=${token}` },
    });
    if (!res.ok) throw new Error(`获取版本信息失败: ${res.status}`);
    const json = (await res.json()) as PackageJson;
    if (!json?.version) throw new Error('无效的 package.json');
    return json;
}

/** 当前应用版本（来自 app.json expo.version） */
export function getCurrentVersion(): string {
    const v = Constants.expoConfig?.version ?? (Constants.manifest as { version?: string } | undefined)?.version;
    return typeof v === 'string' ? v : '0.0.0';
}

/** 解析 "x.y.z" 为 [x,y,z]，非法则 [0,0,0] */
function parseVersion(s: string): number[] {
    const parts = s.trim().split('.').map((p) => parseInt(p, 10));
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return [0, 0, 0];
    return parts.slice(0, 3) as [number, number, number];
}

/** 比较版本：latest > current 返回 1，相等 0，否则 -1 */
export function compareVersions(current: string, latest: string): number {
    const c = parseVersion(current);
    const l = parseVersion(latest);
    for (let i = 0; i < 3; i++) {
        if (l[i] > c[i]) return 1;
        if (l[i] < c[i]) return -1;
    }
    return 0;
}

export interface CheckUpdateResult {
    available: boolean;
    currentVersion: string;
    latestVersion: string;
}

/** 检查是否有可更新版本 */
export async function checkUpdate(): Promise<CheckUpdateResult> {
    const current = getCurrentVersion();
    const pkg = await fetchPackageJson();
    const latest = pkg.version;
    const cmp = compareVersions(current, latest);
    return {
        available: cmp > 0,
        currentVersion: current,
        latestVersion: latest,
    };
}

export type DownloadProgressCallback = (progress: number, totalBytes: number, downloadedBytes: number) => void;

const APK_FILE_NAME = 'tvsurf-android.apk';

/** 下载 APK 到缓存目录，返回本地 file URI */
export async function downloadApk(onProgress?: DownloadProgressCallback): Promise<string> {
    if (Platform.OS !== 'android') throw new Error('仅支持 Android 更新');
    const { baseUrl, token } = await getBaseUrlAndToken();
    const url = `${baseUrl}/package/${APK_FILE_NAME}`;
    const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!dir) throw new Error('无法获取缓存目录');
    const localUri = `${dir}${APK_FILE_NAME}`;
    const headers: Record<string, string> = { Cookie: `tvsurf_token=${token}` };

    const download = FileSystem.createDownloadResumable(
        url,
        localUri,
        { headers },
        (ev) => {
            const total = ev.totalBytesExpectedToWrite;
            const done = ev.totalBytesWritten;
            if (total > 0) onProgress?.(done / total, total, done);
        }
    );
    const result = await download.downloadAsync();
    if (!result?.uri) throw new Error('下载失败');
    return result.uri;
}

/** 使用 content URI 调起安装（Android 7+ 需要） */
async function getContentUriForInstall(fileUri: string): Promise<string> {
    if (Platform.OS !== 'android') return fileUri;
    try {
        return await FileSystem.getContentUriAsync(fileUri);
    } catch {
        return fileUri;
    }
}

/** 安装已下载的 APK（调起系统安装界面） */
export async function installApk(localFileUri: string): Promise<void> {
    if (Platform.OS !== 'android') throw new Error('仅支持 Android');
    const uri = await getContentUriForInstall(localFileUri);
    try {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: uri,
            type: 'application/vnd.android.package-archive',
            flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        });
    } catch (error) {
        console.error('安装失败', error);
        throw error;
    }
}
