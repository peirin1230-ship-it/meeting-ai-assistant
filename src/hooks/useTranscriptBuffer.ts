'use client';

import { useCallback, useRef, useState } from 'react';
import type { TranscriptSegment } from '@/types';
import { BUFFER_SEND_INTERVAL_MS, BUFFER_SEND_CHAR_THRESHOLD } from '@/lib/constants';

interface UseTranscriptBufferReturn {
  segments: TranscriptSegment[];
  pendingText: string;
  addFinalText: (text: string) => void;
  shouldSend: () => boolean;
  flush: () => string;
  reset: () => void;
  totalChars: number;
}

let segmentCounter = 0;

export function useTranscriptBuffer(): UseTranscriptBufferReturn {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const pendingTextRef = useRef('');
  const lastSendTimeRef = useRef(Date.now());
  const [totalChars, setTotalChars] = useState(0);

  const addFinalText = useCallback((text: string) => {
    if (!text.trim()) return;

    const segment: TranscriptSegment = {
      id: `seg-${++segmentCounter}`,
      text: text.trim(),
      timestamp: new Date(),
      isFinal: true,
    };

    setSegments((prev) => [...prev, segment]);
    pendingTextRef.current += text.trim() + ' ';
    setTotalChars((prev) => prev + text.trim().length);
  }, []);

  const shouldSend = useCallback(() => {
    const elapsed = Date.now() - lastSendTimeRef.current;
    const charCount = pendingTextRef.current.length;

    return (
      charCount > 0 &&
      (elapsed >= BUFFER_SEND_INTERVAL_MS || charCount >= BUFFER_SEND_CHAR_THRESHOLD)
    );
  }, []);

  const flush = useCallback(() => {
    const text = pendingTextRef.current.trim();
    pendingTextRef.current = '';
    lastSendTimeRef.current = Date.now();
    return text;
  }, []);

  const reset = useCallback(() => {
    setSegments([]);
    pendingTextRef.current = '';
    lastSendTimeRef.current = Date.now();
    setTotalChars(0);
    segmentCounter = 0;
  }, []);

  return {
    segments,
    pendingText: pendingTextRef.current,
    addFinalText,
    shouldSend,
    flush,
    reset,
    totalChars,
  };
}
