import { Inject, Injectable } from "@nestjs/common";
import {
  API_ERROR_CODE, type AdminTicketDetailDto, type AdminTicketDto, type NotificationDto, type TicketCategory, type TicketDetailDto, type TicketDto, type TicketMessageDto,
} from "@kivora/shared";
import type { Pool } from "pg";
import { ApiException } from "../common/api-error.js";
import { PG_POOL } from "./finance.config.js";
import { audit, notify, one, sql, tx, type Ctx } from "./sql.js";

@Injectable()
export class NotificationsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async list(userId: string, unreadOnly: boolean): Promise<{ items: NotificationDto[]; unread: number }> {
    const items = await sql<NotificationDto>(
      this.pool,
      `SELECT id, type, params, (read_at IS NOT NULL) AS read, created_at AS "createdAt" FROM notifications
        WHERE user_id = $1 AND (NOT $2::boolean OR read_at IS NULL) ORDER BY created_at DESC LIMIT 100`,
      [userId, unreadOnly],
    );
    const n = await one<{ n: number }>(this.pool, "SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL", [userId]);
    return { items, unread: n?.n ?? 0 };
  }

  async markRead(userId: string, id: string): Promise<void> {
    const rows = await sql(this.pool, "UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);
    if (rows.length === 0) throw new ApiException(API_ERROR_CODE.NOT_FOUND);
  }

  async markAllRead(userId: string): Promise<number> {
    return (await sql(this.pool, "UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL RETURNING id", [userId])).length;
  }
}

const TICKET_COLS = `t.id, t.subject, t.category, t.status, t.created_at AS "createdAt", t.updated_at AS "updatedAt"`;
const MSGS = `SELECT id, staff, body, created_at AS "createdAt" FROM support_messages WHERE ticket_id = $1 ORDER BY created_at`;

@Injectable()
export class SupportService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  listMine(userId: string): Promise<TicketDto[]> {
    return sql<TicketDto>(this.pool, `SELECT ${TICKET_COLS} FROM support_tickets t WHERE t.user_id = $1 ORDER BY t.updated_at DESC LIMIT 100`, [userId]);
  }

  async detail(userId: string, id: string): Promise<TicketDetailDto> {
    const t = await one<TicketDto>(this.pool, `SELECT ${TICKET_COLS} FROM support_tickets t WHERE t.id = $1 AND t.user_id = $2`, [id, userId]);
    if (!t) throw new ApiException(API_ERROR_CODE.NOT_FOUND);
    return { ...t, messages: await sql<TicketMessageDto>(this.pool, MSGS, [id]) };
  }

  async create(userId: string, input: { subject: string; category: TicketCategory; message: string }, requestId: string): Promise<TicketDetailDto> {
    const id = await tx(this.pool, async (c) => {
      const open = await one<{ n: number }>(c, "SELECT count(*)::int AS n FROM support_tickets WHERE user_id = $1 AND status <> 'CLOSED'", [userId]);
      if ((open?.n ?? 0) >= 5) throw new ApiException(API_ERROR_CODE.CONFLICT);
      const t = await one<{ id: string }>(c, "INSERT INTO support_tickets (user_id, subject, category) VALUES ($1, $2, $3) RETURNING id", [userId, input.subject, input.category]);
      if (!t) throw new ApiException(API_ERROR_CODE.INTERNAL_ERROR);
      await sql(c, "INSERT INTO support_messages (ticket_id, author_id, staff, body) VALUES ($1, $2, false, $3)", [t.id, userId, input.message]);
      await audit(c, { action: "support.create", actorId: userId, requestId, metadata: { ticketId: t.id } });
      return t.id;
    });
    return this.detail(userId, id);
  }

  async addMessage(userId: string, id: string, message: string): Promise<TicketDetailDto> {
    await tx(this.pool, async (c) => {
      const t = await one<{ status: string }>(c, "SELECT status FROM support_tickets WHERE id = $1 AND user_id = $2 FOR UPDATE", [id, userId]);
      if (!t) throw new ApiException(API_ERROR_CODE.NOT_FOUND);
      if (t.status === "CLOSED") throw new ApiException(API_ERROR_CODE.INVALID_STATE_TRANSITION);
      await sql(c, "INSERT INTO support_messages (ticket_id, author_id, staff, body) VALUES ($1, $2, false, $3)", [id, userId, message]);
      await sql(c, "UPDATE support_tickets SET status = 'OPEN', updated_at = now() WHERE id = $1", [id]);
    });
    return this.detail(userId, id);
  }

  /* ---------- Equipa ---------- */

  adminList(status: string | null): Promise<AdminTicketDto[]> {
    return sql<AdminTicketDto>(
      this.pool,
      `SELECT ${TICKET_COLS}, u.id AS "userId", u.email AS "userEmail", u.full_name AS "userName"
         FROM support_tickets t JOIN users u ON u.id = t.user_id WHERE ($1::text IS NULL OR t.status = $1) ORDER BY t.updated_at DESC LIMIT 200`,
      [status],
    );
  }

  async adminDetail(id: string): Promise<AdminTicketDetailDto> {
    const t = await one<AdminTicketDto>(
      this.pool,
      `SELECT ${TICKET_COLS}, u.id AS "userId", u.email AS "userEmail", u.full_name AS "userName" FROM support_tickets t JOIN users u ON u.id = t.user_id WHERE t.id = $1`,
      [id],
    );
    if (!t) throw new ApiException(API_ERROR_CODE.NOT_FOUND);
    return { ...t, messages: await sql<TicketMessageDto>(this.pool, MSGS, [id]) };
  }

  async adminReply(ctx: Ctx, id: string, message: string): Promise<AdminTicketDetailDto> {
    await tx(this.pool, async (c) => {
      const t = await one<{ userId: string; status: string }>(c, `SELECT user_id AS "userId", status FROM support_tickets WHERE id = $1 FOR UPDATE`, [id]);
      if (!t) throw new ApiException(API_ERROR_CODE.NOT_FOUND);
      if (t.status === "CLOSED") throw new ApiException(API_ERROR_CODE.INVALID_STATE_TRANSITION);
      await sql(c, "INSERT INTO support_messages (ticket_id, author_id, staff, body) VALUES ($1, $2, true, $3)", [id, ctx.actorId, message]);
      await sql(c, "UPDATE support_tickets SET status = 'ANSWERED', updated_at = now() WHERE id = $1", [id]);
      await notify(c, t.userId, "SUPPORT_REPLY", { ticketId: id });
      await audit(c, { action: "admin.support.reply", actorId: ctx.actorId, requestId: ctx.requestId, metadata: { ticketId: id } });
    });
    return this.adminDetail(id);
  }

  async adminClose(ctx: Ctx, id: string): Promise<AdminTicketDetailDto> {
    const rows = await sql(this.pool, "UPDATE support_tickets SET status = 'CLOSED', updated_at = now() WHERE id = $1 RETURNING id", [id]);
    if (rows.length === 0) throw new ApiException(API_ERROR_CODE.NOT_FOUND);
    await audit(this.pool, { action: "admin.support.close", actorId: ctx.actorId, requestId: ctx.requestId, metadata: { ticketId: id } });
    return this.adminDetail(id);
  }
}
