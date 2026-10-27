import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Os testes existentes verificam o comportamento real (sem ecrãs de exemplo).
vi.stubEnv("VITE_DEMO_UI", "false");

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
