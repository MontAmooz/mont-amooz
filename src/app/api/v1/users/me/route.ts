// PATCH /api/v1/users/me — update my profile fields
import { db } from "@/lib/db";
import { toPublicUser } from "@/lib/server/auth";
import { asString, fail, ok, readJson, requireUser, unauthorized } from "@/lib/server/http";

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const body = await readJson(req);
  if (!body) return fail("داده‌های ارسالی نامعتبر است");

  const data: {
    fullName?: string;
    title?: string | null;
    bio?: string | null;
    expertise?: string | null;
  } = {};

  if (body.fullName !== undefined) {
    const fullName = asString(body.fullName)?.trim() ?? "";
    if (fullName.length < 2 || fullName.length > 80) {
      return fail("نام و نام خانوادگی باید بین ۲ تا ۸۰ نویسه باشد");
    }
    data.fullName = fullName;
  }
  if (body.title !== undefined) {
    const title = asString(body.title)?.trim() ?? "";
    if (title.length > 40) return fail("عنوان حرفه‌ای حداکثر ۴۰ نویسه است");
    data.title = title || null;
  }
  if (body.bio !== undefined) {
    const bio = asString(body.bio)?.trim() ?? "";
    if (bio.length > 600) return fail("زندگی‌نامه حداکثر ۶۰۰ نویسه است");
    data.bio = bio || null;
  }
  if (body.expertise !== undefined) {
    const expertise = asString(body.expertise)?.trim() ?? "";
    if (expertise.length > 200) return fail("تخصص‌ها حداکثر ۲۰۰ نویسه است");
    data.expertise = expertise || null;
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data,
    select: {
      id: true,
      fullName: true,
      title: true,
      bio: true,
      expertise: true,
      role: true,
      isAdmin: true,
      createdAt: true,
    },
  });
  return ok({ user: toPublicUser(updated) });
}
