import { Inject, Injectable } from "@nestjs/common";
import { API_ERROR_CODE, type AdminVerificationDto, type VerificationDocType, type VerificationDto, type VerificationFileKind } from "@kivora/shared";
import type { Pool } from "pg";
import { ApiException } from "../common/api-error.js";
import { PG_POOL } from "./finance.config.js";
import { audit, notify, one, sql, tx, type Ctx } from "./sql.js";

const COLS = `v.id, v.status, v.doc_type AS "docType", v.issuing_country AS "issuingCountry", v.rejection_reason AS "rejectionReason", v.created_at AS "createdAt"`;
const MAX_BYTES = 1_500_000;

function matchesMime(buf: Buffer, mime: string): boolean {
  if (mime === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === "image/png") return buf[0] === 0x89 && buf.subarray(1, 4).toString("ascii") === "PNG";
  return buf.subarray(0, 5).toString("ascii") === "%PDF-";
}
const invalid = (field: string, code: string): ApiException => new ApiException(API_ERROR_CODE.VALIDATION_ERROR, { fieldErrors: [{ field, code }] });

@Injectable()
export class VerificationService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async latest(userId: string): Promise<VerificationDto | null> {
    return (await one<VerificationDto>(this.pool, `SELECT ${COLS} FROM verification_submissions v WHERE v.user_id = $1 ORDER BY v.created_at DESC LIMIT 1`, [userId])) ?? null;
  }

  async submit(
    userId: string,
    input: { docType: VerificationDocType; issuingCountry: string; files: { kind: VerificationFileKind; mime: string; dataBase64: string }[] },
    requestId: string,
  ): Promise<VerificationDto> {
    const u = await one<{ verified: boolean }>(this.pool, "SELECT email_verified AS verified FROM users WHERE id = $1", [userId]);
    if (!u?.verified) throw new ApiException(API_ERROR_CODE.FORBIDDEN, { fieldErrors: [{ field: "email", code: "notVerified" }] });
    const kinds = new Set(input.files.map((f) => f.kind));
    if (kinds.size !== input.files.length) throw invalid("files", "duplicate");
    if (!kinds.has("FRONT") || !kinds.has("SELFIE")) throw invalid("files", "required");
    // Bilhete e autorização de residência têm frente e verso; só o passaporte dispensa o verso.
    if (input.docType !== "PASSPORT" && !kinds.has("BACK")) throw invalid("files", "backRequired");
    const decoded = input.files.map((f) => {
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(f.dataBase64)) throw invalid("files", "invalidFile");
      const content = Buffer.from(f.dataBase64, "base64");
      if (content.length < 100 || content.length > MAX_BYTES) throw invalid("files", "fileSize");
      if (!matchesMime(content, f.mime)) throw invalid("files", "invalidFile");
      return { kind: f.kind, mime: f.mime, content };
    });
    const id = await tx(this.pool, async (c) => {
      const state = await sql<{ status: string }>(c, "SELECT status FROM verification_submissions WHERE user_id = $1 AND status IN ('PENDING', 'APPROVED') FOR UPDATE", [userId]);
      if (state.length > 0) throw new ApiException(API_ERROR_CODE.CONFLICT);
      const row = await one<{ id: string }>(c, "INSERT INTO verification_submissions (user_id, doc_type, issuing_country) VALUES ($1, $2, $3) RETURNING id", [userId, input.docType, input.issuingCountry]);
      if (!row) throw new ApiException(API_ERROR_CODE.INTERNAL_ERROR);
      for (const f of decoded) {
        await sql(c, "INSERT INTO verification_files (submission_id, kind, mime, size_bytes, content) VALUES ($1, $2, $3, $4, $5)", [row.id, f.kind, f.mime, f.content.length, f.content]);
      }
      await audit(c, { action: "verification.submit", actorId: userId, requestId, metadata: { submissionId: row.id } });
      return row.id;
    });
    const out = await one<VerificationDto>(this.pool, `SELECT ${COLS} FROM verification_submissions v WHERE v.id = $1`, [id]);
    if (!out) throw new ApiException(API_ERROR_CODE.INTERNAL_ERROR);
    return out;
  }

  /* ---------- Administração ---------- */

  adminList(status: string | null, id: string | null = null): Promise<AdminVerificationDto[]> {
    return sql<AdminVerificationDto>(
      this.pool,
      `SELECT ${COLS}, u.id AS "userId", u.email AS "userEmail", u.full_name AS "userName",
              ARRAY(SELECT f.kind FROM verification_files f WHERE f.submission_id = v.id ORDER BY f.kind) AS files
         FROM verification_submissions v JOIN users u ON u.id = v.user_id
        WHERE ($1::text IS NULL OR v.status = $1) AND ($2::uuid IS NULL OR v.id = $2) ORDER BY v.created_at DESC LIMIT 200`,
      [status, id],
    );
  }

  async adminFile(id: string, kind: string): Promise<{ mime: string; content: Buffer }> {
    const f = await one<{ mime: string; content: Buffer }>(this.pool, "SELECT mime, content FROM verification_files WHERE submission_id = $1 AND kind = $2", [id, kind]);
    if (!f) throw new ApiException(API_ERROR_CODE.NOT_FOUND);
    return f;
  }

  async adminDecide(ctx: Ctx, id: string, action: "approve" | "reject", note: string): Promise<AdminVerificationDto> {
    await tx(this.pool, async (c) => {
      const v = await one<{ userId: string; status: string }>(c, `SELECT user_id AS "userId", status FROM verification_submissions WHERE id = $1 FOR UPDATE`, [id]);
      if (!v) throw new ApiException(API_ERROR_CODE.NOT_FOUND);
      if (v.status !== "PENDING") throw new ApiException(API_ERROR_CODE.INVALID_STATE_TRANSITION);
      if (v.userId === ctx.actorId) throw new ApiException(API_ERROR_CODE.FORBIDDEN);
      const approve = action === "approve";
      await sql(c, `UPDATE verification_submissions SET status = $2, rejection_reason = $3, decided_by = $4, decided_at = now() WHERE id = $1`, [id, approve ? "APPROVED" : "REJECTED", approve ? "" : note, ctx.actorId]);
      await notify(c, v.userId, approve ? "VERIFICATION_APPROVED" : "VERIFICATION_REJECTED");
      await audit(c, { action: `admin.verification.${action}`, actorId: ctx.actorId, requestId: ctx.requestId, metadata: { submissionId: id } });
    });
    const out = (await this.adminList(null, id))[0];
    if (!out) throw new ApiException(API_ERROR_CODE.NOT_FOUND);
    return out;
  }
}
