import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api.js";

export interface AsyncState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
  setData: (v: T | null) => void;
}

/** Carrega dados ao montar e sempre que `deps` mudar. `reload()` repete o pedido. */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    load()
      .then((v) => {
        if (seq.current === mine) setData(v);
      })
      .catch((e: unknown) => {
        if (seq.current === mine) setError(e instanceof ApiError ? e : new ApiError("INTERNAL_ERROR", 0));
      })
      .finally(() => {
        if (seq.current === mine) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}
