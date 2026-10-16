import React, { useEffect, useSyncExternalStore } from 'react';
import { Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { offlineDataCache } from '../utils/offlineDataCache';

export default function PendingSyncIndicator() {
    const pendingCount = useSyncExternalStore(
        offlineDataCache.subscribePendingChanges,
        offlineDataCache.getPendingChangesSnapshot,
        offlineDataCache.getPendingChangesSnapshot,
    );

    useEffect(() => {
        void offlineDataCache.initialize().catch(error => console.error('加载待同步状态失败:', error));
    }, []);

    if (pendingCount === 0) return null;

    return (
        <TouchableOpacity
            style={styles.badge}
            accessibilityRole="button"
            accessibilityLabel={`有 ${pendingCount} 项修改待同步`}
            onPress={() => Alert.alert('数据待同步', `有 ${pendingCount} 项修改尚未同步，连接恢复后会自动重试。`)}
            activeOpacity={0.7}
            hitSlop={8}
        >
            <Ionicons name="cloud-upload-outline" size={14} color="#FF9500" />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    badge: {
        marginLeft: 8,
        paddingHorizontal: 6,
        paddingVertical: 4,
        backgroundColor: '#FFF3E0',
        borderRadius: 12,
        flexShrink: 0,
    },
});
