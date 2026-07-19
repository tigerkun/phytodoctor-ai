import { db, type Metric } from '../db/database';

export class TelemetryService {
  static async log(type: Metric['type'], value: number | string, context?: string) {
    try {
      await db.metrics.add({
        type,
        value,
        context,
        timestamp: new Date()
      });
      console.debug(`[Telemetry] ${type}: ${value} ${context ? `(${context})` : ''}`);
    } catch (err) {
      console.warn('Failed to log telemetry:', err);
    }
  }

  static async getSummary() {
    const all = await db.metrics.toArray();
    const ruleHits = all.filter(m => m.type === 'rule_hit').length;
    const geminiHits = all.filter(m => m.type === 'gemini_hit').length;
    const latencies = all.filter(m => m.type === 'latency').map(m => Number(m.value));
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    return {
      ruleHits,
      geminiHits,
      avgLatency: Math.round(avgLatency),
      totalEvents: all.length
    };
  }

  static async clear() {
    await db.metrics.clear();
  }
}
