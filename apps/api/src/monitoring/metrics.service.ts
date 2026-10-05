import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly requestCount = new Counter({ name: 'haven_http_requests_total', help: 'Total HTTP requests', labelNames: ['method', 'route', 'status'], registers: [this.registry] });
  readonly requestDuration = new Histogram({ name: 'haven_http_request_duration_seconds', help: 'HTTP request duration', labelNames: ['method', 'route', 'status'], buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5], registers: [this.registry] });

  constructor() { collectDefaultMetrics({ register: this.registry, prefix: 'haven_' }); }
  contentType() { return this.registry.contentType; }
  render() { return this.registry.metrics(); }
}
