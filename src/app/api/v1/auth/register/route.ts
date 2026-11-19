// POST /api/v1/auth/register — create account + session
// P10: rate-limited per IP (10/h for beta, was 3) + honeypot field (`website` —
// bots fill it, humans never see it).
import { db } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { hashPassword, setSessionCookie, toPublicUser } from "@/lib/server/auth";
import { asString, fail, failRateLimit, ok, oneOf, readJson } from "@/lib/server/http";
import { notify } from "@/lib/server/notify";
import { checkRateLimit, getClientIp, RateLimitError } from "@/lib/server/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return fail("داده‌های ارسالی نامعتبر است");

  // P10 — honeypot: a filled "website" field means a bot (the input is visually
  // hidden and tabbable=false in the dialog). Generic message, no hints.
  if (asString(body.website)?.trim()) {
    return fail("درخواست نامعتبر");
  }

  try {
    // 10/h/IP — raised from 3/h for beta (Iranian CGNAT commonly shares one IP
    // across multiple users; 3/h blocked the second teacher on any shared network).
    await checkRateLimit(`register:${getClientIp(req)}`, 10, 3600);
  } catch (e) {
    if (e instanceof RateLimitError) return failRateLimit(e);
    throw e;
  }

  const email = asString(body.email)?.trim().toLowerCase() ?? "";
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return fail("ایمیل واردشده معتبر نیست");
  }
  const password = asString(body.password) ?? "";
  if (password.length < 6) {
    return fail("رمز عبور باید حداقل ۶ نویسه باشد");
  }
  const fullName = asString(body.fullName)?.trim() ?? "";
  if (fullName.length < 2 || fullName.length > 80) {
    return fail("نام و نام‌خانوادگی باید بین ۲ تا ۸۰ نویسه باشد");
  }
  let role = "معلم";
  if (body.role !== undefined && body.role !== null) {
    const parsedRole = oneOf(body.role, ROLES);
    if (!parsedRole) return fail("نقش انتخاب‌شده معتبر نیست");
    role = parsedRole;
  }

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return fail("این ایمیل قبلاً ثبت شده است", 409);

  const user = await db.user.create({
    data: { email, passwordHash: hashPassword(password), fullName, role },
  });
  await setSessionCookie(user.id);

  // P16 — tell every admin a new account appeared (the founder onboards the
  // waiting beta teachers). notify() skips self-notification when an admin
  // registers themselves, and never throws into the main action.
  const admins = await db.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  for (const admin of admins) {
    await notify({
      userId: admin.id,
      actorId: user.id,
      type: "NEW_USER_REGISTERED",
      title: "ثبت‌نام کاربر جدید",
      body: `«${user.fullName}» با نقش «${user.role}» ثبت‌نام کرد`,
      linkUrl: "#/admin",
      relatedId: user.id,
      relatedType: "user",
    });
  }

  return ok({ user: toPublicUser(user) }, 201);
}
