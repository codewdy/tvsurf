/**
 * 验证用户名是否只包含字母、数字、下划线和减号
 * @param username 用户名
 * @returns 如果用户名只包含允许的字符则返回 true，否则返回 false
 */
export function isValidUsername(username: string): boolean {
  // 只允许字母（大小写）、数字、下划线(_)和减号(-)
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  return usernameRegex.test(username);
}
