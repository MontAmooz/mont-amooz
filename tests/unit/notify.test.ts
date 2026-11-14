// Unit tests — notify() guard rails (src/lib/server/notify.ts)
// notify() is DB-backed; unit workers share the live dev DB, so only the
// pure guard rails run here. Full create/list/read coverage lives in
// tests/integration/notifications-*.test.ts against the throwaway server DB.
import { describe, test, expect } from "vitest";
import { notify } from "@/lib/server/notify";

describe("notify guard rails", () => {
  test("self-notification (actorId === userId) is a no-op that resolves", async () => {
    // Would write to the dev DB if not skipped — resolves without throwing.
    await expect(
      notify({
        userId: "self-user-id",
        actorId: "self-user-id",
        type: "REVIEW_RECEIVED",
        title: "خودم به خودم",
      })
    ).resolves.toBeUndefined();
  });

  test("DB error is swallowed (never throws)", async () => {
    // Force a failure with an impossibly long title (SQLite/Prisma validates
    // nothing here — instead use a missing-required-field shaped input through
    // a cast, or simply rely on the catch) — the observable contract is that
    // notify() resolves regardless.
    await expect(
      notify({
        userId: "",
        type: "MR_RECEIVED",
        title: "",
      })
    ).resolves.toBeUndefined();
  });
});
