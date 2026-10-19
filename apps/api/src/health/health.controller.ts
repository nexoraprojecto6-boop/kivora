import { Controller, Get } from "@nestjs/common";
import type { ApiSuccessResponse } from "@kivora/shared";

export interface HealthStatus {
  status: "ok";
}

@Controller("health")
export class HealthController {
  @Get()
  check(): ApiSuccessResponse<HealthStatus> {
    return { data: { status: "ok" } };
  }
}
