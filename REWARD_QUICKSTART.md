## 🚀 REWARD SYSTEM - QUICK START GUIDE

### 5-Minute Setup

Copy-paste these 3 code snippets to integrate rewards into any page:

---

## **1️⃣ Add Notifications to Page**

```typescript
import { useState } from 'react';
import { NotificationContainer, type RewardToast } from '../components/game/RewardNotification';

export default function MyPage() {
  const [notifications, setNotifications] = useState<RewardToast[]>([]);

  // Then in your JSX:
  return (
    <>
      <NotificationContainer
        notifications={notifications}
        onDismiss={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
      />
      {/* Rest of your page */}
    </>
  );
}
```

---

## **2️⃣ Award Reward When User Acts**

```typescript
import { COMMON_REWARDS } from "../game/rewardUtils";

const handleUserAction = async () => {
  try {
    const result = await COMMON_REWARDS.diagnose(plantId);

    setNotifications((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        xp: result.xpAwarded,
        seeds: result.seedsAwarded,
        actionName: "Plant Diagnosed!",
        capExceeded: result.capExceeded,
      },
    ]);
  } catch (error) {
    console.error("Reward failed:", error);
  }
};
```

**Available rewards:**

- `COMMON_REWARDS.diagnose(plantId)`
- `COMMON_REWARDS.loginDaily()`
- `COMMON_REWARDS.completeCheckIn(plantId)`
- `COMMON_REWARDS.postCommunity(postId)`
- `COMMON_REWARDS.winBattle(opponentId)`
- `COMMON_REWARDS.discoverNewSpecies(species, rarity)`
- `COMMON_REWARDS.propagateCard(parentId)`

---

## **3️⃣ Display Level & Streak (Optional)**

```typescript
import LevelDisplay from '../components/game/LevelDisplay';
import StreakWidget from '../components/game/StreakWidget';

export default function MyPage() {
  return (
    <div className="space-y-4">
      <LevelDisplay compact={false} showUnlock={true} />
      <StreakWidget compact={false} />
    </div>
  );
}
```

---

## **Complete Example: Diagnosis Page**

```typescript
import { useState } from 'react';
import { NotificationContainer, type RewardToast } from '../components/game/RewardNotification';
import { COMMON_REWARDS } from '../game/rewardUtils';
import LevelDisplay from '../components/game/LevelDisplay';

export default function DiagnosisPage() {
  const [notifications, setNotifications] = useState<RewardToast[]>([]);

  const handleDiagnosis = async (plantId: string) => {
    try {
      const result = await COMMON_REWARDS.diagnose(plantId);

      setNotifications(prev => [...prev, {
        id: crypto.randomUUID(),
        xp: result.xpAwarded,
        seeds: result.seedsAwarded,
        actionName: 'Diagnosis Complete!',
        capExceeded: result.capExceeded
      }]);
    } catch (error) {
      console.error('Diagnosis reward failed:', error);
    }
  };

  return (
    <div>
      <NotificationContainer
        notifications={notifications}
        onDismiss={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
      />

      <LevelDisplay compact={false} showUnlock={true} />

      <button onClick={() => handleDiagnosis('plant-123')}>
        Complete Diagnosis
      </button>
    </div>
  );
}
```

---

## **Compact Mode (for Small Spaces)**

```typescript
// Header bar
<LevelDisplay compact={true} />

// Streak indicator
<StreakWidget compact={true} />
```

---

## **Common Questions**

**Q: Can users buy seeds with money?**  
A: No. Seeds are earned only through gameplay.

**Q: What's the daily limit?**  
A: 150 seeds/day from regular tasks. Streaks, level-ups, and discoveries bypass this cap.

**Q: Does Pro users get more seeds?**  
A: Yes, 1.5x multiplier. But NO seed multipliers in level progression—only features.

**Q: How long does a toast notification show?**  
A: 4 seconds, then auto-dismisses.

**Q: Can I customize the toast message?**  
A: Yes, change `actionName` prop:

```typescript
{
  xp: 25,
  seeds: 20,
  actionName: 'Custom Message Here!',
  capExceeded: false
}
```

---

## **Troubleshooting**

**Notifications not showing?**

- Make sure you added `<NotificationContainer />` to your JSX

**Rewards not awarded?**

- Check browser console for errors
- Verify user profile exists: `GameService.ensureProfile()`

**Level display not updating?**

- Components use `useLiveQuery` hooks—data updates automatically

**Stuck at Level 1?**

- Diagnose plants (25 XP each) to earn XP faster

---

## **Next Steps**

1. Add notifications to your page (copy snippet #1)
2. Find action handlers, wrap with reward call (snippet #2)
3. (Optional) Add level/streak display (snippet #3)
4. Test in browser, check console for errors

**That's it!** 🎉

All reward logic, caps, multipliers, and validation is handled by `RewardService`—you just call the functions and show the toasts.

---

For detailed docs, see: `REWARD_SYSTEM_COMPLETE.md` or `REWARD_INTEGRATION_GUIDE.md`
