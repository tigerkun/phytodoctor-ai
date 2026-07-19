# ADR 002: IndexedDB over LocalStorage

## Context
The application needs to store potentially large amounts of structured data, including:
- Check-in history (potentially hundreds of rows per specimen)
- High-resolution photo blobs
- Detailed HSV histograms and contour data
- Environmental telemetry logs

## Decision
We chose **IndexedDB** (via the **Dexie.js** wrapper) as the primary persistence layer instead of the more common `localStorage` API.

## Rationale
1. **Capacity**: `localStorage` is typically limited to 5MB per domain. A single high-res photo blob can exceed this limit. IndexedDB can store up to 50% of the available disk space.
2. **Data Types**: `localStorage` only stores strings. Storing binary image data (Blobs) requires expensive Base64 encoding/decoding, which increases storage footprint by ~33% and blocks the main thread. IndexedDB supports Blobs and Arrays natively.
3. **Querying**: Dexie provides a robust indexing system. We can query predictions by `triggeredAlert` or check-ins by `plantId` without loading the entire database into memory.
4. **Asynchronicity**: `localStorage` is synchronous and blocks the UI thread. Dexie is promise-based and handles database operations in the background.

## Consequences
- **Code Complexity**: Requires handling asynchronous state in React (solved using `useLiveQuery`).
- **Initial Setup**: Slightly more boilerplate to define the schema and versions.
- **Migration**: Schema changes require explicit versioning (e.g., migrating from boolean to numeric indices for performance).
