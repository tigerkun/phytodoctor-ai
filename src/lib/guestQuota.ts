/**
 * Guest scan quota.
 *
 * The Lab is public so a visitor can prove the diagnosis is worth something
 * before being asked for an account. That means an unauthenticated caller can
 * reach the model, so the limit has to live somewhere an attacker cannot
 * argue with: server memory, keyed by the address the trusted proxy reports.
 *
 * Two properties matter and are pinned by the tests:
 *  - a bounded number of grants per IP per day, counted server-side only; and
 *  - a map that cannot grow without bound. Entries expire on the day they
 *    belong to, so a long-lived process holds at most one slice per client
 *    that used the guest lane today, not every client that ever did.
 */

export interface GuestQuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
}

export class GuestQuota {
  private counts = new Map<string, number>();
  private lastSweepDay = '';

  constructor(
    private readonly limit: number,
    /** Days of history to retain. 2 keeps yesterday's count while a UTC day rolls over. */
    private readonly retentionDays = 2
  ) {}

  private static key(ip: string, day: string, action: string) {
    return `${action}:${ip}:${day}`;
  }

  /** Drop every key from before the retention window. Cheap: called at most once a day. */
  private sweep(today: string) {
    if (this.lastSweepDay === today) return;
    this.lastSweepDay = today;
    const cutoff = new Date(`${today}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - (this.retentionDays - 1));
    const floor = cutoff.toISOString().slice(0, 10);
    for (const key of this.counts.keys()) {
      // key shape is action:ip:YYYY-MM-DD, so the day is the last segment.
      const day = key.slice(key.lastIndexOf(':') + 1);
      if (day < floor) this.counts.delete(key);
    }
  }

  /**
   * Count one use against `ip` for `action` on `day` and report whether it is
   * within the limit. A denied request does not consume quota, so a client
   * hammering a closed gate still sees the same answer rather than drifting.
   */
  take(ip: string, day: string, action: string): GuestQuotaResult {
    this.sweep(day);
    const key = GuestQuota.key(ip, day, action);
    const used = this.counts.get(key) || 0;
    if (used >= this.limit) return { allowed: false, used, limit: this.limit };
    this.counts.set(key, used + 1);
    return { allowed: true, used: used + 1, limit: this.limit };
  }

  /** Current usage without consuming anything. */
  peek(ip: string, day: string, action: string): number {
    return this.counts.get(GuestQuota.key(ip, day, action)) || 0;
  }

  /** Test seam: how many keys the map is holding. */
  get size() {
    return this.counts.size;
  }
}