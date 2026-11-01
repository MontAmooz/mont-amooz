"use client";

// مُنت‌آموز — small shared client hooks.

import { useEffect, useRef, useState } from "react";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

interface FetchResult<T> {
  key: string;
  data: T | null;
  error: string | null;
}

/**
 * Minimal data-fetching hook with loading / error / retry.
 * - `deps` controls when to refetch (like an effect dependency array).
 * - `options.enabled === false` gates the fetch — used for lazy-loading tab content.
 * - loading/error/data are DERIVED from the settled result of the latest request key,
 *   so no synchronous setState happens inside the effect body.
 */
export function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  options?: { enabled?: boolean }
): FetchState<T> {
  const enabled = options?.enabled !== false;
  const [nonce, setNonce] = useState(0);
  // key uniquely identifies the current request (deps + retry nonce + enabled flag)
  const key = `${JSON.stringify(deps)}#${nonce}#${enabled ? "1" : "0"}`;
  const [result, setResult] = useState<FetchResult<T> | null>(null);

  // keep the latest fetcher for the effect below without adding it to deps
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetcherRef
      .current()
      .then((data) => {
        if (alive) setResult({ key, data, error: null });
      })
      .catch((err: unknown) => {
        if (alive) {
          setResult({
            key,
            data: null,
            error: err instanceof Error ? err.message : "خطای نامشخص",
          });
        }
      });
    return () => {
      alive = false;
    };
  }, [key, enabled]);

  const current = result && result.key === key ? result : null;

  return {
    data: current?.data ?? null,
    // no settled result for the current key → a request is in flight (or gated)
    loading: !current,
    error: current?.error ?? null,
    retry: () => setNonce((n) => n + 1),
    setData: (updater: React.SetStateAction<T | null>) =>
      setResult((prev) => {
        if (!prev) return prev;
        const nextData =
          typeof updater === "function"
            ? (updater as (previous: T | null) => T | null)(prev.data)
            : updater;
        return { ...prev, data: nextData };
      }),
  };
}

/** Debounce a value — used for the 300ms search-input → URL sync. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
