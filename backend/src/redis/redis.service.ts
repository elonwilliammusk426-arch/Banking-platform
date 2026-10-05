import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.get('REDIS_URL', 'redis://localhost:6379'), {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    this.client.on('error', () => undefined);
  }

  private async ready() {
    if (this.client.status === 'wait') await this.client.connect();
    return this.client;
  }

  async ping() { return (await this.ready()).ping(); }
  async get(key: string) { return (await this.ready()).get(key); }
  async set(key: string, value: string, ttlSeconds: number) {
    return (await this.ready()).set(key, value, 'EX', ttlSeconds);
  }
  async setNx(key: string, value: string, ttlSeconds: number) {
    return (await this.ready()).set(key, value, 'EX', ttlSeconds, 'NX');
  }
  async del(key: string) { return (await this.ready()).del(key); }

  async onModuleDestroy() {
    if (this.client.status !== 'end') await this.client.quit().catch(() => undefined);
  }
}
