import bcrypt from "bcryptjs";

/**
 * 简单的字符串哈希函数，用于生成确定性的值
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为 32 位整数
  }
  return Math.abs(hash);
}

/**
 * 生成包含 username 的 salt
 * bcrypt 盐值格式：$2a$10$ + 22个base64字符（A-Z, a-z, 0-9, ., /）
 * 我们基于 username 生成唯一的 salt，确保每个用户的 salt 都不同
 */
function generateSalt(username: string): string {
  // bcrypt 支持的字符集
  const bcryptChars = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  // 使用 username 生成一个确定性的哈希值
  const hash = simpleHash(username);

  // 生成 22 个字符的 salt 部分
  let saltPart = "";
  let currentHash = hash;
  for (let i = 0; i < 22; i++) {
    saltPart += bcryptChars[currentHash % bcryptChars.length];
    currentHash = Math.floor(currentHash / bcryptChars.length) || hash + i; // 如果为0，使用 hash + i
  }

  // bcrypt 盐值格式：$2a$10$ + 22个字符
  return `$2a$10$${saltPart}`;
}

/**
 * 使用 bcrypt 哈希密码
 * @param password 明文密码
 * @param username 用户名（用于生成唯一的 salt）
 * @returns 密码哈希值
 */
export async function hashPassword(password: string, username: string): Promise<string> {
  const salt = generateSalt(username);
  return await bcrypt.hash(password, salt);
}
