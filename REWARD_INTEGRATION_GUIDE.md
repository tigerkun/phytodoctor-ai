/\*\*

- WORKFLOW INTEGRATION GUIDE
- How to integrate RewardService into all major workflows
  \*/

// ============ QUICK INTEGRATION PATTERNS ============

// Pattern 1: Award reward on an action (Diagnosis, Check-in, etc)
// ─────────────────────────────────────────────────────────────
// import { GameService } from '../services/gameService';
// import { useRewardNotifications } from '../game/useRewardNotifications';
//
// const { showNotification } = useRewardNotifications();
//
// const handleDiagnosis = async (plantId: string) => {
// try {
// const result = await GameService.awardRewardForAction('diagnosis_upload', { plantId });
// showNotification(result.xpAwarded, result.seedsAwarded, 'Plant Diagnosed', result.capExceeded);
// } catch (error) {
// console.error('Reward error:', error);
// }
// };

// Pattern 2: Award streak bonus on daily login
// ─────────────────────────────────────────────
// useEffect(() => {
// const initStreaks = async () => {
// try {
// await GameService.updateStreakOnLogin();
// // Streak updated, level display will refresh via useLiveQuery
// } catch (error) {
// console.error('Streak error:', error);
// }
// };
// initStreaks();
// }, []);

// Pattern 3: Award discovery on new plant species
// ────────────────────────────────────────────────
// const handleNewPlantCard = async (species: string, rarity: RarityTier) => {
// const result = await GameService.awardDiscoveryReward(species, rarity);
// showNotification(result.xpAwarded, result.seedsAwarded, `Discovered ${species}!`);
// };

// Pattern 4: Display player stats (Level + Streak)
// ────────────────────────────────────────────────
// import LevelDisplay from '../components/game/LevelDisplay';
// import StreakWidget from '../components/game/StreakWidget';
//
// // In your component JSX:
// <LevelDisplay compact={false} showUnlock={true} />
// <StreakWidget compact={false} />

// Pattern 5: Show reward notifications
// ─────────────────────────────────────
// import { NotificationContainer } from '../components/game/RewardNotification';
// import { useRewardNotifications } from '../game/useRewardNotifications';
//
// const { notifications, dismissNotification } = useRewardNotifications();
//
// // In JSX:
// <NotificationContainer notifications={notifications} onDismiss={dismissNotification} />

// ============ PAGE-BY-PAGE INTEGRATION CHECKLIST ============

/\*
HOME.tsx

---

✅ RuleBook component added
[ ] Add LevelDisplay to hero section (optional)

## CLINIC.tsx (Diagnosis)

[ ] On diagnosis complete: awardRewardForAction('diagnosis_upload')
[ ] On disease detected: awardRewardForAction('disease_stress_detected')
[ ] On treatment plan: awardRewardForAction('treatment_plan_generated')
[ ] On health score: awardRewardForAction('health_score_assigned')
[ ] Show NotificationContainer for toasts
[ ] Add "Daily cap reached" warning if capExceeded=true

## COLLECTION.tsx (Cards & Discoveries)

✅ Already shows seeds
[ ] Add LevelDisplay to header
[ ] Award discovery seeds when new card generated: awardDiscoveryReward()
[ ] Show "First discovery!" toast notification
[ ] Display collected species count

## PROFILE.tsx

✅ Added LevelDisplay and StreakWidget
[ ] Add RewardHistory section (list of recent rewards)
[ ] Add button to view full reward history
[ ] Show total XP earned all-time
[ ] Show lifetime seeds earned vs spent

## ARENA.tsx (Battles)

[ ] Award 'arena_win' reward on victory
[ ] Award streak multiplier bonus
[ ] Show notification: "+X seeds for winning"
[ ] Award 'arena_loss' tracking (no seeds, but for stats)

## CHAT.tsx (Community)

[ ] Award 'community_post' on submission (if not daily limit reached)
[ ] Award 'post_ten_likes' when post hits 10 likes
[ ] Award 'helpful_comment' on upvote
[ ] Show notification when earning community seeds

## SHOP.tsx (Marketplace cosmetics)

[ ] Already handles seed spending (addSeeds with negative amount)
[ ] No additional integration needed

## GUARDIAN.tsx (Guardian Score)

[ ] Award bonus seeds for high guardian scores
[ ] Link to health bonus rewards system
[ ] Show multiplier: "Excellent care = +50% seeds"

## LIBRARY.tsx

[ ] Award seeds for adding plant notes/observations
[ ] Gamify knowledge sharing

## PLANT_DETAIL.tsx

[ ] Add LevelDisplay for the card
[ ] Show XP progress to next card level
[ ] Award seeds on check-in completion
\*/

// ============ DATABASE QUERIES FOR REWARDS ============

// Query: Get user's total seeds earned today
// db.rewardHistory
// .where('userId').equals(userId)
// .where('createdAt').gte(todayStart)
// .filter(r => r.capsCategory === 'active')
// .toArray()
// .then(records => records.reduce((sum, r) => sum + r.seedsEarned, 0))

// Query: Get all level milestones
// db.levelProgress.get(userId)
// .then(p => `Level ${p.currentLevel}: ${p.totalXP} XP`)

// Query: Check if user has available discovery charges
// db.discoveryRecords
// .where('userId').equals(userId)
// .filter(r => r.chargeUsed && r.discoveredAt >= weekStart)
// .count()
// .then(used => used < REWARD_CAPS.DISCOVERY_CHARGES_PER_WEEK)

// ============ ENVIRONMENT SETUP ============

// Make sure .env has a timezone setting (for consistent date calculations):
// VITE_TIMEZONE=Asia/Kolkata

// All dates in RewardService use UTC ISO strings (YYYY-MM-DD)
// This ensures consistency across all timezones and server regions

export const INTEGRATION_CHECKLIST = {
home: { ruleBook: true, levelDisplay: false },
clinic: { diagnosis: false, notification: false },
collection: { discovery: false, levelDisplay: false },
profile: { levelDisplay: true, streakWidget: true, history: false },
arena: { battles: false, notification: false },
chat: { community: false, comments: false },
shop: { spending: true, notification: false },
guardian: { bonusSeeds: false },
library: { notes: false },
plantDetail: { checkIn: false, xp: false }
};
