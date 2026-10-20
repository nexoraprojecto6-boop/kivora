import { afterEach, describe, expect, test, vi } from "vitest";
import { ApiError, authApi } from "./api-client";

function mockFetch(response: Response | Error) {
  const fn = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("cliente da API", () => {
  test("login envia cookies, JSON e devolve o utilizador", async () => {
    const user = { id: "1", email: "a@b.co", fullName: "Ana", countryOfResidence: "AO", status: "active", emailVerified: false };
    const fetchFn = mockFetch(json(200, { data: { user } }));
    const result = await authApi.login({ email: "a@b.co", password: "x" });
    expect(result).toEqual(user);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/v1\/auth\/login$/);
    expect(init.credentials).toBe("include");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ email: "a@b.co", password: "x" });
  });

  test("erro da API vira ApiError com código, estado e erros por campo", async () => {
    mockFetch(
      json(400, {
        error: { code: "VALIDATION_ERROR", message: "Invalid request.", requestId: "req-12345678", fieldErrors: [{ field: "email", code: "invalidEmail" }] },
      }),
    );
    const error = await authApi.login({ email: "x", password: "y" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const e = error as ApiError;
    expect(e.code).toBe("VALIDATION_ERROR");
    expect(e.status).toBe(400);
    expect(e.fieldErrors).toEqual([{ field: "email", code: "invalidEmail" }]);
    expect(e.requestId).toBe("req-12345678");
  });

  test("falha de rede vira ApiError NETWORK", async () => {
    mockFetch(new TypeError("Failed to fetch"));
    const error = (await authApi.me().catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe("NETWORK");
    expect(error.status).toBe(0);
  });

  test("resposta de erro sem corpo JSON não rebenta", async () => {
    mockFetch(new Response("<html>bad gateway</html>", { status: 502 }));
    const error = (await authApi.me().catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.status).toBe(502);
  });

  test("logout chama POST /auth/logout", async () => {
    const fetchFn = mockFetch(json(200, { data: { loggedOut: true } }));
    await authApi.logout();
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/v1\/auth\/logout$/);
    expect(init.method).toBe("POST");
  });
});
