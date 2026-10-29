import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { API_ERROR_CODE, type StaffRole } from "@kivora/shared";
import type { Pool } from "pg";
import { ApiException } from "../common/api-error.js";
import type { AuthenticatedRequest } from "../auth/auth.guard.js";
import { PG_POOL } from "./finance.config.js";
import { one } from "./sql.js";

export interface StaffRequest extends AuthenticatedRequest {
  staffRole?: StaffRole;
}

/** Depois do AuthGuard: deixa passar só SUPPORT ou ADMIN (lido da base de dados em cada pedido). */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffRequest>();
    const userId = req.authUser?.id;
    if (!userId) throw new ApiException(API_ERROR_CODE.UNAUTHENTICATED);
    const row = await one<{ role: StaffRole; status: string }>(this.pool, "SELECT role, status FROM users WHERE id = $1", [userId]);
    if (!row || row.status === "SUSPENDED" || (row.role !== "ADMIN" && row.role !== "SUPPORT")) {
      throw new ApiException(API_ERROR_CODE.FORBIDDEN);
    }
    req.staffRole = row.role;
    return true;
  }
}

/** Depois do StaffGuard: só ADMIN. */
@Injectable()
export class AdminOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.switchToHttp().getRequest<StaffRequest>().staffRole !== "ADMIN") throw new ApiException(API_ERROR_CODE.FORBIDDEN);
    return true;
  }
}
