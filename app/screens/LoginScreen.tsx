import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { login, setApiBaseUrl, setApiToken } from '../api/client-proxy';
import { hashPassword } from '../utils/password';

interface LoginScreenProps {
    onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
    const [baseUrl, setBaseUrl] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 验证用户名格式：只允许字母、数字、下划线和减号
    const isValidUsername = (username: string): boolean => {
        const usernameRegex = /^[a-zA-Z0-9_-]+$/;
        return usernameRegex.test(username);
    };

    // 验证 URL 格式
    const isValidUrl = (url: string): boolean => {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    };

    // 规范化 URL（确保以 / 结尾）
    const normalizeUrl = (url: string): string => {
        let normalized = url.trim();
        if (!normalized) return '';
        // 如果没有协议，添加 https://
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
            normalized = 'https://' + normalized;
        }
        // 移除末尾的斜杠（除了根路径）
        normalized = normalized.replace(/\/+$/, '');
        if (normalized === 'http://' || normalized === 'https://') {
            return normalized;
        }
        return normalized;
    };

    const handleLogin = async () => {
        setError(null);

        // 验证输入
        if (!baseUrl.trim()) {
            setError('请输入服务器地址');
            return;
        }

        const normalizedUrl = normalizeUrl(baseUrl);
        if (!isValidUrl(normalizedUrl)) {
            setError('请输入有效的服务器地址（例如：https://example.com）');
            return;
        }

        if (!username.trim()) {
            setError('请输入用户名');
            return;
        }

        if (!isValidUsername(username)) {
            setError('用户名只能包含字母、数字、下划线和减号');
            return;
        }

        if (!password) {
            setError('请输入密码');
            return;
        }

        setLoading(true);

        try {
            // 在前端使用 bcrypt 加密密码（salt 中包含 username）
            const passwordHash = await hashPassword(password, username);

            // 调用登录 API
            const response = await login(normalizedUrl, {
                username: username.trim(),
                password_hash: passwordHash,
            });

            // 保存 API 基础 URL 和 token
            await setApiBaseUrl(normalizedUrl);
            await setApiToken(response.token);

            // 登录成功，跳转到主页面
            onLoginSuccess();
        } catch (err) {
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : '登录时发生错误';

            // 如果是 401 错误，显示特定的错误消息
            if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
                setError('用户名或密码错误');
            } else {
                setError(`登录失败: ${errorMessage}`);
            }
            console.error('Login error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.formContainer}>
                    <Text style={styles.title}>用户登录</Text>
                    <Text style={styles.subtitle}>请输入服务器地址、用户名和密码</Text>

                    {error && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>服务器地址</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="https://example.com"
                            placeholderTextColor="#999"
                            value={baseUrl}
                            onChangeText={setBaseUrl}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                            editable={!loading}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>用户名</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="请输入用户名"
                            placeholderTextColor="#999"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!loading}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>密码</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="请输入密码"
                            placeholderTextColor="#999"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!loading}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>登录</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    formContainer: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 24,
    },
    errorContainer: {
        backgroundColor: '#fee',
        borderColor: '#fcc',
        borderWidth: 1,
        borderRadius: 6,
        padding: 12,
        marginBottom: 16,
    },
    errorText: {
        color: '#c33',
        fontSize: 14,
    },
    inputContainer: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 6,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
        color: '#333',
    },
    button: {
        backgroundColor: '#007AFF',
        borderRadius: 6,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
