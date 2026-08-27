// 録音データの端末内保存（IndexedDB）。
// サーバーには送らないため追加費用はかからず、会議音声が外に出ることもない。
//
// 録音中は timeslice ごとのチャンクを逐次書き込む。
// これにより、途中でブラウザが落ちてもそこまでの音声が残る。

export interface RecordingMeta {
  id: string;
  startedAt: string;
  durationMs: number;
  mimeType: string;
  sizeBytes: number;
  /** 同時に取得した文字起こし（プレーンテキスト） */
  transcript: string;
  meetingType: string;
  respondentId: string;
}

const DB_NAME = 'meeting-ai-recordings';
const DB_VERSION = 1;
const STORE_META = 'meta';
const STORE_CHUNKS = 'chunks';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('このブラウザは録音の保存に対応していません'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        // [録音ID, 連番] の複合キーで、チャンクを順序どおりに取り出せるようにする
        db.createObjectStore(STORE_CHUNKS, { keyPath: ['recordingId', 'seq'] });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB を開けませんでした'));
  });
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 操作に失敗しました'));
  });
}

export async function appendChunk(recordingId: string, seq: number, blob: Blob): Promise<void> {
  const db = await openDB();
  try {
    const tx = db.transaction(STORE_CHUNKS, 'readwrite');
    await promisify(tx.objectStore(STORE_CHUNKS).put({ recordingId, seq, blob }));
  } finally {
    db.close();
  }
}

export async function saveMeta(meta: RecordingMeta): Promise<void> {
  const db = await openDB();
  try {
    const tx = db.transaction(STORE_META, 'readwrite');
    await promisify(tx.objectStore(STORE_META).put(meta));
  } finally {
    db.close();
  }
}

export async function listRecordings(): Promise<RecordingMeta[]> {
  const db = await openDB();
  try {
    const tx = db.transaction(STORE_META, 'readonly');
    const all = await promisify(tx.objectStore(STORE_META).getAll() as IDBRequest<RecordingMeta[]>);
    // 新しい順
    return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  } finally {
    db.close();
  }
}

/** チャンクを連結して1つの音声Blobに戻す */
export async function getRecordingBlob(id: string, mimeType: string): Promise<Blob> {
  const db = await openDB();
  try {
    const tx = db.transaction(STORE_CHUNKS, 'readonly');
    const store = tx.objectStore(STORE_CHUNKS);
    const range = IDBKeyRange.bound([id, -Infinity], [id, Infinity]);
    const rows = await promisify(
      store.getAll(range) as IDBRequest<{ recordingId: string; seq: number; blob: Blob }[]>,
    );
    rows.sort((a, b) => a.seq - b.seq);
    return new Blob(rows.map((r) => r.blob), { type: mimeType });
  } finally {
    db.close();
  }
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await openDB();
  try {
    const tx = db.transaction([STORE_META, STORE_CHUNKS], 'readwrite');
    tx.objectStore(STORE_META).delete(id);
    const store = tx.objectStore(STORE_CHUNKS);
    const range = IDBKeyRange.bound([id, -Infinity], [id, Infinity]);
    const keys = await promisify(store.getAllKeys(range));
    for (const key of keys) store.delete(key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('削除に失敗しました'));
    });
  } finally {
    db.close();
  }
}

/** 端末の空き容量の目安（対応ブラウザのみ） */
export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  if (usage === undefined || quota === undefined) return null;
  return { usage, quota };
}
