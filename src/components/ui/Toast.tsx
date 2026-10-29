import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type Kind = "success" | "error";
interface Item { id: number; kind: Kind; text: string }
interface ToastApi { success: (t: string) => void; error: (t: string) => void }

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const n = useRef(0);
  const push = useCallback((kind: Kind, text: string) => {
    const id = ++n.current;
    setItems((cur) => [...cur, { id, kind, text }]);
    window.setTimeout(() => setItems((cur) => cur.filter((i) => i.id !== id)), kind === "error" ? 8000 : 4000);
  }, []);
  const api = useMemo<ToastApi>(() => ({ success: (t) => push("success", t), error: (t) => push("error", t) }), [push]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`toast toast--${i.kind}`} role={i.kind === "error" ? "alert" : "status"}>
            {i.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast fora de ToastProvider");
  return v;
}
