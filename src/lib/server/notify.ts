// مُنت‌آموز — in-app notification creation (P11).
// Design principle: notify() NEVER throws. A failed notification must not
// break the main action (MR creation, session booking, …) — log and swallow.
// Self-notifications (actor === recipient) are silently skipped.
import { db } from "@/lib/db";

export type NotificationType =
  | "MR_RECEIVED"
  | "MR_REVIEWED"
  | "REVIEW_RECEIVED"
  | "SESSION_BOOKED"
  | "SESSION_COMPLETED"
  | "COURSE_PURCHASED";

export type NotifyInput = {
  userId: string; // recipient
  actorId?: string; // who triggered (if same as recipient, skip)
  type: NotificationType;
  title: string; // Persian, short (~60 chars)
  body?: string; // Persian, optional (~200 chars)
  linkUrl?: string; // client hash URL, e.g. "#/pamphlet/abc"
  relatedId?: string;
  relatedType?: "pamphlet" | "mr" | "session" | "course";
};

export async function notify(input: NotifyInput): Promise<void> {
  if (input.actorId && input.actorId === input.userId) return; // no self-notification
  try {
    await db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        linkUrl: input.linkUrl,
        relatedId: input.relatedId,
        relatedType: input.relatedType,
      },
    });
  } catch (e) {
    // Non-fatal — notification failure must never break the main action
    console.error("notify failed:", e);
  }
}
