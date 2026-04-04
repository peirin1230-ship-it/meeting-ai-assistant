import { SESSION_CODE_LENGTH } from './constants';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字(0,O,1,I)を除外

export function generateSessionCode(): string {
  let code = '';
  for (let i = 0; i < SESSION_CODE_LENGTH; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export function sessionKey(code: string): string {
  return `session:${code.toUpperCase()}`;
}
