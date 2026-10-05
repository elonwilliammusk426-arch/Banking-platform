import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService, private readonly redis: RedisService) {}

  @Get('live') live() { return { status: 'ok', timestamp: new Date().toISOString() }; }

  @Get('ready')
  async ready() {
    const checks: Record<string, string> = {};
    try { await this.db.$queryRaw`SELECT 1`; checks.postgres = 'up'; } catch { checks.postgres = 'down'; }
    try { checks.redis = (await this.redis.ping()) === 'PONG' ? 'up' : 'down'; } catch { checks.redis = 'down'; }
    const result = { status: Object.values(checks).every((value) => value === 'up') ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() };
    if (result.status !== 'ok') throw new ServiceUnavailableException(result);
    return result;
  }
}
