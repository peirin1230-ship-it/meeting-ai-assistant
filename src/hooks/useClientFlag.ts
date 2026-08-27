'use client';

import { useSyncExternalStore } from 'react';

const subscribeNever = () => () => {};
const serverFalse = () => false;

/**
 * ブラウザAPIの有無など、サーバーでは判定できない真偽値をhydration安全に読む。
 *
 * レンダー中に直接 `typeof MediaRecorder !== 'undefined'` などを評価すると、
 * サーバー(false)とクライアント(true)で結果が食い違い hydration mismatch になる。
 * useSyncExternalStore はhydration時にサーバー側の値を使い、その後クライアント値へ
 * 切り替えるため、この食い違いが起きない。
 *
 * @param getFlag モジュールレベルで定義した安定した関数を渡すこと
 */
export function useClientFlag(getFlag: () => boolean): boolean {
  return useSyncExternalStore(subscribeNever, getFlag, serverFalse);
}
