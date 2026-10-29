import { Inject, Injectable } from "@nestjs/common";
import { API_ERROR_CODE, type AdminSummaryDto, type AdminUserDetailDto, type AdminUserDto, type AuditEventDto } from "@kivora/shared";
import type { Pool } from "pg";
import { ApiException } from "../common/api-error.js";
import { PG_POOL } from "./finance.config.js";
import { audit, getBalance, one, sql, tx, type Ctx } from "./sql.js";

const USER_COLS = `u.id, u.email, u.full_name AS "fullName", u.country_of_residence AS "countryOfResidence", u.status, u.role, u.created_at AS "createdAt",
  COALESCE((SELECT v.status FROM verification_submissions v WHERE v.user_id = u.id ORDER BY (v.status = 'APPROVED') DESC, v.created_at DESC LIMIT 1), 'NONE') AS "verificationStatus"`;

@Injectable()
export class AdminService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async summary(): Promise<AdminSummaryDto> {
    const r = await one<AdminSummaryDto>(
      this.pool,
      `SELECT (SELECT count(*)::int FROM users) AS users,
              (SELECT count(*)::int FROM deposits WHERE status = 'PENDING') AS "pendingDeposits",
              (SELECT count(*)::int FROM withdrawals WHERE status = 'PENDING') AS "pendingWithdrawals",
              (SELECT count(*)::int FROM withdrawals WHERE status = 'APPROVED') AS "approvedWithdrawals",
              (SELECT count(*)::int FROM plan_subscriptions WHERE status = 'PENDING') AS "pendingSubscriptions",
              (SELECT count(*)::int FROM verification_submissions WHERE status = 'PENDING') AS "pendingVerifications",
              (SELECT count(*)::int FROM support_tickets WHERE status = 'OPEN') AS "openTickets"`,
    );
    if (!r) throw new ApiException(API_ERROR_CODE.INTERNAL_ERROR);
    return r;
  }

  users(q: string | null, limit: number): Promise<AdminUserDto[]> {
    return sql<AdminUserDto>(
      this.pool,
      `SELECT ${USER_COLS} FROM users u WHERE ($1::text IS NULL OR u.email ILIKE $1 OR u.full_name ILIKE $1) ORDER BY u.created_at DESC LIMIT $2`,
      [q ? `%${q.replace(/[\\%_]/g, "\\$&")}%` : null, limit],
    );
  }

  async user(id: string): Promise<AdminUserDetailDto> {
    const u = await one<AdminUserDto>(this.pool, `SELECT ${USER_COLS} FROM users u WHERE u.id = $1`, [id]);
    if (!u) throw new ApiException(API_ERROR_CODE.NOT_FOUND);
    const b = await getBalance(this.pool, id);
    const n = await one<{ deposits: number; withdrawals: number; subscriptions: number }>(
      this.pool,
      `SELECT (SELECT count(*)::int FROM deposits WHERE user_id = $1) AS deposits,
              (SELECT count(*)::int FROM withdrawals WHERE user_id = $1) AS withdrawals,
              (SELECT count(*)::int FROM plan_subscriptions WHERE user_id = $1) AS subscriptions`,
      [id],
    );
    return { ...u, available: b.available, reserved: b.reserved, deposits: n?.deposits ?? 0, withdrawals: n?.withdrawals ?? 0, subscriptions: n?.subscriptions ?? 0 };
  }

  /** O estado da conta muda aqui; funções (role) só se atribuem fora da aplicação, de propósito. */
  async setStatus(ctx: Ctx, id: string, status: "ACTIVE" | "LIMITED" | "SUSPENDED"): Promise<AdminUserDetailDto> {
    if (id === ctx.actorId) throw new ApiException(API_ERROR_CODE.FORBIDDEN);
    await tx(this.pool, async (c) => {
      const rows = await sql(c, "UPDATE users SET status = $2, updated_at = now() WHERE id = $1 RETURNING id", [id, status]);
      if (rows.length === 0) throw new ApiException(API_ERROR_CODE.NOT_FOUND);
      if (status === "SUSPENDED") await sql(c, "DELETE FROM sessions WHERE user_id = $1", [id]);
      await audit(c, { action: "admin.user.status", actorId: ctx.actorId, requestId: ctx.requestId, metadata: { userId: id, status } });
    });
    return this.user(id);
  }

  audit(limit: number): Promise<AuditEventDto[]> {
    return sql<AuditEventDto>(
      this.pool,
      `SELECT a.id, a.action, u.email AS "actorEmail", a.request_id AS "requestId", a.outcome, a.created_at AS "createdAt"
         FROM audit_events a LEFT JOIN users u ON u.id = a.actor_user_id ORDER BY a.created_at DESC LIMIT $1`,
      [limit],
    );
  }
}
