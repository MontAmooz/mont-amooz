// POST /api/v1/sessions/[id]/complete — teacher closes a session, escrow is released (80/20)
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, ok, requireUser, unauthorized } from "@/lib/server/http";
import { notify } from "@/lib/server/notify";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!user) return unauthorized();

  const session = await db.classSession.findUnique({ where: { id } });
  if (!session) return fail("جلسه پیدا نشد", 404);
  if (session.teacherId !== user.id) {
    return fail("فقط معلم می‌تواند جلسه را پایان دهد", 403);
  }
  if (session.status !== "BOOKED") return fail("این جلسه قابل پایان دادن نیست");

  const topicLabel = session.topic || "جلسهٔ تدریس";
  const commissionText = session.commission.toLocaleString("en-US");

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.classSession.update({
      where: { id },
      data: { status: "COMPLETED", endAt: new Date() },
    });

    // release escrow: teacher gets their 80% share
    const wallet = await tx.wallet.upsert({
      where: { userId: session.teacherId },
      create: { userId: session.teacherId, balance: 0 },
      update: {},
    });
    const balanceAfter = wallet.balance + session.teacherShare;
    await tx.txn.create({
      data: {
        userId: session.teacherId,
        type: "SESSION_EARNING",
        amount: session.teacherShare,
        balanceAfter,
        description: `درآمد برگزاری جلسهٔ «${topicLabel}» (کمیسیون پلتفرم: ${commissionText} تومان)`,
        status: "SUCCESS",
        refType: "SESSION",
        refId: session.id,
        authority: null,
      },
    });
    await tx.wallet.update({
      where: { userId: session.teacherId },
      data: { balance: balanceAfter },
    });
  });

  // P11 — notify the student (after the completion transaction commits)
  const teacher = await db.user.findUnique({
    where: { id: session.teacherId },
    select: { fullName: true },
  });
  await notify({
    userId: session.studentId,
    actorId: user.id,
    type: "SESSION_COMPLETED",
    title: "جلسه برگزار شد",
    body: `جلسهٔ شما با «${teacher?.fullName ?? "معلم"}» به پایان رسید. لطفاً بازخورد بدهید.`,
    linkUrl: `#/session/${id}`,
    relatedId: id,
    relatedType: "session",
  });

  return ok({ status: "COMPLETED" });
}
