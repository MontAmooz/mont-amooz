// /api/v1/sessions — GET (my sessions list) + POST (book a slot, atomic)
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PLATFORM_COMMISSION_PERCENT } from "@/lib/constants";
import { asString, fail, ok, readJson, requireUser, unauthorized } from "@/lib/server/http";
import { notify } from "@/lib/server/notify";
import { sessionInclude, toSessionItem } from "@/lib/server/serializers";
import { faDate } from "@/lib/format";

const MEETING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1

/** 6-char meeting code from the unambiguous alphabet. */
function genMeetingCode(): string {
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += MEETING_ALPHABET[bytes[i] % MEETING_ALPHABET.length];
  return out;
}

/** P2002 (unique violation) whose target includes the given field? */
function isUniqueViolation(e: unknown, field: string): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") return false;
  const target = e.meta?.target;
  if (Array.isArray(target)) return target.some((t) => String(t).includes(field));
  return String(target ?? "").includes(field) || e.message.includes(field);
}

class BookingConflict extends Error {}
class InsufficientFunds extends Error {}

// ---------- GET: my sessions ----------
export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const role = url.searchParams.get("role") ?? "all"; // student | teacher | all
  const status = url.searchParams.get("status") ?? "all"; // upcoming | past | all
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20)
  );

  const now = new Date();
  const where: Prisma.ClassSessionWhereInput = {};
  if (role === "teacher") where.teacherId = user.id;
  else if (role === "student") where.studentId = user.id;
  else where.OR = [{ teacherId: user.id }, { studentId: user.id }];
  if (status === "upcoming") where.startAt = { gte: now };
  else if (status === "past") where.startAt = { lt: now };

  const [rows, total] = await Promise.all([
    db.classSession.findMany({
      where,
      include: sessionInclude,
      orderBy: { startAt: status === "upcoming" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.classSession.count({ where }),
  ]);

  return ok({ items: rows.map((r) => toSessionItem(r, user.id)), total });
}

// ---------- POST: book a slot ----------
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const body = await readJson(req);
  if (!body) return fail("داده‌های ارسالی نامعتبر است");

  const slotId = asString(body.slotId);
  if (!slotId) return fail("اسلات مورد نظر الزامی است");
  const topic = asString(body.topic)?.trim() ?? "";
  if (topic.length > 120) return fail("موضوع جلسه حداکثر ۱۲۰ نویسه است");

  const slot = await db.teacherSlot.findUnique({ where: { id: slotId } });
  if (!slot) return fail("اسلات مورد نظر پیدا نشد", 404);
  if (slot.teacherId === user.id) return fail("نمی‌توانید اسلات خودتان را رزرو کنید");
  if (slot.startAt.getTime() <= Date.now()) return fail("زمان این اسلات گذشته است");
  if (slot.status !== "OPEN") return fail("این اسلات همین حالا رزرو شد", 409);

  const teacher = await db.user.findUnique({
    where: { id: slot.teacherId },
    select: { fullName: true },
  });
  if (!teacher) return fail("اسلات مورد نظر پیدا نشد", 404);

  // fast-fail balance check (authoritative check repeats inside the transaction)
  const wallet = await db.wallet.upsert({
    where: { userId: user.id },
    create: { userId: user.id, balance: 0 },
    update: {},
  });
  if (wallet.balance < slot.price) {
    return fail("موجودی کیف پول کافی نیست؛ ابتدا کیف پول را شارژ کنید", 402);
  }

  const price = slot.price;
  const teacherShare = Math.floor((price * (100 - PLATFORM_COMMISSION_PERCENT)) / 100);
  const commission = price - teacherShare;
  const topicLabel = topic || "جلسهٔ تدریس";
  const endAt = new Date(slot.startAt.getTime() + slot.durationMinutes * 60_000);

  // Retry loop: meetingCode is unique — on a (rare) collision, roll back and retry.
  for (let attempt = 0; attempt < 5; attempt++) {
    const meetingCode = genMeetingCode();
    try {
      const sessionId = await db.$transaction(async (tx) => {
        // conditional slot guard — 0 rows means someone booked it concurrently
        const claimed = await tx.teacherSlot.updateMany({
          where: { id: slotId, status: "OPEN" },
          data: { status: "BOOKED" },
        });
        if (claimed.count === 0) throw new BookingConflict();

        const w = await tx.wallet.upsert({
          where: { userId: user.id },
          create: { userId: user.id, balance: 0 },
          update: {},
        });
        if (w.balance < price) throw new InsufficientFunds();

        const session = await tx.classSession.create({
          data: {
            slotId,
            teacherId: slot.teacherId,
            studentId: user.id,
            startAt: slot.startAt,
            endAt,
            durationMinutes: slot.durationMinutes,
            price,
            teacherShare,
            commission,
            meetingCode,
            status: "BOOKED",
            topic: topic || null,
          },
          select: { id: true },
        });

        const balanceAfter = w.balance - price;
        await tx.txn.create({
          data: {
            userId: user.id,
            type: "SESSION_PAYMENT",
            amount: -price,
            balanceAfter,
            description: `رزرو جلسهٔ «${topicLabel}» با «${teacher.fullName}»`,
            status: "SUCCESS",
            refType: "SESSION",
            refId: session.id,
            authority: null,
          },
        });
        await tx.wallet.update({ where: { userId: user.id }, data: { balance: balanceAfter } });
        return session.id;
      });

      // P11 — notify the teacher (after the booking transaction commits)
      await notify({
        userId: slot.teacherId,
        actorId: user.id,
        type: "SESSION_BOOKED",
        title: "رزرو جدید",
        body: `«${user.fullName}» جلسهٔ «${topicLabel}» را برای ${faDate(slot.startAt)} رزرو کرد`,
        linkUrl: `#/session/${sessionId}`,
        relatedId: sessionId,
        relatedType: "session",
      });
      return ok({ id: sessionId }, 201);
    } catch (e) {
      if (e instanceof BookingConflict) {
        return fail("این اسلات همین حالا رزرو شد", 409);
      }
      if (e instanceof InsufficientFunds) {
        return fail("موجودی کیف پول کافی نیست؛ ابتدا کیف پول را شارژ کنید", 402);
      }
      if (isUniqueViolation(e, "meetingCode") && attempt < 4) continue;
      if (isUniqueViolation(e, "slotId")) {
        return fail("این اسلات همین حالا رزرو شد", 409);
      }
      throw e;
    }
  }
  return fail("خطای غیرمنتظره در رزرو جلسه؛ دوباره تلاش کنید", 500);
}
