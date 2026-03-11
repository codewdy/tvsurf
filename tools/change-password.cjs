#!/usr/bin/env node
/**
 * 修改 tvsurf 用户密码
 * 用法: node change-password.cjs <用户名> <新密码> [数据库目录]
 */

const bcrypt = require('../app/node_modules/bcryptjs');
const fs = require('fs');
const path = require('path');

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function generateSalt(username) {
  const bcryptChars = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const hash = simpleHash(username);
  let saltPart = '';
  let currentHash = hash;
  for (let i = 0; i < 22; i++) {
    saltPart += bcryptChars[currentHash % bcryptChars.length];
    currentHash = Math.floor(currentHash / bcryptChars.length) || hash + i;
  }
  return `$2a$10$${saltPart}`;
}

async function hashPassword(password, username) {
  const salt = generateSalt(username);
  return bcrypt.hash(password, salt);
}

async function main() {
  const [username, newPassword, dbDir] = process.argv.slice(2);
  if (!username || !newPassword) {
    console.error('用法: node change-password.cjs <用户名> <新密码> [数据库目录]');
    process.exit(1);
  }

  const userDbPath = path.join(dbDir, 'user_db.json');
  if (!fs.existsSync(userDbPath)) {
    console.error(`错误: 找不到数据库文件 ${userDbPath}`);
    process.exit(1);
  }

  const userDb = JSON.parse(fs.readFileSync(userDbPath, 'utf-8'));
  if (!userDb.users || !userDb.users[username]) {
    console.error(`错误: 用户 ${username} 不存在`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(newPassword, username);
  userDb.users[username].password_hash = passwordHash;

  fs.writeFileSync(userDbPath, JSON.stringify(userDb, null, 2), 'utf-8');
  console.log(`密码已成功修改，用户: ${username}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
