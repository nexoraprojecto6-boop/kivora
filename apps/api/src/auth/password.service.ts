import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

export interface ScryptParams {
  /** Custo de CPU/memória (potência de 2). */
  N: number;
  r: number;
  p: number;
}

/** Parâmetros fortes (recomendação OWASP para scrypt: N=2^17, r=8, p=1). */
export const STRONG_SCRYPT_PARAMS: ScryptParams = { N: 131072, r: 8, p: 1 };
/** Parâmetros baratos, SÓ para testes automáticos. Nunca usar fora de NODE_ENV=test. */
export const TEST_SCRYPT_PARAMS: ScryptParams = { N: 1024, r: 8, p: 1 };

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const FORMAT = "scrypt";

function derive(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  const options: ScryptOptions = {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: 256 * 1024 * 1024,
  };
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/**
 * Hash de palavras-passe com scrypt (módulo nativo do Node, sem dependências).
 * Formato guardado: scrypt$N$r$p$salt(base64)$hash(base64). Os parâmetros ficam no
 * próprio valor, o que permite aumentar o custo no futuro sem perder hashes antigos.
 */
export class PasswordHasher {
  constructor(private readonly params: ScryptParams) {}

  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const key = await derive(password, salt, this.params);
    const { N, r, p } = this.params;
    return [FORMAT, N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
  }

  /** Nunca lança por formato inválido: devolve false. */
  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== FORMAT) return false;
    const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string];
    const params: ScryptParams = { N: Number(n), r: Number(r), p: Number(p) };
    if (![params.N, params.r, params.p].every((v) => Number.isInteger(v) && v > 0)) return false;
    try {
      const expected = Buffer.from(hashB64, "base64");
      if (expected.length !== KEY_LENGTH) return false;
      const actual = await derive(password, Buffer.from(saltB64, "base64"), params);
      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}
