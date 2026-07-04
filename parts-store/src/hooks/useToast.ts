"use client";

import { useCallback, useRef, useState } from "react";

/** Single transient toast message with auto-dismiss (default 2200ms). */
export function useToast(timeout = 2200) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (msg: string) => {
      setMessage(msg);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), timeout);
    },
    [timeout],
  );

  return { message, show };
}
