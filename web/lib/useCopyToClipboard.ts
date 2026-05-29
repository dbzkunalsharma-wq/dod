"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copy text to the clipboard with a transient "copied" flag (reverts after
 * `resetMs`). Falls back to a hidden <textarea> + execCommand when the async
 * Clipboard API is unavailable (older browsers / non-secure contexts).
 */
export function useCopyToClipboard(resetMs = 1800): {
  copied: boolean;
  copy: (text: string) => Promise<boolean>;
} {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const flag = useCallback(
    (ok: boolean) => {
      if (!ok) return;
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), resetMs);
    },
    [resetMs]
  );

  const copy = useCallback(
    async (text: string) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          flag(true);
          return true;
        }
      } catch {
        /* fall through to legacy path */
      }
      // Legacy fallback.
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        flag(ok);
        return ok;
      } catch {
        return false;
      }
    },
    [flag]
  );

  return { copied, copy };
}
