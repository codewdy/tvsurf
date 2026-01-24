import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    BackHandler,
    Alert,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getErrors, removeErrors } from '../api/client-proxy';
import type { Error, ErrorType } from '../api/types';

interface ErrorManagementScreenProps {
    onBack: () => void;
}

// 格式化时间
function formatTimestamp(timestamp: string): string {
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return '刚刚';
        } else if (diffMins < 60) {
            return `${diffMins}分钟前`;
        } else if (diffHours < 24) {
            return `${diffHours}小时前`;
        } else if (diffDays < 7) {
            return `${diffDays}天前`;
        } else {
            // 超过7天显示具体日期
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hour = String(date.getHours()).padStart(2, '0');
            const minute = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day} ${hour}:${minute}`;
        }
    } catch (error) {
        return timestamp;
    }
}

// 获取错误类型显示文本和颜色
function getErrorTypeInfo(type: ErrorType): { text: string; color: string; bgColor: string } {
    if (type === 'critical') {
        return {
            text: '严重',
            color: '#FF3B30',
            bgColor: '#FFEBEE',
        };
    }
    return {
        text: '错误',
        color: '#FF9500',
        bgColor: '#FFF3E0',
    };
}

export default function ErrorManagementScreen({ onBack }: ErrorManagementScreenProps) {
    const [errors, setErrors] = useState<Error[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedError, setSelectedError] = useState<Error | null>(null);

    const fetchErrors = async () => {
        try {
            const data = await getErrors({});
            setErrors(data.errors || []);
            setError(null);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '获取错误列表时发生错误';
            setError(errorMessage);
            console.error('Fetch errors error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // 初始加载
    useEffect(() => {
        fetchErrors();

        // 监听安卓返回按钮
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (isSelectionMode) {
                setIsSelectionMode(false);
                setSelectedIds(new Set());
                return true;
            }
            onBack();
            return true;
        });

        return () => {
            backHandler.remove();
        };
    }, [onBack, isSelectionMode]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchErrors();
    };

    const handleErrorPress = (errorItem: Error) => {
        if (isSelectionMode) {
            // 选择模式：切换选择状态
            const newSelectedIds = new Set(selectedIds);
            if (newSelectedIds.has(errorItem.id)) {
                newSelectedIds.delete(errorItem.id);
            } else {
                newSelectedIds.add(errorItem.id);
            }
            setSelectedIds(newSelectedIds);
            if (newSelectedIds.size === 0) {
                setIsSelectionMode(false);
            }
        } else {
            // 普通模式：显示详情
            setSelectedError(errorItem);
            setDetailModalVisible(true);
        }
    };

    const handleLongPress = (errorItem: Error) => {
        if (!isSelectionMode) {
            setIsSelectionMode(true);
            setSelectedIds(new Set([errorItem.id]));
        }
    };

    const handleDelete = () => {
        if (selectedIds.size === 0) {
            Alert.alert('提示', '请先选择要删除的错误');
            return;
        }

        Alert.alert(
            '确认删除',
            `确定要删除选中的 ${selectedIds.size} 个错误吗？`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '删除',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await removeErrors({ ids: Array.from(selectedIds) });
                            setSelectedIds(new Set());
                            setIsSelectionMode(false);
                            await fetchErrors();
                        } catch (err) {
                            const errorMessage = err instanceof Error ? err.message : '删除错误时发生错误';
                            Alert.alert('错误', errorMessage);
                        }
                    },
                },
            ]
        );
    };

    const handleDeleteAll = () => {
        if (errors.length === 0) {
            Alert.alert('提示', '没有可删除的错误');
            return;
        }

        Alert.alert(
            '确认删除',
            `确定要删除所有 ${errors.length} 个错误吗？`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '删除全部',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const allIds = errors.map(e => e.id);
                            await removeErrors({ ids: allIds });
                            await fetchErrors();
                        } catch (err) {
                            const errorMessage = err instanceof Error ? err.message : '删除错误时发生错误';
                            Alert.alert('错误', errorMessage);
                        }
                    },
                },
            ]
        );
    };

    const exitSelectionMode = () => {
        setIsSelectionMode(false);
        setSelectedIds(new Set());
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* 头部 */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={isSelectionMode ? exitSelectionMode : onBack}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={24} color="#007AFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {isSelectionMode ? `已选择 ${selectedIds.size}` : '错误管理'}
                </Text>
                <View style={styles.headerRight}>
                    {isSelectionMode ? (
                        <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                        </TouchableOpacity>
                    ) : (
                        <>
                            {errors.length > 0 && (
                                <TouchableOpacity onPress={handleDeleteAll} style={styles.headerButton}>
                                    <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>
            </View>

            {/* 错误信息 */}
            {error && (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={20} color="#EF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {/* 内容 */}
            {loading && errors.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>加载中...</Text>
                </View>
            ) : errors.length === 0 ? (
                <ScrollView
                    contentContainerStyle={styles.emptyContainer}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >
                    <Ionicons name="checkmark-circle-outline" size={64} color="#34C759" />
                    <Text style={styles.emptyText}>当前没有错误</Text>
                </ScrollView>
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                >
                    {errors.map((errorItem) => {
                        const isSelected = selectedIds.has(errorItem.id);
                        const typeInfo = getErrorTypeInfo(errorItem.type);

                        return (
                            <TouchableOpacity
                                key={errorItem.id}
                                style={[
                                    styles.errorCard,
                                    isSelected && styles.errorCardSelected,
                                ]}
                                onPress={() => handleErrorPress(errorItem)}
                                onLongPress={() => handleLongPress(errorItem)}
                                activeOpacity={0.7}
                            >
                                {isSelectionMode && (
                                    <View style={styles.checkboxContainer}>
                                        <Ionicons
                                            name={isSelected ? 'checkbox' : 'checkbox-outline'}
                                            size={24}
                                            color={isSelected ? '#007AFF' : '#999'}
                                        />
                                    </View>
                                )}
                                <View style={styles.errorCardContent}>
                                    <View style={styles.errorCardHeader}>
                                        <View style={styles.errorTitleContainer}>
                                            <Text style={styles.errorTitle} numberOfLines={2}>
                                                {errorItem.title}
                                            </Text>
                                            <View
                                                style={[
                                                    styles.errorTypeBadge,
                                                    { backgroundColor: typeInfo.bgColor },
                                                ]}
                                            >
                                                <Text style={[styles.errorTypeText, { color: typeInfo.color }]}>
                                                    {typeInfo.text}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                    <Text style={styles.errorTimestamp}>
                                        {formatTimestamp(errorItem.timestamp)}
                                    </Text>
                                    <Text style={styles.errorDescription} numberOfLines={3}>
                                        {errorItem.description}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}

            {/* 错误详情模态框 */}
            <Modal
                visible={detailModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setDetailModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>错误详情</Text>
                            <TouchableOpacity
                                onPress={() => setDetailModalVisible(false)}
                                style={styles.modalCloseButton}
                            >
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>
                        {selectedError && (
                            <ScrollView style={styles.modalContent}>
                                <View style={styles.modalSection}>
                                    <Text style={styles.modalLabel}>标题</Text>
                                    <Text style={styles.modalValue}>{selectedError.title}</Text>
                                </View>
                                <View style={styles.modalSection}>
                                    <Text style={styles.modalLabel}>类型</Text>
                                    <View
                                        style={[
                                            styles.modalTypeBadge,
                                            {
                                                backgroundColor: getErrorTypeInfo(selectedError.type).bgColor,
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.modalTypeText,
                                                { color: getErrorTypeInfo(selectedError.type).color },
                                            ]}
                                        >
                                            {getErrorTypeInfo(selectedError.type).text}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.modalSection}>
                                    <Text style={styles.modalLabel}>时间</Text>
                                    <Text style={styles.modalValue}>
                                        {new Date(selectedError.timestamp).toLocaleString('zh-CN')}
                                    </Text>
                                </View>
                                <View style={styles.modalSection}>
                                    <Text style={styles.modalLabel}>详细信息</Text>
                                    <Text style={styles.modalDescription}>{selectedError.description}</Text>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5E5',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000000',
        flex: 1,
        textAlign: 'center',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerButton: {
        padding: 8,
        marginLeft: 8,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        borderColor: '#FCA5A5',
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        margin: 16,
        gap: 8,
    },
    errorText: {
        flex: 1,
        color: '#DC2626',
        fontSize: 14,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: '#9CA3AF',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    errorCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        flexDirection: 'row',
    },
    errorCardSelected: {
        backgroundColor: '#E3F2FD',
        borderWidth: 2,
        borderColor: '#007AFF',
    },
    checkboxContainer: {
        marginRight: 12,
        justifyContent: 'center',
    },
    errorCardContent: {
        flex: 1,
    },
    errorCardHeader: {
        marginBottom: 8,
    },
    errorTitleContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 8,
    },
    errorTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000000',
        flex: 1,
        minWidth: '60%',
    },
    errorTypeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    errorTypeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    errorTimestamp: {
        fontSize: 12,
        color: '#9CA3AF',
        marginBottom: 8,
    },
    errorDescription: {
        fontSize: 14,
        color: '#666666',
        lineHeight: 20,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        width: '100%',
        maxHeight: '80%',
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5E5',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000000',
    },
    modalCloseButton: {
        padding: 4,
    },
    modalContent: {
        padding: 16,
    },
    modalSection: {
        marginBottom: 16,
    },
    modalLabel: {
        fontSize: 12,
        color: '#9CA3AF',
        marginBottom: 8,
        fontWeight: '500',
    },
    modalValue: {
        fontSize: 16,
        color: '#000000',
        lineHeight: 24,
    },
    modalTypeBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    modalTypeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    modalDescription: {
        fontSize: 14,
        color: '#666666',
        lineHeight: 20,
        fontFamily: 'monospace',
    },
});
