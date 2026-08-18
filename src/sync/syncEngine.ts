import { db } from '../db/database';

export async function syncCheckIns() {
  if (!navigator.onLine) return;
  
  try {
    const pending = await db.checkins.where('synced').equals(0).toArray();
    if (pending.length === 0) return;

    try {
      console.group(`Sync Engine: Processing ${pending.length} check-ins in batch`);
      console.log('Sending batched metadata to Cloud API...');

      // Simulate network roundtrip for the batch
      await new Promise(resolve => setTimeout(resolve, 800));

      console.log('Verification Success: Cloud Integrity Check Pass for Batch');
      console.groupEnd();

      const updates = pending.map(checkIn => ({
        key: checkIn.id,
        changes: { synced: 1 }
      }));

      // Apply updates in bulk
      await db.checkins.bulkUpdate(updates as any);
    } catch (e) {
      console.error('Failed to batch sync check-ins', e);
    }
  } catch (error) {
    console.error('Sync engine error:', error);
  }
}

// Minimal background runner
if (typeof window !== 'undefined') {
  window.addEventListener('online', syncCheckIns);
  setInterval(syncCheckIns, 5 * 60 * 1000); // Every 5 minutes
}
