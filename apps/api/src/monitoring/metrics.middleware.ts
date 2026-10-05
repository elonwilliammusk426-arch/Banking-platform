import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}
  use(req: Request, res: Response, next: NextFunction) {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const routePath = req.route?.path ? `${req.baseUrl}${req.route.path}` : 'unmatched';
      const labels = { method: req.method, route: routePath, status: String(res.statusCode) };
      this.metrics.requestCount.inc(labels);
      this.metrics.requestDuration.observe(labels, Number(process.hrtime.bigint() - started) / 1e9);
    });
    next();
  }
}
