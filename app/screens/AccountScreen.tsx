import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    BackHandler,
    Alert,
    TextInput,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { whoami, setMyPassword } from '../api/client-proxy';
import { offlineModeManager } from '../utils/offlineModeManager';
import { hashPassword } from '../utils/password';
import type { WhoamiResponse } from '../api/types';

interface AccountScreenProps {
    onBack: () => void;
    onLogout: () => void;
}

export default function AccountScreen({ onBack, onLogout }: AccountScreenProps) {
    const [userInfo, setUserInfo] = useState<WhoamiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [changePasswordVisible, setChangePasswordVisible] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        loadUserInfo();
        loadOfflineStatus();
    }, []);

    // 监听 Android 后退按钮
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (changePasswordVisible) {
                setChangePasswordVisible(false);
                return true;
            }
            onBack();
            return true;
        });

        return () => backHandler.remove();
    }, [changePasswordVisible, onBack]);

    const loadOfflineStatus = async () => {
        try {
            const offline = await offlineModeManager.getOfflineMode();
            setIsOffline(offline);
        } catch (error) {
            console.error('加载离线模式状态失败:', error);
        }
    };

    const loadUserInfo = async () => {
        try {
            setLoading(true);
            const info = await whoami({});
            setUserInfo(info);
        } catch (error) {
            console.error('加载用户信息失败:', error);
            Alert.alert('错误', '加载用户信息失败');
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!oldPassword || !newPassword || !confirmPassword) {
            Alert.alert('提示', '请填写所有字段');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('提示', '新密码和确认密码不一致');
            return;
        }

        if (isOffline) {
            Alert.alert('提示', '离线模式下无法修改密码，请先退出离线模式');
            return;
        }

        if (userInfo?.single_user_mode) {
            Alert.alert('提示', '单用户模式下无法修改密码');
            return;
        }

        setChangingPassword(true);
        try {
            // 生成新密码的哈希
            const newPasswordHash = await hashPassword(newPassword, userInfo?.user?.username || '');

            // 调用修改密码 API
            await setMyPassword({
                password_hash: newPasswordHash,
            });

            Alert.alert('成功', '密码修改成功', [
                {
                    text: '确定',
                    onPress: () => {
                        setChangePasswordVisible(false);
                        setOldPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                    },
                },
            ]);
        } catch (error) {
            console.error('修改密码失败:', error);
            const errorMessage = error instanceof Error ? error.message : '修改密码失败';
            Alert.alert('错误', errorMessage);
        } finally {
            setChangingPassword(false);
        }
    };

    const handleLogout = () => {
        if (isOffline) {
            Alert.alert('提示', '离线模式下无法退出登录，请先退出离线模式');
            return;
        }

        Alert.alert(
            '退出登录',
            '确定要退出登录吗？',
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '退出',
                    style: 'destructive',
                    onPress: () => {
                        onLogout();
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={onBack}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>我的账户</Text>
                    <View style={styles.headerPlaceholder} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>加载中...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={onBack}
                    activeOpacity={0.7}
                >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>我的账户</Text>
                <View style={styles.headerPlaceholder} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {/* 用户信息卡片 */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="person-circle-outline" size={24} color="#007AFF" />
                        <Text style={styles.cardTitle}>用户信息</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>用户名</Text>
                        <Text style={styles.infoValue}>{userInfo?.user?.username || '-'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>用户组</Text>
                        <Text style={styles.infoValue}>
                            {userInfo?.user?.group?.join(', ') || '-'}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>工作模式</Text>
                        <Text style={styles.infoValue}>
                            {userInfo?.single_user_mode ? '单用户模式' : '多用户模式'}
                        </Text>
                    </View>
                </View>

                {/* 操作按钮 */}
                <View style={styles.card}>
                    <TouchableOpacity
                        style={[
                            styles.actionButton,
                            (isOffline || userInfo?.single_user_mode) && styles.actionButtonDisabled
                        ]}
                        onPress={() => {
                            if (userInfo?.single_user_mode) {
                                Alert.alert('提示', '单用户模式下无法修改密码');
                                return;
                            }
                            setChangePasswordVisible(true);
                        }}
                        activeOpacity={0.7}
                        disabled={isOffline || userInfo?.single_user_mode}
                    >
                        <Ionicons
                            name="lock-closed-outline"
                            size={22}
                            color={(isOffline || userInfo?.single_user_mode) ? '#999' : '#007AFF'}
                        />
                        <Text
                            style={[
                                styles.actionButtonText,
                                (isOffline || userInfo?.single_user_mode) && styles.actionButtonTextDisabled,
                            ]}
                        >
                            修改密码
                        </Text>
                        <Ionicons
                            name="chevron-forward"
                            size={20}
                            color={(isOffline || userInfo?.single_user_mode) ? '#999' : '#999'}
                        />
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <TouchableOpacity
                        style={[
                            styles.actionButton,
                            styles.actionButtonDanger,
                            isOffline && styles.actionButtonDisabled,
                        ]}
                        onPress={handleLogout}
                        activeOpacity={0.7}
                        disabled={isOffline}
                    >
                        <Ionicons
                            name="log-out-outline"
                            size={22}
                            color={isOffline ? '#999' : '#FF3B30'}
                        />
                        <Text
                            style={[
                                styles.actionButtonText,
                                styles.actionButtonTextDanger,
                                isOffline && styles.actionButtonTextDisabled,
                            ]}
                        >
                            退出登录
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* 修改密码对话框 */}
            <Modal
                visible={changePasswordVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setChangePasswordVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>修改密码</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setChangePasswordVisible(false);
                                    setOldPassword('');
                                    setNewPassword('');
                                    setConfirmPassword('');
                                }}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalScrollView}>
                            <View style={styles.modalInputContainer}>
                                <Text style={styles.modalLabel}>当前密码</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="请输入当前密码"
                                    placeholderTextColor="#999"
                                    value={oldPassword}
                                    onChangeText={setOldPassword}
                                    secureTextEntry
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    editable={!changingPassword}
                                />
                            </View>

                            <View style={styles.modalInputContainer}>
                                <Text style={styles.modalLabel}>新密码</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="请输入新密码"
                                    placeholderTextColor="#999"
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    secureTextEntry
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    editable={!changingPassword}
                                />
                            </View>

                            <View style={styles.modalInputContainer}>
                                <Text style={styles.modalLabel}>确认新密码</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="请再次输入新密码"
                                    placeholderTextColor="#999"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    editable={!changingPassword}
                                />
                            </View>

                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    changingPassword && styles.modalButtonDisabled,
                                ]}
                                onPress={handleChangePassword}
                                disabled={changingPassword}
                                activeOpacity={0.7}
                            >
                                {changingPassword ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.modalButtonText}>确认修改</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
        textAlign: 'center',
    },
    headerPlaceholder: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 16,
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
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginLeft: 8,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#f0f0f0',
    },
    infoLabel: {
        fontSize: 16,
        color: '#666',
    },
    infoValue: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
    },
    actionButtonDisabled: {
        opacity: 0.5,
    },
    actionButtonDanger: {
        // 危险操作样式
    },
    actionButtonText: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        marginLeft: 12,
    },
    actionButtonTextDanger: {
        color: '#FF3B30',
    },
    actionButtonTextDisabled: {
        color: '#999',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#e0e0e0',
        marginVertical: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    modalScrollView: {
        maxHeight: 400,
    },
    modalInputContainer: {
        padding: 16,
    },
    modalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 6,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
        color: '#333',
    },
    modalButton: {
        backgroundColor: '#007AFF',
        borderRadius: 6,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        margin: 16,
        marginTop: 8,
    },
    modalButtonDisabled: {
        opacity: 0.6,
    },
    modalButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
