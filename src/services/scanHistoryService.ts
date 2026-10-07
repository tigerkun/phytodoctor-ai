import type { ScanReport } from './geminiService';

/**
 * Read access to the backend's scan-report archive (Phase 3).
 *
 * The report pipeline persists every finished analysis server-side; this
 * service is how the Keeper reads their own history back. Authenticated
 * only — the server filters by the account, guests have no history to read.
 */

export interface ScanHistoryItem {
  id: string;
  createdAt: string;
  kind: string;
  route: string;
  report: ScanReport;
}

export interface ScanHistoryPage {
  items: ScanHistoryItem[];
  total: number;
  limit: number;
  offset: number;
  /** True when the scan_reports migration has not been applied yet. */
  unavailable?: boolean;
}

export async function fetchScanHistory(limit = 20, offset = 0): Promise<ScanHistoryPage> {
  const response = await fetch(`/api/scan-history?limit=${limit}&offset=${offset}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('botanical_guardian_auth_token') || ''}`,
    },
  });

  if (response.status === 401) {
    throw new Error('SIGN_IN_REQUIRED');
  }
  if (!response.ok) {
    let message = `Could not load scan history (${response.status}).`;
    try {
      const parsed = await response.json();
      message = parsed.error || message;
    } catch {
      // keep the default
    }
    throw new Error(message);
  }
  return await response.json();
}
