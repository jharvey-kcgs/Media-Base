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

// This module has two separate call sites - App.tsx re-runs the schedule
// call on every launch (to keep the notification's content in sync with
// whatever the code currently says, since a scheduled notification
// doesn't retroactively update itself), and PermissionsSettingsScreen.tsx
// calls it when the toggle is switched on. Both do a "cancel everything,
// then schedule one" sequence - safe on its own, but if two calls ever
// overlap (a launch-effect call still in flight when a toggle call starts,
// or the app relaunched/force-quit mid-call), each call's own cancel can
// run before the OTHER call's schedule, leaving two notifications
// registered instead of one. Confirmed via a real, recurring report of
// exactly this - two identical 10am notifications, reintroduced without
// any settings being touched, consistent with the launch-effect path
// racing against itself or the toggle path rather than the deliberate
// rapid-toggling that caused it the first time.
//
// This lock makes that impossible regardless of which call site (or
// combination of both) triggers it: every call to either function waits
// for whatever's already in flight to finish first, so there's never a
// moment where two cancel+schedule sequences are running at once.
let pending: Promise<void> = Promise.resolve();

function serialize(fn: () => Promise<void>): Promise<void> {
  // `pending` is always a resolved promise by the time this runs - the
  // .catch() below guarantees that - so this only ever needs an
  // onFulfilled handler, never an onRejected one.
  const run = pending.then(fn);
  // Swallow here so one failed call doesn't permanently wedge the queue
  // for every call after it - each call's own caller still sees its real
  // result via the promise `serialize` returns below.
  pending = run.catch(() => {});
  return run;
}

export function scheduleDailyRecommendationNotification(): Promise<void> {
  return serialize(async () => {
    // Cancel EVERYTHING scheduled first, not just our own identifier -
    // this app only ever schedules this one notification type, so
    // clearing everything is completely safe and far more thorough than
    // hoping every past schedule call used the exact same identifier.
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
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
  });
}

export function cancelDailyRecommendationNotification(): Promise<void> {
  return serialize(async () => {
    // Same reasoning as scheduleDailyRecommendationNotification() above -
    // clearing everything (not just DAILY_NOTIFICATION_ID) guarantees
    // turning the reminder off actually leaves nothing scheduled, safe
    // since this is the only notification type this app ever creates.
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  });
}
