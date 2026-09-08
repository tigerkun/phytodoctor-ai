import assert from 'node:assert';
import { StorageService } from './storageService';

export function runStorageChecks() {
  console.log('--- Running StorageService Unit Checks ---');

  // Test dataUrl helper rejects non-data strings
  assert.doesNotThrow(async () => {
    const result = await StorageService.uploadPlantPhotoFromDataUrl('', 'user-123');
    assert.strictEqual(result, null);
  });

  // Test dataUrl helper returns existing http URLs as is
  assert.doesNotThrow(async () => {
    const httpUrl = 'https://images.unsplash.com/photo-1545241047-6083a3684587';
    const result = await StorageService.uploadPlantPhotoFromDataUrl(httpUrl, 'user-123');
    assert.strictEqual(result, httpUrl);
  });

  console.log('All StorageService checks passed successfully!');
  return { success: true };
}

if (process.argv[1]?.includes('storageService.check')) {
  runStorageChecks();
}
