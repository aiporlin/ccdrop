// 加密服务模块
import * as CryptoJS from 'crypto-js';

/**
 * 生成房间ID（与generateShortId类似，但作为独立服务提供）
 * @returns 5位随机字符串ID
 */
export const generateRoomId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 5; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

/**
 * 生成加密密钥
 * @returns 随机生成的加密密钥
 */
export const generateKey = (): string => {
  return CryptoJS.lib.WordArray.random(256/8).toString();
};

/**
 * 加密文本
 * @param text 要加密的文本
 * @param password 密码
 * @returns 加密后的文本
 */
export const encryptText = (text: string, password: string): string => {
  return CryptoJS.AES.encrypt(text, password).toString();
};

/**
 * 解密文本
 * @param encryptedText 加密的文本
 * @param password 密码
 * @returns 解密后的文本
 */
export const decryptText = (encryptedText: string, password: string): string | null => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, password);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText || null;
  } catch (error) {
    console.error('解密失败:', error);
    return null;
  }
};