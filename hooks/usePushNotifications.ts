// hooks/usePushNotifications.ts
"use client";

import { useState, useEffect, useCallback } from "react";

export type NotifStatus = "idle" | "granted" | "denied" | "unsupported";

// Companion-specific reminder messages
const REMINDER_MESSAGES: Record<string, string[]> = {
  squish: [
    "Hey! You haven't checked in today 💛 Squish misses you!",
    "Good morning! Ready to crush your goals today? 🌟",
    "Don't forget your streak! Squish is waiting 🤗",
    "Time for your daily check-in! What are we working on? 💪",
  ],
  eva: [
    "AEGIS_ALERT: No activity detected. Check-in required.",
    "Productivity data gap detected. Resume session.",
    "Daily sync pending. Your objectives await.",
    "System idle. Agent check-in overdue.",
  ],
  spark: [
    "OMG HEY!! You haven't checked in TODAY!! Spark misses you SO MUCH!! 💖✨",
    "WAKE UP WAKE UP!! It's gonna be THE BEST DAY!! 🎉🚀",
    "YOUR STREAK IS ON THE LINE!! Let's GOOO!! 🔥💥",
    "SPARK IS WAITING FOR YOU!! Come back and let's CRUSH IT!! 🌈",
  ],
};

export function usePushNotifications(companionId: string, userName: string) {
  const [status, setStatus] = useState<NotifStatus>("idle");
  const [isRegistered, setIsRegistered] = useState(false);

  // Register SW on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        setIsRegistered(true);
        console.log("✅ Aegis SW registered:", reg.scope);

        // Schedule companion to remind SW about config
        if (reg.active) {
          reg.active.postMessage({
            type: "SCHEDULE_REMINDER",
            companionName: companionId,
            userName,
            reminderHour: 9, // 9 AM default
          });
        }
      })
      .catch((err) => console.error("SW registration failed:", err));

    // Check existing permission
    if (Notification.permission === "granted") setStatus("granted");
    else if (Notification.permission === "denied") setStatus("denied");
  }, [companionId, userName]);

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!("Notification" in window)) { setStatus("unsupported"); return false; }
    if (Notification.permission === "granted") { setStatus("granted"); return true; }
    if (Notification.permission === "denied")  { setStatus("denied");  return false; }

    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setStatus("granted");
      // Send immediate welcome notification
      sendLocalNotification(
        "🎉 Aegis Notifications Enabled!",
        `${companionId === "eva" ? "Notifications: ACTIVE. Daily briefings will commence." : companionId === "spark" ? "OMG YAY!! I'll remind you every day!! 💖✨" : "Squish will remind you to check in every day! 💛"}`,
        companionId
      );
      return true;
    }
    setStatus("denied");
    return false;
  }, [companionId]);

  // Send a local notification (no server needed)
  const sendLocalNotification = useCallback((title: string, body: string, companion = companionId) => {
    if (Notification.permission !== "granted") return;
    if (!isRegistered) {
      // Fallback: direct notification
      new Notification(title, { body, icon: "/aegis-logo.svg", badge: "/aegis-logo.svg" });
      return;
    }
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body,
        icon: "/aegis-logo.svg",
        badge: "/aegis-logo.svg",
        tag: "aegis-notification",
        vibrate: [200, 100, 200],
        actions: [
          { action: "open", title: "Open Aegis" },
          { action: "dismiss", title: "Dismiss" },
        ],
      });
    });
  }, [isRegistered, companionId]);

  // Schedule a daily reminder using setTimeout (persists as long as tab is open)
  // For true background notifications, a Push server is needed
  const scheduleDailyReminder = useCallback((hourOfDay = 9) => {
    if (status !== "granted") return;

    const now = new Date();
    const target = new Date();
    target.setHours(hourOfDay, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1); // Next day if time passed

    const msUntil = target.getTime() - now.getTime();
    const msgs = REMINDER_MESSAGES[companionId] || REMINDER_MESSAGES.squish;
    const msg = msgs[Math.floor(Math.random() * msgs.length)];

    console.log(`📅 Daily reminder scheduled in ${Math.round(msUntil / 60000)} minutes`);

    const tid = setTimeout(() => {
      sendLocalNotification("Aegis Intelligence", msg, companionId);
    }, msUntil);

    return () => clearTimeout(tid);
  }, [status, companionId, sendLocalNotification]);

  // Send a mood-aware notification
  const sendMoodNotification = useCallback((mood: string) => {
    if (status !== "granted") return;
    const msgs: Record<string, string> = {
      stressed: companionId === "eva"
        ? "Stress indicators detected. Consider a 5-minute break."
        : companionId === "spark"
        ? "HEY!! You seem stressed!! SPARK BELIEVES IN YOU!! 💪💖"
        : "Hey, you seem stressed! Take a deep breath 💛 You got this!",
      happy: companionId === "spark"
        ? "OMG YOU'RE THRIVING!! Keep that energy!! 🎉🌟"
        : "Great energy today! Keep it up! ✨",
    };
    const msg = msgs[mood];
    if (msg) sendLocalNotification("Aegis Intelligence", msg, companionId);
  }, [status, companionId, sendLocalNotification]);

  return {
    status,
    isRegistered,
    requestPermission,
    sendLocalNotification,
    scheduleDailyReminder,
    sendMoodNotification,
  };
}