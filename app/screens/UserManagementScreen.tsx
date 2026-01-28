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
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getUsers, addUser, removeUser, updateUserGroup, setUserPassword, whoami } from '../api/client-proxy';
import { offlineModeManager } from '../utils/offlineModeManager';
import { hashPassword } from '../utils/password';
import type { UserInfo, GetUsersResponse } from '../api/types';

interface UserManagementScreenProps {
    onBack: () => void;
}

export default function UserManagementScreen({ onBack }: UserManagementScreenProps) {
    const [users, setUsers] = useState<UserInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isOffline, setIsOffline] = useState(false);
    const [singleUserMode, setSingleUserMode] = useState(false);
    const [userInfo, setUserInfo] = useState<any>(null);
    const [checkingPermission, setCheckingPermission] = useState(true);

    // 添加用户相关状态
    const [addUserModalVisible, setAddUserModalVisible] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newGroups, setNewGroups] = useState<string[]>(['user']);
    const [newGroupInput, setNewGroupInput] = useState('');

    // 编辑用户相关状态
    const [editUserModalVisible, setEditUserModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
    const [editGroups, setEditGroups] = useState<string[]>([]);
    const [editGroupInput, setEditGroupInput] = useState('');

    // 修改密码相关状态
    const [passwordModalVisible, setPasswordModalVisible] = useState(false);
    const [passwordUser, setPasswordUser] = useState<UserInfo | null>(null);
    const [newPasswordValue, setNewPasswordValue] = useState('');
    const [confirmPasswordValue, setConfirmPasswordValue] = useState('');

    useEffect(() => {
        checkPermission();
        loadOfflineStatus();

        // 监听安卓返回按钮
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            onBack();
            return true;
        });

        return () => {
            backHandler.remove();
        };
    }, [onBack]);

    const checkPermission = async () => {
        try {
            setCheckingPermission(true);
            const info = await whoami({});
            setUserInfo(info);
            const isAdmin = info?.user?.group?.includes('admin') ?? false;
            if (!isAdmin) {
                Alert.alert('权限不足', '只有管理员可以访问用户管理页面', [
                    { text: '确定', onPress: onBack }
                ]);
                return;
            }
            // 权限检查通过后加载用户列表
            await loadUsers();
        } catch (err) {
            console.error('检查权限失败:', err);
            Alert.alert('错误', '无法验证权限，请重试', [
                { text: '确定', onPress: onBack }
            ]);
        } finally {
            setCheckingPermission(false);
        }
    };

    const loadOfflineStatus = async () => {
        try {
            const offline = await offlineModeManager.getOfflineMode();
            setIsOffline(offline);
        } catch (error) {
            console.error('加载离线模式状态失败:', error);
        }
    };

    const loadUsers = async () => {
        try {
            setLoading(true);
            setError(null);

            const data: GetUsersResponse = await getUsers({});
            setUsers(data.users);
            setSingleUserMode(data.single_user_mode);
        } catch (err) {
            console.error('获取用户列表失败:', err);
            const errorMessage = err instanceof Error ? err.message : '获取用户列表失败';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadUsers();
        setRefreshing(false);
    };

    const handleAddUser = async () => {
        if (!newUsername.trim() || !newPassword.trim()) {
            Alert.alert('错误', '请输入用户名和密码');
            return;
        }

        if (isOffline) {
            Alert.alert('提示', '离线模式下无法添加用户，请先退出离线模式');
            return;
        }

        try {
            // 计算密码哈希
            const passwordHash = await hashPassword(newPassword, newUsername.trim());

            await addUser({
                username: newUsername.trim(),
                password_hash: passwordHash,
                group: newGroups,
            });

            Alert.alert('成功', '用户添加成功', [
                { text: '确定', onPress: () => {
                    setAddUserModalVisible(false);
                    setNewUsername('');
                    setNewPassword('');
                    setNewGroups(['user']);
                    loadUsers();
                }}
            ]);
        } catch (err) {
            console.error('添加用户失败:', err);
            const errorMessage = err instanceof Error ? err.message : '添加用户失败';
            Alert.alert('错误', errorMessage);
        }
    };

    const handleRemoveUser = (username: string) => {
        // 检查是否是当前用户
        const currentUsername = userInfo?.user?.username;
        if (username === currentUsername) {
            Alert.alert('错误', '无法删除自己的账户');
            return;
        }

        if (isOffline) {
            Alert.alert('提示', '离线模式下无法删除用户，请先退出离线模式');
            return;
        }

        Alert.alert(
            '确认删除',
            `确定要删除用户 "${username}" 吗？此操作不可恢复。`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '删除',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await removeUser({ username });
                            Alert.alert('成功', '用户删除成功', [
                                { text: '确定', onPress: loadUsers }
                            ]);
                        } catch (err) {
                            console.error('删除用户失败:', err);
                            const errorMessage = err instanceof Error ? err.message : '删除用户失败';
                            Alert.alert('错误', errorMessage);
                        }
                    },
                },
            ]
        );
    };

    const handleUpdateUserGroup = async () => {
        if (!editingUser) return;

        // 检查是否是当前用户
        const currentUsername = userInfo?.user?.username;
        if (editingUser.username === currentUsername) {
            Alert.alert('错误', '无法修改自己的用户组');
            return;
        }

        if (isOffline) {
            Alert.alert('提示', '离线模式下无法更新用户组，请先退出离线模式');
            return;
        }

        try {
            await updateUserGroup({
                username: editingUser.username,
                group: editGroups,
            });

            Alert.alert('成功', '用户组更新成功', [
                { text: '确定', onPress: () => {
                    setEditUserModalVisible(false);
                    setEditingUser(null);
                    setEditGroups([]);
                    loadUsers();
                }}
            ]);
        } catch (err) {
            console.error('更新用户组失败:', err);
            const errorMessage = err instanceof Error ? err.message : '更新用户组失败';
            Alert.alert('错误', errorMessage);
        }
    };

    const handleSetPassword = async () => {
        if (!passwordUser) return;

        if (!newPasswordValue.trim() || !confirmPasswordValue.trim()) {
            Alert.alert('错误', '请输入新密码和确认密码');
            return;
        }

        if (newPasswordValue !== confirmPasswordValue) {
            Alert.alert('错误', '两次输入的密码不一致');
            return;
        }

        if (isOffline) {
            Alert.alert('提示', '离线模式下无法设置密码，请先退出离线模式');
            return;
        }

        try {
            const passwordHash = await hashPassword(newPasswordValue, passwordUser.username);

            await setUserPassword({
                username: passwordUser.username,
                password_hash: passwordHash,
            });

            Alert.alert('成功', '密码设置成功', [
                { text: '确定', onPress: () => {
                    setPasswordModalVisible(false);
                    setPasswordUser(null);
                    setNewPasswordValue('');
                    setConfirmPasswordValue('');
                }}
            ]);
        } catch (err) {
            console.error('设置密码失败:', err);
            const errorMessage = err instanceof Error ? err.message : '设置密码失败';
            Alert.alert('错误', errorMessage);
        }
    };

    const openEditModal = (user: UserInfo) => {
        // 检查是否是当前用户
        const currentUsername = userInfo?.user?.username;
        if (user.username === currentUsername) {
            Alert.alert('提示', '无法编辑自己的用户组');
            return;
        }
        setEditingUser(user);
        setEditGroups([...user.group]);
        setEditUserModalVisible(true);
    };

    const openPasswordModal = (user: UserInfo) => {
        setPasswordUser(user);
        setPasswordModalVisible(true);
    };

    const addGroup = (groups: string[], setGroups: (groups: string[]) => void, input: string, setInput: (input: string) => void) => {
        const group = input.trim();
        if (group && !groups.includes(group)) {
            setGroups([...groups, group]);
            setInput('');
        }
    };

    const removeGroup = (groups: string[], setGroups: (groups: string[]) => void, group: string) => {
        setGroups(groups.filter(g => g !== group));
    };


    if (checkingPermission || loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#007AFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>用户管理</Text>
                    <View style={styles.headerRight} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>
                        {checkingPermission ? '检查权限中...' : '加载中...'}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // 如果权限检查失败，不显示内容（已经通过Alert提示并返回）
    const isAdmin = userInfo?.user?.group?.includes('admin') ?? false;
    if (!isAdmin) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#007AFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>用户管理</Text>
                    <View style={styles.headerRight} />
                </View>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>权限不足</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* 头部 */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#007AFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>用户管理</Text>
                <View style={styles.headerRight}>
                    <TouchableOpacity
                        onPress={() => setAddUserModalVisible(true)}
                        disabled={isOffline || singleUserMode}
                        style={[styles.headerButton, (isOffline || singleUserMode) && styles.headerButtonDisabled]}
                    >
                        <Ionicons name="add" size={20} color={(isOffline || singleUserMode) ? "#999999" : "#FFFFFF"} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* 错误信息 */}
            {error && (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={20} color="#EF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity onPress={loadUsers} style={styles.retryButton}>
                        <Text style={styles.retryButtonText}>重试</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* 离线模式提示 */}
            {isOffline && (
                <View style={styles.offlineContainer}>
                    <Ionicons name="airplane" size={20} color="#FF9500" />
                    <Text style={styles.offlineText}>离线模式下无法管理用户</Text>
                </View>
            )}

            {/* 单用户模式提示 */}
            {singleUserMode && (
                <View style={styles.offlineContainer}>
                    <Ionicons name="information-circle" size={20} color="#007AFF" />
                    <Text style={styles.offlineText}>当前为单用户模式，无法添加新用户</Text>
                </View>
            )}

            {/* 用户列表 */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
            >
                {users.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={48} color="#CCCCCC" />
                        <Text style={styles.emptyText}>暂无用户</Text>
                    </View>
                ) : (
                    users.map((user, index) => {
                        const currentUsername = userInfo?.user?.username;
                        const isCurrentUser = user.username === currentUsername;
                        
                        return (
                            <View key={index} style={styles.userCard}>
                                <View style={styles.userInfo}>
                                    <View style={styles.usernameContainer}>
                                        <Text style={styles.username}>{user.username}</Text>
                                        {isCurrentUser && (
                                            <View style={styles.currentUserBadge}>
                                                <Text style={styles.currentUserText}>当前用户</Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.groupsContainer}>
                                        {user.group.map((group, groupIndex) => (
                                            <View key={groupIndex} style={styles.groupTag}>
                                                <Text style={styles.groupText}>{group}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                                <View style={styles.userActions}>
                                    <TouchableOpacity
                                        onPress={() => openEditModal(user)}
                                        disabled={isOffline || isCurrentUser}
                                        style={[styles.actionButton, styles.editButton, (isOffline || isCurrentUser) && styles.actionButtonDisabled]}
                                    >
                                        <Ionicons name="create-outline" size={20} color={(isOffline || isCurrentUser) ? "#999999" : "#007AFF"} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => openPasswordModal(user)}
                                        disabled={isOffline || isCurrentUser}
                                        style={[styles.actionButton, styles.passwordButton, (isOffline || isCurrentUser) && styles.actionButtonDisabled]}
                                    >
                                        <Ionicons name="key-outline" size={20} color={(isOffline || isCurrentUser) ? "#999999" : "#FF9500"} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleRemoveUser(user.username)}
                                        disabled={isOffline || isCurrentUser}
                                        style={[styles.actionButton, styles.deleteButton, (isOffline || isCurrentUser) && styles.actionButtonDisabled]}
                                    >
                                        <Ionicons name="trash-outline" size={20} color={(isOffline || isCurrentUser) ? "#999999" : "#FF3B30"} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {/* 添加用户模态框 */}
            <Modal
                visible={addUserModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setAddUserModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>添加用户</Text>
                            <TouchableOpacity onPress={() => setAddUserModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#000000" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <View style={styles.modalField}>
                                <Text style={styles.modalFieldLabel}>用户名</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    value={newUsername}
                                    onChangeText={setNewUsername}
                                    placeholder="请输入用户名"
                                    autoCapitalize="none"
                                />
                            </View>

                            <View style={styles.modalField}>
                                <Text style={styles.modalFieldLabel}>密码</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    placeholder="请输入密码"
                                    secureTextEntry
                                />
                            </View>

                            <View style={styles.modalField}>
                                <Text style={styles.modalFieldLabel}>用户组</Text>
                                <View style={styles.groupsList}>
                                    {newGroups.map((group, index) => (
                                        <View key={index} style={styles.groupTag}>
                                            <Text style={styles.groupText}>{group}</Text>
                                            <TouchableOpacity onPress={() => removeGroup(newGroups, setNewGroups, group)}>
                                                <Ionicons name="close-circle" size={16} color="#FF3B30" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                                <View style={styles.groupInputContainer}>
                                    <TextInput
                                        style={styles.groupInput}
                                        value={newGroupInput}
                                        onChangeText={setNewGroupInput}
                                        placeholder="输入用户组名称"
                                        onSubmitEditing={() => addGroup(newGroups, setNewGroups, newGroupInput, setNewGroupInput)}
                                    />
                                    <TouchableOpacity
                                        onPress={() => addGroup(newGroups, setNewGroups, newGroupInput, setNewGroupInput)}
                                        style={styles.groupAddButton}
                                    >
                                        <Text style={styles.groupAddButtonText}>添加</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                onPress={() => setAddUserModalVisible(false)}
                                style={[styles.modalButton, styles.modalButtonCancel]}
                            >
                                <Text style={styles.modalButtonCancelText}>取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleAddUser}
                                style={[styles.modalButton, styles.modalButtonConfirm]}
                            >
                                <Text style={styles.modalButtonConfirmText}>添加</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 编辑用户组模态框 */}
            <Modal
                visible={editUserModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setEditUserModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>编辑用户组 - {editingUser?.username}</Text>
                            <TouchableOpacity onPress={() => setEditUserModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#000000" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <View style={styles.modalField}>
                                <Text style={styles.modalFieldLabel}>用户组</Text>
                                <View style={styles.groupsList}>
                                    {editGroups.map((group, index) => (
                                        <View key={index} style={styles.groupTag}>
                                            <Text style={styles.groupText}>{group}</Text>
                                            <TouchableOpacity onPress={() => removeGroup(editGroups, setEditGroups, group)}>
                                                <Ionicons name="close-circle" size={16} color="#FF3B30" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                                <View style={styles.groupInputContainer}>
                                    <TextInput
                                        style={styles.groupInput}
                                        value={editGroupInput}
                                        onChangeText={setEditGroupInput}
                                        placeholder="输入用户组名称"
                                        onSubmitEditing={() => addGroup(editGroups, setEditGroups, editGroupInput, setEditGroupInput)}
                                    />
                                    <TouchableOpacity
                                        onPress={() => addGroup(editGroups, setEditGroups, editGroupInput, setEditGroupInput)}
                                        style={styles.groupAddButton}
                                    >
                                        <Text style={styles.groupAddButtonText}>添加</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                onPress={() => setEditUserModalVisible(false)}
                                style={[styles.modalButton, styles.modalButtonCancel]}
                            >
                                <Text style={styles.modalButtonCancelText}>取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleUpdateUserGroup}
                                style={[styles.modalButton, styles.modalButtonConfirm]}
                            >
                                <Text style={styles.modalButtonConfirmText}>保存</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 修改密码模态框 */}
            <Modal
                visible={passwordModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setPasswordModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>修改密码 - {passwordUser?.username}</Text>
                            <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#000000" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <View style={styles.modalField}>
                                <Text style={styles.modalFieldLabel}>新密码</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    value={newPasswordValue}
                                    onChangeText={setNewPasswordValue}
                                    placeholder="请输入新密码"
                                    secureTextEntry
                                />
                            </View>

                            <View style={styles.modalField}>
                                <Text style={styles.modalFieldLabel}>确认密码</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    value={confirmPasswordValue}
                                    onChangeText={setConfirmPasswordValue}
                                    placeholder="请再次输入新密码"
                                    secureTextEntry
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                onPress={() => setPasswordModalVisible(false)}
                                style={[styles.modalButton, styles.modalButtonCancel]}
                            >
                                <Text style={styles.modalButtonCancelText}>取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSetPassword}
                                style={[styles.modalButton, styles.modalButtonConfirm]}
                            >
                                <Text style={styles.modalButtonConfirmText}>保存</Text>
                            </TouchableOpacity>
                        </View>
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
        gap: 8,
    },
    headerButton: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: '#007AFF',
    },
    headerButtonDisabled: {
        backgroundColor: '#CCCCCC',
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
    retryButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#DC2626',
        borderRadius: 6,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
    },
    offlineContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF3CD',
        borderColor: '#FFE69C',
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        margin: 16,
        gap: 8,
    },
    offlineText: {
        flex: 1,
        color: '#FF9500',
        fontSize: 14,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: '#999999',
    },
    userCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    userInfo: {
        flex: 1,
    },
    usernameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    username: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000000',
    },
    currentUserBadge: {
        backgroundColor: '#E3F2FD',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    currentUserText: {
        fontSize: 10,
        color: '#1976D2',
        fontWeight: '500',
    },
    groupsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    groupsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
    },
    groupTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E3F2FD',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    groupText: {
        fontSize: 12,
        color: '#1976D2',
        fontWeight: '500',
    },
    userActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        padding: 8,
        borderRadius: 6,
    },
    actionButtonDisabled: {
        opacity: 0.5,
    },
    editButton: {
        backgroundColor: '#E3F2FD',
    },
    passwordButton: {
        backgroundColor: '#FFF3E0',
    },
    deleteButton: {
        backgroundColor: '#FFEBEE',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5E5',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000000',
    },
    modalBody: {
        padding: 16,
    },
    modalField: {
        marginBottom: 20,
    },
    modalFieldLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333333',
        marginBottom: 8,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#E5E5E5',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: '#000000',
        backgroundColor: '#FFFFFF',
    },
    groupInputContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    groupInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#E5E5E5',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: '#000000',
        backgroundColor: '#FFFFFF',
    },
    groupAddButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        justifyContent: 'center',
    },
    groupAddButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
    },
    modalFooter: {
        flexDirection: 'row',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E5E5',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    modalButtonCancel: {
        backgroundColor: '#F5F5F5',
    },
    modalButtonCancelText: {
        color: '#666666',
        fontSize: 16,
        fontWeight: '500',
    },
    modalButtonConfirm: {
        backgroundColor: '#007AFF',
    },
    modalButtonConfirmText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
    },
});
