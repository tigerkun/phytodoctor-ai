import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Structured logging.
 *
 * `console.log` with interpolated strings gives you a wall of prose. It is
 * fine right up until something breaks at 2am, when the one thing you need is
 * "every line this single request produced". With bare console calls there is
 * no way to get that: the lines interleave across every concurrent request,
 * and nothing ties a line to the request that caused it.
 *
 * So each line is a JSON object, every request carries an id, and that id is
 * attached to every line written while the request is in flight. Grab the id
 * out of any response's `x-request-id` header, then filter for it.
 *
 * The id lives in an AsyncLocalStorage rather than being threaded through
 * every function signature. That is what makes it usable: a helper eight
 * call frames deep still logs the right request without knowing a request
 * exists.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Production logs only. A debug line that says nothing is still a line you
 * have to scroll past, and it costs money to keep.
 */
const MIN_LEVEL: LogLevel =
  process.env.NODE_ENV === 'production' ? 'info' : 'debug';

/**
 * Field names whose values never reach the log, in any shape.
 *
 * This is a backstop, not a licence. The real rule is that nothing
 * user-supplied gets logged in the first place; redaction exists because
 * error objects are the one place a secret arrives uninvited -- a Supabase
 * failure can carry the request that carried the service key. Matching is on
 * the key name, case-insensitively, and deliberately broad: a field called
 * `api_key` and one called `token` are both worth losing.
 */
const SENSITIVE_KEY = /(pass(word|phrase)?|token|secret|authorization|auth|cookie|([a-z]+[-_])?(api|private|secret|service)[-_]?key|vapid|session|credential|signature)/i;

/** Personal data the playbook asks to be kept out of logs. */
const PII_KEY = /(email|phone|address|full[-_]?name|birth)/i;

const REDACTED = '[redacted]';

/**
 * Email is redacted to its domain: enough to tell `example.com` from a
 * throwaway address when chasing a signup failure, not enough to identify the
 * person. The one exception is the operator's own address, which appears in
 * boot warnings and is useful to keep intact.
 */
function redactEmail(value: unknown): unknown {
  if (typeof value !== 'string') return REDACTED;
  const at = value.lastIndexOf('@');
  if (at < 1) return REDACTED;
  return `${REDACTED}${value.slice(at)}`;
}

/** Collapse anything to a short, safe, printable string. */
function safeString(value: unknown, depth = 0): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  // An Error's own enumerable properties (Supabase puts the status and the
  // offending body on them) are more useful than the stack, and far safer.
  // This branch must not be short-circuited by an `instanceof Error` early
  // return above: doing so drops exactly the context that makes the line
  // worth reading, and the comment below it would be a lie.
  if (depth < 2 && typeof value === 'object') {
    const extra: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'message' || k === 'stack') continue;
      if (SENSITIVE_KEY.test(k) || PII_KEY.test(k)) continue;
      extra[k] = safeString(v, depth + 1);
    }
    const base = value instanceof Error ? (value.message || value.name) : String((value as { message?: unknown }).message ?? '');
    const keys = Object.keys(extra);
    return keys.length ? `${base} ${JSON.stringify(extra)}`.trim() : base;
  }
  if (value instanceof Error) return value.message || value.name;
  return '[object]';
}

/** Apply redaction to a flat or shallow field bag. */
export function redactFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (SENSITIVE_KEY.test(key)) out[key] = REDACTED;
    else if (PII_KEY.test(key)) out[key] = redactEmail(value);
    else if (typeof value === 'string') out[key] = safeString(value);
    else out[key] = safeString(value);
  }
  return out;
}

export interface RequestContext {
  requestId: string;
  /** Supabase user id for an authenticated request. Not an email, and not a
      secret -- it is already present in every JWT the browser holds. */
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Run `fn` with the request context attached to everything it logs. */
export function withRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/** The in-flight request, if any. Used by the request-scoped accessor below. */
export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/**
 * Attach the resolved user to the in-flight request.
 *
 * The context object is mutable and the store is inherited by every async
 * continuation of the request, so setting the id here -- where the auth gate
 * first learns who the caller is -- means every later line in the request,
 * including ones from code that has never heard of authentication, is
 * attributed to the right person. That is the "every log line includes user_id"
 * rule, satisfied without a single function signature changing.
 */
export function setRequestUser(userId: string | undefined): void {
  const store = storage.getStore();
  if (store && userId) store.userId = userId;
}

function emit(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;

  const ctx = storage.getStore();
  const line: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg: message,
  };
  // Only attach request scope when there is one. Boot and scheduled-job lines
  // are genuinely request-less, and a null id on every one of them is noise.
  if (ctx?.requestId) line.requestId = ctx.requestId;
  if (ctx?.userId) line.userId = ctx.userId;

  if (fields && Object.keys(fields).length) {
    Object.assign(line, redactFields(fields));
  }

  const serialised = JSON.stringify(line);
  if (level === 'error') console.error(serialised);
  else if (level === 'warn') console.warn(serialised);
  else console.log(serialised);
}

export const log = {
  debug: (message: string, fields?: Record<string, unknown>) => emit('debug', message, fields),
  info: (message: string, fields?: Record<string, unknown>) => emit('info', message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => emit('warn', message, fields),
  error: (message: string, fields?: Record<string, unknown>) => emit('error', message, fields),
};

/** Shorthand for an error argument, which is most of what gets logged. */
export function errFields(error: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { err: safeString(error), ...extra };
}