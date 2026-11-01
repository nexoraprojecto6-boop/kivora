import { useEffect, useRef, useState } from "react";

function canAnimate(): boolean {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return false;
  return !(typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

/** Número que sobe de 0 até ao valor quando aparece no ecrã. Sem animação com "reduzir movimento" ou sem IntersectionObserver. */
export function CountUp({ to, duration = 1600 }: { to: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  // Começa em 0 só se a animação vai mesmo correr; senão mostra logo o valor final (sem piscar).
  const [value, setValue] = useState(() => (canAnimate() ? 0 : to));

  useEffect(() => {
    const el = ref.current;
    if (!el || !canAnimate()) return;
    let raf = 0;
    const run = () => {
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        run();
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);

  return <span ref={ref}>{value}</span>;
}
