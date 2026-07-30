// lib/notifications.ts
//
// One repeating local notification at 10:00 AM reminding the user to
// check today's recommendations - deliberately generic (no specific book
// named), since Home's "Try today" picks are already category-specific
// and this is just a nudge to go look, not a preview of what's there.
//
// Not device-tested from the sandbox this was written in - expo-notifications'
// exact trigger-object shape has changed across SDK versions, so if this
// doesn't fire as expected, that API surface (SchedulableTriggerInputTypes,
// the shape of the trigger object) is the first thing worth double-checking
// against whatever version actually installed.

import * as Notifications from 'expo-notifications';

const DAILY_NOTIFICATION_ID = 'media-base-daily-recommendation';

export async function scheduleDailyRecommendationNotification(): Promise<void> {
  // Cancel any existing one first so toggling on twice (or re-enabling
  // after an app update) doesn't stack duplicate notifications.
  await cancelDailyRecommendationNotification();
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_NOTIFICATION_ID,
    content: {
      title: 'Media Base',
      body: "Come check out today's recommendations!",
      // A flat "something's waiting" signal (not a precise unread count -
      // there's only ever this one notification type) - same approach
      // Home Base settled on for its own alerts, since local (non-push)
      // notifications on iOS can't reliably accumulate a real count
      // across multiple pending notifications anyway.
      badge: 1,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 10,
      minute: 0,
      repeats: true,
    },
  });
}

export async function cancelDailyRecommendationNotification(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_NOTIFICATION_ID).catch(() => {});
}
