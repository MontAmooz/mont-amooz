// POST /api/v1/courses/[id]/purchase — enroll + atomic wallet transfer (80/20 split)
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PLATFORM_COMMISSION_PERCENT } from "@/lib/constants";
import { fail, ok, requireUser, unauthorized } from "@/lib/server/http";
import { notify } from "@/lib/server/notify";

class AlreadyEnrolled extends Error {}
class InsufficientFunds extends Error {}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!user) return unauthorized();

  const course = await db.videoCourse.findUnique({ where: { id } });
  if (!course || course.status !== "PUBLISHED") return fail("دوره پیدا نشد", 404);
  if (course.teacherId === user.id) return fail("این دورهٔ خودتان است", 403);

  // fast-path repeat-purchase check (authoritative guard = unique constraint)
  const existing = await db.courseEnrollment.findUnique({
    where: { courseId_studentId: { courseId: course.id, studentId: user.id } },
    select: { id: true },
  });
  if (existing) return fail("شما قبلاً این دوره را خریده‌اید", 409);

  const price = course.price;

  // free course: direct enrollment, no money moves
  if (price === 0) {
    try {
      await db.courseEnrollment.create({
        data: { courseId: course.id, studentId: user.id, price: 0 },
      });
      return ok({ ok: true }, 201);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return fail("شما قبلاً این دوره را خریده‌اید", 409);
      }
      throw e;
    }
  }

  // fast-fail balance check (repeated authoritatively inside the transaction)
  const wallet = await db.wallet.upsert({
    where: { userId: user.id },
    create: { userId: user.id, balance: 0 },
    update: {},
  });
  if (wallet.balance < price) {
    return fail("موجودی کیف پول کافی نیست؛ ابتدا کیف پول را شارژ کنید", 402);
  }

  const teacherShare = Math.floor((price * (100 - PLATFORM_COMMISSION_PERCENT)) / 100);

  try {
    await db.$transaction(async (tx) => {
      // unique-enrollment guard (P2002 → 409)
      await tx.courseEnrollment.create({
        data: { courseId: course.id, studentId: user.id, price },
      });

      // student: COURSE_PURCHASE −price
      const w = await tx.wallet.upsert({
        where: { userId: user.id },
        create: { userId: user.id, balance: 0 },
        update: {},
      });
      if (w.balance < price) throw new InsufficientFunds();
      const studentBalance = w.balance - price;
      await tx.txn.create({
        data: {
          userId: user.id,
          type: "COURSE_PURCHASE",
          amount: -price,
          balanceAfter: studentBalance,
          description: `خرید دورهٔ «${course.title}»`,
          status: "SUCCESS",
          refType: "COURSE",
          refId: course.id,
          authority: null,
        },
      });
      await tx.wallet.update({ where: { userId: user.id }, data: { balance: studentBalance } });

      // teacher: COURSE_EARNING +80%
      const tw = await tx.wallet.upsert({
        where: { userId: course.teacherId },
        create: { userId: course.teacherId, balance: 0 },
        update: {},
      });
      const teacherBalance = tw.balance + teacherShare;
      await tx.txn.create({
        data: {
          userId: course.teacherId,
          type: "COURSE_EARNING",
          amount: teacherShare,
          balanceAfter: teacherBalance,
          description: `فروش دورهٔ «${course.title}»`,
          status: "SUCCESS",
          refType: "COURSE",
          refId: course.id,
          authority: null,
        },
      });
      await tx.wallet.update({
        where: { userId: course.teacherId },
        data: { balance: teacherBalance },
      });
    });

    // P11 — notify the teacher (paid purchases only; after the transaction commits)
    if (price > 0) {
      await notify({
        userId: course.teacherId,
        actorId: user.id,
        type: "COURSE_PURCHASED",
        title: "خرید دوره",
        body: `«${user.fullName}» دورهٔ «${course.title}» را خرید`,
        linkUrl: `#/course/${course.id}`,
        relatedId: course.id,
        relatedType: "course",
      });
    }
    return ok({ ok: true }, 201);
  } catch (e) {
    if (e instanceof AlreadyEnrolled) return fail("شما قبلاً این دوره را خریده‌اید", 409);
    if (e instanceof InsufficientFunds) {
      return fail("موجودی کیف پول کافی نیست؛ ابتدا کیف پول را شارژ کنید", 402);
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("شما قبلاً این دوره را خریده‌اید", 409);
    }
    throw e;
  }
}
