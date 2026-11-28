// /api/v1/step-images — POST (teacher upload for IMAGE steps, multipart) (P21).
// Images are content-addressed (uuid key) and served publicly by /step-images/[key]
// with immutable caching — no signed URLs needed here.
import { fail, ok, requireUser, unauthorized } from "@/lib/server/http";
import { saveFile } from "@/lib/server/storage";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  if (user.role !== "معلم" && !user.isAdmin)
    return fail("فقط معلم می‌تواند تصویر آپلود کند", 403);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("داده‌های ارسالی نامعتبر است");
  }
  const file = form.get("file");
  if (!file || typeof file === "string") return fail("فایلی ارسال نشده است");

  const contentType = file.type || "";
  if (!ALLOWED.has(contentType)) return fail("فقط PNG، JPG، WebP و GIF");
  if (file.size > MAX_SIZE) return fail("حجم تصویر حداکثر ۵ مگابایت است");
  if (file.size === 0) return fail("فایل خالی است");

  const buffer = Buffer.from(await file.arrayBuffer());
  // magic-byte cross-check — declared type alone can be spoofed (P9 pattern)
  const { fileTypeFromBuffer } = await import("file-type");
  const ft = await fileTypeFromBuffer(buffer);
  if (!ft || !ALLOWED.has(ft.mime)) return fail("نوع فایل تشخیص داده نشد");

  const key = await saveFile(buffer, ft.ext, "step-images");
  return ok({ url: `/api/v1/step-images/${key}` }, 201);
}
