// ブラウザ環境の判定と、音声認識が使えない理由の診断ユーティリティ。
// スマホ（特にiOS Safari / アプリ内ブラウザ）では「録音できない」原因が
// 複数あるため、ユーザーに具体的な対処法を提示できるようにする。

// ---------------------------------------------------------------------------
// Web Speech API の型定義（ブラウザネイティブのため自前で定義する）
// ---------------------------------------------------------------------------

export interface SpeechRecognitionResultEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

export type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

export function getSpeechRecognitionConstructor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ---------------------------------------------------------------------------
// 端末・ブラウザ判定
// ---------------------------------------------------------------------------

function userAgent(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}

export function isIOS(): boolean {
  const ua = userAgent();
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ はデスクトップ版Safariを名乗るため、タッチ対応で判定する
  return (
    /Macintosh/.test(ua) &&
    typeof navigator !== 'undefined' &&
    navigator.maxTouchPoints > 1
  );
}

export function isAndroid(): boolean {
  return /Android/.test(userAgent());
}

export function isMobile(): boolean {
  return isIOS() || isAndroid();
}

// アプリ内ブラウザ（WebView）はマイク／音声認識が使えないことが多い
const IN_APP_BROWSERS: { pattern: RegExp; name: string }[] = [
  { pattern: /\bLine\//i, name: 'LINE' },
  { pattern: /FBAN|FBAV|FB_IAB/i, name: 'Facebook' },
  { pattern: /Instagram/i, name: 'Instagram' },
  { pattern: /Twitter/i, name: 'X (Twitter)' },
  { pattern: /KAKAOTALK/i, name: 'KakaoTalk' },
  { pattern: /MicroMessenger/i, name: 'WeChat' },
  { pattern: /\bSlack\b/i, name: 'Slack' },
];

export function getInAppBrowserName(): string | null {
  const ua = userAgent();
  for (const { pattern, name } of IN_APP_BROWSERS) {
    if (pattern.test(ua)) return name;
  }
  return null;
}

// iOS上のSafari以外のブラウザ（Chrome/Firefox/Edge for iOS など）
export function isIOSNonSafari(): boolean {
  return isIOS() && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent());
}

/** MediaRecorder による録音が使えるか */
export function isRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

// ---------------------------------------------------------------------------
// 「音声認識が使えない理由」の判定
// ---------------------------------------------------------------------------

/**
 * 音声認識が利用できない場合、その理由と対処法を日本語で返す。
 * 利用できる場合は null を返す。
 */
export function getUnsupportedReason(): string | null {
  if (typeof window === 'undefined') return null;

  // マイクはセキュアコンテキスト（HTTPS / localhost）でのみ使用できる
  if (window.isSecureContext === false) {
    return 'マイクを使うにはHTTPS接続が必要です。https:// で始まるURLでこのページを開き直してください。';
  }

  if (getSpeechRecognitionConstructor()) return null;

  const inApp = getInAppBrowserName();
  if (inApp) {
    const browser = isIOS() ? 'Safari' : 'Chrome';
    return `${inApp}のアプリ内ブラウザでは音声認識を利用できません。画面のメニューから「${browser}で開く」を選んでからお試しください。`;
  }
  if (isIOSNonSafari()) {
    return 'iPhone / iPad では音声認識に対応しているのは Safari のみです。このページを Safari で開き直してください。';
  }
  if (isIOS()) {
    return 'このiOSでは音声認識に対応していません。iOS 14.5以上の Safari でお試しください。';
  }
  if (isAndroid()) {
    return 'このブラウザは音声認識に対応していません。Android では Google Chrome をお使いください。';
  }
  return 'お使いのブラウザは音声認識(Web Speech API)に対応していません。Chrome または Safari をお使いください。';
}

// ---------------------------------------------------------------------------
// マイクの状態診断
// ---------------------------------------------------------------------------

/**
 * getUserMedia でマイクを一瞬だけ取得し、失敗理由から対処法を組み立てる。
 * 権限確認が目的なので、取得したトラックは即座に停止する
 * （保持し続けると音声認識側がマイクを取得できなくなるため）。
 * 問題がなければ null を返す。
 */
export async function diagnoseMicrophone(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return 'このブラウザではマイクを利用できません。HTTPS接続であること、対応ブラウザ（Chrome / Safari）であることを確認してください。';
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return null;
  } catch (e) {
    const name = e instanceof DOMException ? e.name : '';

    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return isIOS()
        ? 'マイクの使用が許可されていません。iPhoneの「設定 > Safari > マイク」を「確認」または「許可」に変更し、ページを再読み込みしてください。'
        : 'マイクの使用が許可されていません。アドレスバーの鍵アイコン（サイト設定）からマイクを「許可」にして、ページを再読み込みしてください。';
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      return 'マイクが見つかりませんでした。端末のマイクが有効になっているか確認してください。';
    }
    if (name === 'NotReadableError' || name === 'AbortError') {
      return '他のアプリがマイクを使用している可能性があります。通話・録音・会議アプリを終了してから、もう一度お試しください。';
    }
    return 'マイクにアクセスできませんでした。ブラウザのマイク設定を確認してください。';
  }
}
