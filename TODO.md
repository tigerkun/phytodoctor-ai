# TODO - Botanical Guardian fixes

- [x] Fix Daily XP Throttle bug by querying Dexie compound index `[plantId+date]` explicitly in `src/services/gameService.ts`.
- [x] Add global leaf animation overlay: integrate `src/components/Leafify.tsx` into app shell so it triggers on click/hover.
- [x] Ensure TypeScript build passes (no new type errors).
- [x] Run `npm run lint` and `npm run build` to verify.
