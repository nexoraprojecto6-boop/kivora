import { Inject, Injectable } from "@nestjs/common";
import { API_ERROR_CODE, type AgreementDto } from "@kivora/shared";
import type { Pool } from "pg";
import { ApiException } from "../common/api-error.js";
import { PG_POOL } from "./finance.config.js";
import { audit, one, sql, tx, type Ctx } from "./sql.js";

@Injectable()
export class AgreementsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Última versão de cada acordo, com a data de aceitação do utilizador (ou null). */
  list(userId: string): Promise<AgreementDto[]> {
    return sql<AgreementDto>(
      this.pool,
      `SELECT DISTINCT ON (v.code) v.id AS "versionId", v.code, v.version, v.title, v.body, v.published_at AS "publishedAt", a.accepted_at AS "acceptedAt"
         FROM agreement_versions v LEFT JOIN agreement_acceptances a ON a.version_id = v.id AND a.user_id = $1
        ORDER BY v.code, v.version DESC`,
      [userId],
    );
  }

  async accept(userId: string, versionId: string, requestId: string): Promise<AgreementDto[]> {
    const v = await one<{ code: string; version: number; latest: number }>(
      this.pool,
      `SELECT v.code, v.version, (SELECT MAX(version) FROM agreement_versions x WHERE x.code = v.code) AS latest FROM agreement_versions v WHERE v.id = $1`,
      [versionId],
    );
    if (!v) throw new ApiException(API_ERROR_CODE.NOT_FOUND);
    if (v.version !== v.latest) throw new ApiException(API_ERROR_CODE.INVALID_STATE_TRANSITION);
    await sql(this.pool, "INSERT INTO agreement_acceptances (user_id, version_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [userId, versionId]);
    await audit(this.pool, { action: "agreement.accept", actorId: userId, requestId, metadata: { code: v.code, version: v.version } });
    return this.list(userId);
  }

  adminList(): Promise<(Omit<AgreementDto, "acceptedAt"> & { acceptances: number })[]> {
    return sql<Omit<AgreementDto, "acceptedAt"> & { acceptances: number }>(
      this.pool,
      `SELECT v.id AS "versionId", v.code, v.version, v.title, v.body, v.published_at AS "publishedAt",
              (SELECT count(*)::int FROM agreement_acceptances a WHERE a.version_id = v.id) AS acceptances
         FROM agreement_versions v ORDER BY v.code, v.version DESC`,
    );
  }

  /** Publica uma nova versão (as anteriores ficam guardadas; quem aceitou a antiga tem de aceitar a nova). */
  async publish(ctx: Ctx, input: { code: string; title: string; body: string }): Promise<{ versionId: string; version: number }> {
    return tx(this.pool, async (c) => {
      await sql(c, "SELECT pg_advisory_xact_lock(hashtextextended($1, 1))", [input.code]);
      const row = await one<{ id: string; version: number }>(
        c,
        `INSERT INTO agreement_versions (code, version, title, body, published_by)
         VALUES ($1, COALESCE((SELECT MAX(version) FROM agreement_versions WHERE code = $1), 0) + 1, $2, $3, $4) RETURNING id, version`,
        [input.code, input.title, input.body, ctx.actorId],
      );
      if (!row) throw new ApiException(API_ERROR_CODE.INTERNAL_ERROR);
      await audit(c, { action: "admin.agreement.publish", actorId: ctx.actorId, requestId: ctx.requestId, metadata: { code: input.code, version: row.version } });
      return { versionId: row.id, version: row.version };
    });
  }
}
