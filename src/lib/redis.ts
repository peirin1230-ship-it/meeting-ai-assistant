import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;

/**
 * Upstash Redis クライアント（クロスデバイス同期用）。
 * 環境変数が未設定のまま使うと Upstash 側で分かりにくいエラーになるため、
 * ここで明示的に落とす。
 */
export function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        'UPSTASH_REDIS_REST_URL と UPSTASH_REDIS_REST_TOKEN が設定されていません。クロスデバイス同期を使うには環境変数の設定が必要です。',
      );
    }

    _redis = new Redis({ url, token });
  }
  return _redis;
}
