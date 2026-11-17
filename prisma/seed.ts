// OpenEdu Git — seed script (run: bun prisma/seed.ts)
import { PrismaClient } from "@prisma/client";
import type { Review } from "@prisma/client";
import { hashPassword } from "../src/lib/server/auth";
import { lineDiff, countContentLines } from "../src/lib/diff";

const db = new PrismaClient();

const daysAgo = (n: number, hours = 0) =>
  new Date(Date.now() - n * 24 * 3600 * 1000 - hours * 3600 * 1000);

async function main() {
  console.log("🌱 Seeding OpenEdu Git …");
  await db.$transaction([
    db.reviewVote.deleteMany(),
    db.review.deleteMany(),
    db.mergeRequest.deleteMany(),
    db.contribution.deleteMany(),
    db.pamphletVersion.deleteMany(),
    db.pamphletAttachment.deleteMany(),
    db.pamphlet.deleteMany(),
    // Phase 2 — teaching marketplace
    db.lessonProgress.deleteMany(),
    db.courseReview.deleteMany(),
    db.courseEnrollment.deleteMany(),
    db.videoLesson.deleteMany(),
    db.videoCourse.deleteMany(),
    db.sessionReview.deleteMany(),
    db.sessionMessage.deleteMany(),
    db.classSession.deleteMany(),
    db.teacherSlot.deleteMany(),
    // P10/P11/P12 — auth, notifications, exams (cleanup must cover every
    // user-referencing table or re-seeding a dirty DB hits FK violations)
    db.examAttempt.deleteMany(),
    db.examQuestion.deleteMany(),
    db.exam.deleteMany(),
    db.notification.deleteMany(),
    db.passwordResetToken.deleteMany(),
    db.rateLimitAttempt.deleteMany(),
    db.txn.deleteMany(),
    db.wallet.deleteMany(),
    db.user.deleteMany(),
  ]);

  const pw = hashPassword("123456");

  // ---------- users ----------
  const [mohammad, ali, zahra, sara, mehdi, fateme, hossein] = await Promise.all([
    db.user.create({
      data: {
        email: "montajebii@montamooz.ir", passwordHash: pw,
        fullName: "محمدرضا منتجبی", title: "آقای",
        role: "معلم",
        isAdmin: true, // founder — the only admin (P10 admin panel)
        bio: "معلم ریاضی مدارس دولتی و نمونه؛ باور دارم بهترین آموزگار، جامعه است. بنیان‌گذار اُپن‌ای‌دیو گیت.",
        expertise: "حسابان,هندسه,ریاضی دوازدهم,کنکور ریاضی",
        createdAt: daysAgo(120),
      },
    }),
    db.user.create({
      data: {
        email: "ali.rezaei@montamooz.ir", passwordHash: pw,
        fullName: "علی رضایی", title: "آقای", role: "معلم",
        bio: "دبیر ریاضی و حسابان؛ عاشق آموزش مفهومی با مثال‌های روزمره.",
        expertise: "حسابان,آمار و احتمال,ریاضی",
        createdAt: daysAgo(95),
      },
    }),
    db.user.create({
      data: {
        email: "z.ahmadi@montamooz.ir", passwordHash: pw,
        fullName: "زهرا احمدی", title: "خانم", role: "معلم",
        bio: "دبیر فیزیک متوسطهٔ دوم؛ طراح سؤالات آزمون‌های آزمایشی.",
        expertise: "فیزیک,حرکت‌شناسی,آزمون‌سازی",
        createdAt: daysAgo(80),
      },
    }),
    db.user.create({
      data: {
        email: "s.mohammadi@montamooz.ir", passwordHash: pw,
        fullName: "سارا محمدی", title: "خانم", role: "معلم",
        bio: "دبیر شیمی؛ معتقدم شیمی نباید ترسناک باشد.",
        expertise: "شیمی,استوکیومتری,ترمودینامیک",
        createdAt: daysAgo(70),
      },
    }),
    db.user.create({
      data: {
        email: "m.karimi@montamooz.ir", passwordHash: pw,
        fullName: "مهدی کریمی", title: "آقای", role: "معلم",
        bio: "دبیر ادبیات فارسی؛ روایت‌گر شعر و سبک زندگی شاعران.",
        expertise: "ادبیات فارسی,حافظ,سبک‌شناسی",
        createdAt: daysAgo(60),
      },
    }),
    db.user.create({
      data: {
        email: "f.hosseini@montamooz.ir", passwordHash: pw,
        fullName: "فاطمه حسینی", title: "خانم", role: "معلم",
        bio: "دبیر زیست‌شناسی؛ مدرس دوره‌های المپیادی.",
        expertise: "زیست‌شناسی,سلول,ژنتیک",
        createdAt: daysAgo(50),
      },
    }),
    db.user.create({
      data: {
        email: "hossein@montamooz.ir", passwordHash: pw,
        fullName: "حسین نوری", role: "دانش‌آموز",
        bio: "دانش‌آموز پایهٔ دوازدهم ریاضی؛ علاقه‌مند به جزوه‌های مفهومی.",
        expertise: "",
        createdAt: daysAgo(40),
      },
    }),
  ]);

  console.log("👤 users created");

  // helper: pamphlet + v1 + author contribution
  async function makePamphlet(opts: {
    title: string; description: string; grade: string; subject: string; chapter?: string;
    method: string; difficulty: string; content: string; authorId: string;
    createdAt: Date; viewCount?: number; extraVersions?: { content: string; summary: string; days: number }[];
  }) {
    const p = await db.pamphlet.create({
      data: {
        title: opts.title, description: opts.description,
        grade: opts.grade, subject: opts.subject, chapter: opts.chapter ?? null,
        teachingMethod: opts.method, difficulty: opts.difficulty,
        authorId: opts.authorId, viewCount: opts.viewCount ?? 0,
        createdAt: opts.createdAt, updatedAt: opts.createdAt,
      },
    });
    await db.pamphletVersion.create({
      data: {
        pamphletId: p.id, versionNumber: 1, content: opts.content,
        createdById: opts.authorId, createdAt: opts.createdAt, changeSummary: "انتشار نسخهٔ اول",
      },
    });
    await db.contribution.create({
      data: {
        pamphletId: p.id, userId: opts.authorId,
        score: Math.max(countContentLines(opts.content), 10),
      },
    });
    let lastContent = opts.content;
    let v = 1;
    for (const ev of opts.extraVersions ?? []) {
      v += 1;
      const d = daysAgo(ev.days);
      await db.pamphletVersion.create({
        data: {
          pamphletId: p.id, versionNumber: v, content: ev.content,
          createdById: opts.authorId, createdAt: d, changeSummary: ev.summary,
        },
      });
      // author gains added lines
      const diff = lineDiff(lastContent, ev.content);
      if (diff.addedCount > 0) {
        await db.contribution.update({
          where: { pamphletId_userId: { pamphletId: p.id, userId: opts.authorId } },
          data: { score: { increment: diff.addedCount } },
        });
      }
      lastContent = ev.content;
      await db.pamphlet.update({ where: { id: p.id }, data: { updatedAt: d } });
    }
    return p;
  }

  // ---------- pamphlets ----------
  const mashotV1 = `# مشتق و کاربردهای آن — از صفر تا صد

> این جزوه برای دانش‌آموزانی نوشته شده که تا امروز از مشتق «می‌ترسیده‌اند». قول می‌دهم تا آخر این جزوه، مشتق را مثل یک بازی ببینید.

## ۱. مشتق یعنی چه؟

اگر **مشتق** را با یک جمله تعریف کنیم: *مشتق، سرعت تغییر است.*

تصور کنید با ماشین در جاده حرکت می‌کنید:

- مسافت طی‌شده در هر لحظه ثبت می‌شود → این همان تابع $f(x)$ است.
- سرعت شما در هر لحظه → این همان مشتق $f'(x)$ است.

## ۲. تعریف ریاضی

مشتق تابع $f$ در نقطهٔ $x$ از رابطهٔ زیر به دست می‌آید:

$$f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}$$

### معنی هندسی

خط مماس بر نمودار در هر نقطه، شیبی برابر با مقدار مشتق در آن نقطه دارد.

## ۳. قواعد مشتق‌گیری (جدول طلایی)

| تابع | مشتق |
|---|---|
| $c$ (عدد ثابت) | $0$ |
| $x^n$ | $nx^{n-1}$ |
| $\\sin x$ | $\\cos x$ |
| $\\cos x$ | $-\\sin x$ |
| $e^x$ | $e^x$ |
| $\\ln x$ | $\\frac{1}{x}$ |

## ۴. سه مثال حل‌شده

**مثال ۱:** مشتق $f(x) = 3x^4$ را بیابید.

$f'(x) = 3 \\times 4x^3 = 12x^3$

**مثال ۲:** مشتق $g(x) = x^2 + 5x - 7$ را بیابید.

$g'(x) = 2x + 5$

**مثال ۳:** در چه نقطه‌ای نمودار $h(x)=x^3$ شیب ۱۲ دارد؟

$h'(x) = 3x^2$ و باید $3x^2 = 12$ پس $x = 2$ (و $x=-2$).

## ۵. کاربردهای واقعی

1. **فیزیک:** سرعت لحظه‌ای، شتاب
2. **اقتصاد:** حداکثرسازی سود
3. **مهندسی:** طراحی منحنی‌های ایمن جاده

## جمع‌بندی شب امتحان

- مشتق = سرعت تغییر
- توان می‌آید ضربدر، توان یکی کم می‌شود
- شیب خط مماس = مقدار مشتق

> ✍️ **تمرین:** مشتق $y = 5x^3 - 2x + 1$ را حساب کنید و پاسخ را در بخش نظرات بنویسید.`;

  const mashotV2 = `# مشتق و کاربردهای آن — از صفر تا صد

> این جزوه برای دانش‌آموزانی نوشته شده که تا امروز از مشتق «می‌ترسیده‌اند». قول می‌دهم تا آخر این جزوه، مشتق را مثل یک بازی ببینید.

## ۱. مشتق یعنی چه؟

اگر **مشتق** را با یک جمله تعریف کنیم: *مشتق، سرعت تغییر است.*

تصور کنید با ماشین در جاده حرکت می‌کنید:

- مسافت طی‌شده در هر لحظه ثبت می‌شود → این همان تابع $f(x)$ است.
- سرعت شما در هر لحظه → این همان مشتق $f'(x)$ است.

## ۲. تعریف ریاضی

مشتق تابع $f$ در نقطهٔ $x$ از رابطهٔ زیر به دست می‌آید:

$$f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}$$

### معنی هندسی

خط مماس بر نمودار در هر نقطه، شیبی برابر با مقدار مشتق در آن نقطه دارد.

## ۳. قواعد مشتق‌گیری (جدول طلایی)

| تابع | مشتق |
|---|---|
| $c$ (عدد ثابت) | $0$ |
| $x^n$ | $nx^{n-1}$ |
| $\\sin x$ | $\\cos x$ |
| $\\cos x$ | $-\\sin x$ |
| $e^x$ | $e^x$ |
| $\\ln x$ | $\\frac{1}{x}$ |

### قاعدهٔ زنجیره‌ای

اگر $y = f(g(x))$ آنگاه $y' = f'(g(x)) \\cdot g'(x)$.

**مثال:** $(\\sin 3x)' = 3\\cos 3x$

## ۴. پنج مثال حل‌شده

**مثال ۱:** مشتق $f(x) = 3x^4$ را بیابید.

$f'(x) = 3 \\times 4x^3 = 12x^3$

**مثال ۲:** مشتق $g(x) = x^2 + 5x - 7$ را بیابید.

$g'(x) = 2x + 5$

**مثال ۳:** در چه نقطه‌ای نمودار $h(x)=x^3$ شیب ۱۲ دارد؟

$h'(x) = 3x^2$ و باید $3x^2 = 12$ پس $x = 2$ (و $x=-2$).

**مثال ۴ (قاعدهٔ ضرب):** مشتق $y = x^2 \\sin x$

$y' = 2x\\sin x + x^2\\cos x$

**مثال ۵ (زنجیره‌ای):** مشتق $y = (2x+1)^5$

$y' = 5(2x+1)^4 \\times 2 = 10(2x+1)^4$

## ۵. کاربردهای واقعی

1. **فیزیک:** سرعت لحظه‌ای، شتاب
2. **اقتصاد:** حداکثرسازی سود
3. **مهندسی:** طراحی منحنی‌های ایمن جاده
4. **پزشکی:** مدل‌سازی رشد تومور

## ۶. اشتباه‌های رایج کنکوری

- فراموش‌کردن ضریب در قاعدهٔ زنجیره‌ای
- اشتباه گرفتن مشتق ضرب با ضرب مشتق‌ها
- توجه‌نکردن به دامنهٔ تابع لگاریتمی

## جمع‌بندی شب امتحان

- مشتق = سرعت تغییر
- توان می‌آید ضربدر، توان یکی کم می‌شود
- شیب خط مماس = مقدار مشتق
- در قاعدهٔ زنجیره‌ای ضریب داخلی را فراموش نکنید

> ✍️ **تمرین:** مشتق $y = 5x^3 - 2x + 1$ را حساب کنید و پاسخ را در بخش نظرات بنویسید.`;

  const mashot = await makePamphlet({
    title: "مشتق و کاربردهای آن — از صفر تا صد",
    description: "جزوهٔ مفهومی مشتق با مثال‌های زندگی روزمره، جدول قواعد و تمرین‌های حل‌شده؛ مناسب پایهٔ دوازدهم و آمادگی کنکور.",
    grade: "دوازدهم", subject: "حسابان", chapter: "فصل ۲ — مشتق",
    method: "مفهومی", difficulty: "متوسط",
    content: mashotV1, authorId: mohammad.id, createdAt: daysAgo(45), viewCount: 412,
    extraVersions: [
      { content: mashotV2, summary: "افزودن قاعدهٔ زنجیره‌ای، دو مثال جدید و بخش اشتباه‌های رایج کنکوری", days: 20 },
    ],
  });

  const had = await makePamphlet({
    title: "جمع‌بندی برق‌آسا حد و پیوستگی",
    description: "همهٔ نکات حد و پیوستگی در ۱۵ دقیقه؛ مناسب شب امتحان با خلاصهٔ فرمول‌ها و مثال‌های تستی.",
    grade: "یازدهم", subject: "ریاضی", chapter: "فصل ۲ — حد",
    method: "جمع‌بندی", difficulty: "متوسط",
    content: `# جمع‌بندی برق‌آسا: حد و پیوستگی

## فرمول‌های حیاتی

1. $\\lim_{x \\to a} \\frac{x^n - a^n}{x - a} = n a^{n-1}$
2. $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$
3. $\\lim_{x \\to \\infty} \\frac{1}{x} = 0$

## روش تشخیص حد نامعین $\\frac{0}{0}$

- **فاکتورگیری:** صورت و مخرج را فاکتور بگیرید و عامل مشترک را ساده کنید.
- **ریشه‌گیری:** برای رادیکال‌ها از مزدوج‌سازی استفاده کنید.
- **رابطهٔ مثلثاتی:** برای $\\frac{0}{0}$ شامل سینوس.

## پیوستگی در یک نقطه

تابع $f$ در $x = a$ پیوسته است وقتی:

$$\\lim_{x \\to a^-} f(x) = \\lim_{x \\to a^+} f(x) = f(a)$$

## ده تست طلایی

**تست ۱:** $\\lim_{x \\to 2} \\frac{x^2-4}{x-2} = ?$

پاسخ: $\\frac{(x-2)(x+2)}{x-2} = x+2 \\to 4$

**تست ۲:** $\\lim_{x \\to 0} \\frac{\\sin 5x}{3x} = ?$

پاسخ: $\\frac{5}{3}$

> ⏰ **نکتهٔ شب امتحان:** اگر صورت و مخرج هر دو به صفر میل کنند، اول فاکتورگیری!`,
    authorId: ali.id, createdAt: daysAgo(30), viewCount: 265,
  });

  await makePamphlet({
    title: "حرکت‌شناسی: بانک تست کنکور با حل کامل",
    description: "۸۰ تست طبقه‌بندی‌شدهٔ حرکت‌شناسی از کنکورهای سراسری با حل گام‌به‌گام و نکات تستی.",
    grade: "دوازدهم", subject: "فیزیک", chapter: "فصل ۱ — حرکت‌شناسی",
    method: "کنکوری", difficulty: "پیشرفته",
    content: `# حرکت‌شناسی: بانک تست کنکور

## نقشهٔ راه مطالعه

1. حرکت با شتاب ثابت
2. نمودارهای حرکت (مکان-زمان، سرعت-زمان)
3. سقوط آزاد
4. حرکت پرتابه

## فرمول‌های پایه

| کمیت | رابطه |
|---|---|
| سرعت متوسط | $\\bar{v} = \\frac{\\Delta x}{\\Delta t}$ |
| رابطهٔ سرعت-مکان | $v^2 - v_0^2 = 2a\\Delta x$ |
| ارتفاع بیشینه | $h = \\frac{v_0^2 \\sin^2\\theta}{2g}$ |

## تست نمونه با حل

**تست (کنکور ۱۴۰۲):** جسمی با سرعت اولیهٔ ۲۰ متر بر ثانیه رها می‌شود. پس از چند ثانیه سرعت آن ۵ متر بر ثانیه می‌شود؟ ($g = 10$)

حل: $v = v_0 - gt \\Rightarrow 5 = 20 - 10t \\Rightarrow t = 1.5$ ثانیه

## نکات تستی

- در نمودار سرعت-زمان، **مساحت زیر نمودار = جابه‌جایی**
- شیب نمودار مکان-زمان = سرعت لحظه‌ای
- در بالاترین نقطهٔ پرتابه، مؤلفهٔ عمودی سرعت صفر است

> 🎯 **هدف این جزوه:** تسلط بر ۹۰٪ تست‌های حرکت‌شناسی در کمتر از ۳ ساعت تمرین.`,
    authorId: zahra.id, createdAt: daysAgo(25), viewCount: 388,
  });

  await makePamphlet({
    title: "استوکیومتری بدون ترس",
    description: "آشپزی با اتم‌ها! آموزش مفهومی محاسبات شیمیایی با مثال‌های آشپزی، بدون فرمول‌بازی‌های بی‌دلیل.",
    grade: "یازدهم", subject: "شیمی", chapter: "فصل ۱ — استوکیومتری",
    method: "مفهومی", difficulty: "متوسط",
    content: `# استوکیومتری بدون ترس

## آشپزخانهٔ شیمی

فرض کنید می‌خواهید کیک درست کنید:

- دستور پخت (معادلهٔ شیمیایی) می‌گوید: ۲ پیمانه آرد + ۳ تخم‌مرغ → ۱ کیک
- اگر ۱۰ تخم‌مرغ داشته باشید اما فقط ۴ پیمانه آرد؟ فقط ۲ کیک می‌توانید درست کنید!

**مادهٔ محدود‌کننده** همان آرد است. استوکیومتری دقیقاً همین است!

## گام‌های حل هر مسئلهٔ استوکیومتری

1. معادلهٔ موازنه‌شده بنویسید
2. داده‌ها را به **مول** تبدیل کنید
3. با استفاده از ضرایب استوکیومتری، نسبت بزنید
4. پاسخ را به واحد خواسته‌شده برگردانید

## مثال حل‌شده

**مسئله:** چند گرم آب از واکنش ۴ گرم هیدروژن با اکسیژن به دست می‌آید؟

۱) معادله: $2H_2 + O_2 \\to 2H_2O$

۲) مول هیدروژن: $\\frac{4}{2} = 2$ مول

۳) نسبت: ۲ مول $H_2$ → ۲ مول $H_2O$

۴) جرم آب: $2 \\times 18 = 36$ گرم

## بازده واکنش

$$\\text{بازده} = \\frac{\\text{مقدار واقعی}}{\\text{مقدار نظری}} \\times 100$$

> 🍰 **یادتان باشد:** همیشه اول بپرسید «مادهٔ محدودکننده کدام است؟»`,
    authorId: sara.id, createdAt: daysAgo(22), viewCount: 198,
  });

  await makePamphlet({
    title: "حافظ؛ کتاب سبلانِ زندگی",
    description: "درس‌نامهٔ داستان‌محور غزلیات حافظ؛ هر غزل مثل یک قصه روایت می‌شود تا هیچ‌وقه فراموش نشود.",
    grade: "یازدهم", subject: "ادبیات فارسی", chapter: "فصل ۳ — شعر حافظ",
    method: "داستان‌محور", difficulty: "مقدماتی",
    content: `# حافظ؛ کتاب سبلانِ زندگی

## چرا حافظ «لسان‌الغیب» است؟

حافظ مثل یک عکاس بود که از جامعهٔ قرن هشتم پرتره می‌گرفت؛ اما دوربینش قلبش بود.

## ساختار غزل حافظ را چگونه بخوانیم؟

۱. **بیت‌المعانی** (بیت آغازین): کلید در ورود به دنیای غزل

۲. **گره‌گاه:** جایی که شاعر مسئله را طرح می‌کند

۳) **گشوده‌گاه:** پاسخ شاعر به مسئله

## تحلیل نمونه: «الا یا ایها الساقی ادر کأساً و ناولها»

| مصرع | سطح معنایی |
|---|---|
| الا یا ایها الساقی ادر کأسا و ناولها | خطاب به ساقی: جام تازه کن |
| که عشق آسان نمود اول ولی افتاد مشکل‌ها | عشق در ظاهر آسان، در باطن دشوار |

## سبک‌شناسی در پنج خط

- زبان: **ساده و روان** اما با ظرافت‌های عمیق
- ادبیات: مضمون‌های عرفانی، رندی، تقریظ جامعهٔ ریاکار
- لطیفهٔ طنز آمیخته با اندوه

> 🌹 **پیشنهاد مطالعه:** هر شب یک غزل بخوانید و بیت‌المعانی آن را در دفترتان بنویسید.`,
    authorId: mehdi.id, createdAt: daysAgo(18), viewCount: 156,
  });

  const cell = await makePamphlet({
    title: "سلول: واحد حیات — از غشا تا هسته",
    description: "سفر داخل سلول با نقشه‌های شماتیک و تشبیه‌های ملموس؛ مناسب دهم و آمادگی المپیاد زیست.",
    grade: "دهم", subject: "زیست‌شناسی", chapter: "فصل ۲ — سلول",
    method: "مفهومی", difficulty: "مقدماتی",
    content: `# سلول: واحد حیات

## شهر کوچک سلول

سلول را مثل یک شهر تصور کنید:

- **غشای پلاسمی:** دیوار شهر با دروازه‌های هوشمند
- **هستهٔ سلول:** شهرداری (مرکز تصمیم‌گیری)
- **میتوکندری:** نیروگاه شهر
- **ریبوزوم:** کارخانه‌های ساخت پروتئین
- **دستگاه گلژی:** ادارهٔ پست و بسته‌بندی

## غشای پلاسمی: مدل مایکِ فطیری

مدل فسفولیپیدی دولایه با پروتئین‌های شناور:

- **نفوذپذیری انتخابی:** همه چیز وارد نمی‌شود!
- انتقال غیرفعال (بدون انرژی): انتشار ساده، انتشار یاری‌شده، اسمز
- انتقال فعال (با انرژی ATP): پمپ سدیم-پتاسیم

## مقایسهٔ پروکاریوت و یوکاریوت

| ویژگی | پروکاریوت | یوکاریوت |
|---|---|---|
| هسته | ندارد | دارد |
| اندامک غشادار | ندارد | دارد |
| مثال | باکتری | سلول گیاهی و جانوری |

> 🔬 **نکتهٔ المپیادی:** همهٔ سلول‌ها ریبوزوم دارند؛ حتی پروکاریوت‌ها.`,
    authorId: fateme.id, createdAt: daysAgo(15), viewCount: 220,
  });

  await makePamphlet({
    title: "قضیهٔ فیثاغورس با ۱۲ مثال حل‌شده",
    description: "از اثبات بصری تا مسئله‌های ترکیبی؛ حل تمرین کامل فصل ۳ ریاضی نهم.",
    grade: "نهم", subject: "ریاضی", chapter: "فصل ۳ — مثلثات",
    method: "حل تمرین", difficulty: "متوسط",
    content: `# قضیهٔ فیثاغورس با ۱۲ مثال حل‌شده

## قضیه در یک نگاه

در مثلث قائمه‌الزاویه:

$$a^2 + b^2 = c^2$$

که $c$ وتر (بلندترین ضلع، روبه‌روی زاویهٔ قائمه) است.

## اثبات بصری (پازل چینی)

سه مربع روی اضلاع مثلث بسازید؛ مساحت مربع وتر دقیقاً برابر مجموع مساحت دو مربع دیگر است. خودتان امتحان کنید!

## مثال‌های حل‌شده

**مثال ۱:** اضلاع ۶ و ۸؛ وتر؟

$c^2 = 36 + 64 = 100 \\Rightarrow c = 10$

**مثال ۲:** وتر ۱۳ و ضلع ۵؛ ضلع دیگر؟

$b^2 = 169 - 25 = 144 \\Rightarrow b = 12$

**مثال ۳ (کاربردی):** نردبان ۵ متری با فاصلهٔ ۳ متری از دیوار تا چه ارتفاعی می‌رسد؟

$h^2 = 25 - 9 = 16 \\Rightarrow h = 4$ متر

## سه‌گانه‌های مشهور

(۳، ۴، ۵) — (۵، ۱۲، ۱۳) — (۸، ۱۵، ۱۷) — (۷، ۲۴، ۲۵)

> 🧩 **تمرین پایانی:** آیا مثلثی با اضلاع ۹، ۴۰ و ۴۱ قائمه است؟ چرا؟`,
    authorId: mohammad.id, createdAt: daysAgo(12), viewCount: 189,
  });

  await makePamphlet({
    title: "توابع نمایی و لگاریتم — جزوهٔ کنکوری نهایی",
    description: "خلاصهٔ کامل قواعد لگاریتم، معادله‌های نمایی و تست‌های ترکیبی آخر کنکور.",
    grade: "دوازدهم", subject: "ریاضی", chapter: "فصل ۲ — توابع",
    method: "کنکوری", difficulty: "پیشرفته",
    content: `# توابع نمایی و لگاریتم — جزوهٔ کنکوری

## قوانین لگاریتم که نباید فراموش کنید

1. $\\log_a(xy) = \\log_a x + \\log_a y$
2. $\\log_a \\frac{x}{y} = \\log_a x - \\log_a y$
3. $\\log_a x^n = n \\log_a x$
4. $a^{\\log_a x} = x$

## تغییر پایه

$$\\log_a b = \\frac{\\ln b}{\\ln a}$$

## معادلهٔ نمایی — روش‌ها

**روش ۱ (یکسان‌سازی پایه):** $2^x = 8 \\Rightarrow 2^x = 2^3 \\Rightarrow x = 3$

**روش ۲ (لگاریتم‌گیری):** $3^x = 5 \\Rightarrow x = \\log_3 5 \\approx 1.46$

## تست ترکیبی

**تست:** اگر $\\log_2 x + \\log_2 (x-2) = 3$ آنگاه x؟

حل: $\\log_2 [x(x-2)] = 3 \\Rightarrow x^2 - 2x = 8 \\Rightarrow x = 4$ (ریشهٔ منفی نامعتبر)

> ⚡ **نکتهٔ تستی:** همیشه دامنهٔ لگاریتم را چک کنید؛ عبارت داخل لگاریتم باید **مثبت** باشد.`,
    authorId: ali.id, createdAt: daysAgo(10), viewCount: 301,
  });

  await makePamphlet({
    title: "آینه‌ها و عدسی‌ها با تصویرسازی ذهنی",
    description: "رسم پرتوها را با ترفندهای «مسیر عکس» یاد بگیرید؛ علوم نهم و فیزیک یازدهم.",
    grade: "نهم", subject: "علوم", chapter: "فصل ۵ — نور",
    method: "مثال‌محور", difficulty: "مقدماتی",
    content: `# آینه‌ها و عدسی‌ها با تصویرسازی ذهنی

## سه پرتوی طلایی برای رسم تصویر

1. پرتوی **موازی محور** → از کانون می‌گذرد
2. پرتوی **گذرنده از کانون** → موازی محور بازمی‌گردد
3. پرتوی **گذرنده از مرکز آینه** → روی خودش برمی‌گردد

## قاعدهٔ سریع تشخیص نوع تصویر

| موقعیت جسم | نوع تصویر |
|---|---|
| دورتر از C | حقیقی، معکوس، کوچک |
| روی C | حقیقی، معکوس، هم‌اندازه |
| بین C و F | حقیقی، معکوس، بزرگ |
| داخل F | مجازی، راست، بزرگ |

## عدسی همگرا و واگرا در یک قاب

- **همگرا (محدب):** لنز ذره‌بین؛ نور را جمع می‌کند
- **واگرا (مقعر):** همیشه تصویر مجازی، راست و کوچک

> 💡 **ترفند حفظی:** «آینهٔ مقعر جمع می‌کند، عدسی محدب جمع می‌کند» — بقیه واگرا هستند!`,
    authorId: zahra.id, createdAt: daysAgo(8), viewCount: 143,
  });

  await makePamphlet({
    title: "دستور خط عربی: قواعد ترجمه در ۱۰ صفحه",
    description: "هر قاعدهٔ ترجمه با الگوی ثابت و تمرین هدفمند؛ برای امتحان نهایی عربی یازدهم.",
    grade: "یازدهم", subject: "عربی", chapter: "دروس ۱ تا ۴",
    method: "جمع‌بندی", difficulty: "متوسط",
    content: `# دستور خط عربی: قواعد ترجمه

## الگوی ترجمهٔ جملات اسمیه

«المبتدأ + الخبر» → «... هست/است»

**مثال:** الْمَسْجِدُ قَرِيبٌ → مسجد نزدیک است.

## الگوی ترجمهٔ جملات فعلیه

«الفعل + الفاعل + المفعول» → ترتیس: مفعول + فاعل + فعل

**مثال:** يَكْتُبُ الطَّالِبُ الدَّرْسَ → دانش‌آموز درس را می‌نویسد.

## ضمیرها (جدول ضروری)

| منفصل | متصل | معنی |
|---|---|---|
| هُوَ | ـهُ | او (مذکر) |
| هِيَ | ـها | او (مؤنث) |
| أَنْتَ | ـكَ | تو |

> 📝 **نکتهٔ امتحانی:** در ترجمهٔ عبارت بعد از «ما» تعجبیه، اول «چه» بگذارید.`,
    authorId: mehdi.id, createdAt: daysAgo(6), viewCount: 98,
  });

  await makePamphlet({
    title: "شیمی آلی: شناخت گروه‌های عاملی",
    description: "شناخت سریع گروه‌های عاملی با مثال‌های دارویی و صنعتی؛ شیمی دوازدهم.",
    grade: "دوازدهم", subject: "شیمی", chapter: "فصل ۲ — شیمی آلی",
    method: "مثال‌محور", difficulty: "متوسط",
    content: `# شیمی آلی: شناخت گروه‌های عاملی

## چرا گروه عاملی مهم است؟

گروه عاملی مثل «شغلِ» مولکول است؛ رفتار شیمیایی را تعیین می‌کند.

## مهم‌ترین گروه‌ها

| گروه | فرمول | مثال روزمره |
|---|---|---|
| هیدروکسیل | ‎—OH | الکل، قند |
| کربوکسیل | ‎—COOH | سرکه، آسپرین |
| آمین | ‎—NH₂ | رنگ مو، آمونیاک آلی |
| کربونیل (آلدهید) | ‎—CHO | بوی ماهی تازه |

## تست سریع شناسایی

- **تولنس:** آلدهید → آینهٔ نقره‌ای
- **سدیم بی‌کربنات:** اسید کربوکسیلیک → کف CO₂

> 💊 **ترفند حفظی:** «آلدهید آینه می‌سازد، اسید کف می‌کند.»`,
    authorId: sara.id, createdAt: daysAgo(4), viewCount: 76,
  });

  console.log("📚 pamphlets created");

  // ---------- fork + merged MR (مشتق) ----------
  const mashotForkContent = `# مشتق و کاربردهای آن — نسخهٔ بهبودیافته

> این جزوه برای دانش‌آموزانی نوشته شده که تا امروز از مشتق «می‌ترسیده‌اند». قول می‌دهم تا آخر این جزوه، مشتق را مثل یک بازی ببینید.

## ۱. مشتق یعنی چه؟

اگر **مشتق** را با یک جمله تعریف کنیم: *مشتق، سرعت تغییر است.*

تصور کنید با ماشین در جاده حرکت می‌کنید:

- مسافت طی‌شده در هر لحظه ثبت می‌شود → این همان تابع $f(x)$ است.
- سرعت شما در هر لحظه → این همان مشتق $f'(x)$ است.

## مثال زندگی روزمره: بالن هلیومی 🎈

قطر بالن با گذشت زمان بزرگ می‌شود. اگر $r(t) = 2t$ باشد:

- سرعت رشد شعاع: $r'(t) = 2$ سانتی‌متر بر دقیقه
- سرعت رشد مساحت سطح: $A(t) = 4\\pi r^2$ پس $A'(t) = 8\\pi r \\cdot r' = 32\\pi t$

## ۲. تعریف ریاضی

مشتق تابع $f$ در نقطهٔ $x$ از رابطهٔ زیر به دست می‌آید:

$$f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}$$

### معنی هندسی

خط مماس بر نمودار در هر نقطه، شیبی برابر با مقدار مشتق در آن نقطه دارد.

## ۳. قواعد مشتق‌گیری (جدول طلایی)

| تابع | مشتق |
|---|---|
| $c$ (عدد ثابت) | $0$ |
| $x^n$ | $nx^{n-1}$ |
| $\\sin x$ | $\\cos x$ |
| $\\cos x$ | $-\\sin x$ |
| $e^x$ | $e^x$ |
| $\\ln x$ | $\\frac{1}{x}$ |

### قاعدهٔ زنجیره‌ای

اگر $y = f(g(x))$ آنگاه $y' = f'(g(x)) \\cdot g'(x)$.

**مثال:** $(\\sin 3x)' = 3\\cos 3x$

## ۴. پنج مثال حل‌شده

**مثال ۱:** مشتق $f(x) = 3x^4$ را بیابید.

$f'(x) = 3 \\times 4x^3 = 12x^3$

**مثال ۲:** مشتق $g(x) = x^2 + 5x - 7$ را بیابید.

$g'(x) = 2x + 5$

**مثال ۳:** در چه نقطه‌ای نمودار $h(x)=x^3$ شیب ۱۲ دارد؟

$h'(x) = 3x^2$ و باید $3x^2 = 12$ پس $x = 2$ (و $x=-2$).

**مثال ۴ (قاعدهٔ ضرب):** مشتق $y = x^2 \\sin x$

$y' = 2x\\sin x + x^2\\cos x$

**مثال ۵ (زنجیره‌ای):** مشتق $y = (2x+1)^5$

$y' = 5(2x+1)^4 \\times 2 = 10(2x+1)^4$

## ۵. کاربردهای واقعی

1. **فیزیک:** سرعت لحظه‌ای، شتاب
2. **اقتصاد:** حداکثرسازی سود
3. **مهندسی:** طراحی منحنی‌های ایمن جاده
4. **پزشکی:** مدل‌سازی رشد تومور

## ۶. اشتباه‌های رایج کنکوری

- فراموش‌کردن ضریب در قاعدهٔ زنجیره‌ای
- اشتباه گرفتن مشتق ضرب با ضرب مشتق‌ها
- توجه‌نکردن به دامنهٔ تابع لگاریتمی

## ۷. بازی فکری: سقوط آزاد و چتر نجات

سرعت جسم سقوط‌کننده: $v(t) = gt$؛ اگر چتر در ثانیهٔ سوم باز شود، شتاب ناگهانی تغییر می‌کند — نمودار سرعت شکسته می‌شود. نقطهٔ شکست، همان جایی است که مشتق وجود ندارد!

## جمع‌بندی شب امتحان

- مشتق = سرعت تغییر
- توان می‌آید ضربدر، توان یکی کم می‌شود
- شیب خط مماس = مقدار مشتق
- در قاعدهٔ زنجیره‌ای ضریب داخلی را فراموش نکنید

> ✍️ **تمرین:** مشتق $y = 5x^3 - 2x + 1$ را حساب کنید و پاسخ را در بخش نظرات بنویسید.`;

  const mashotFork = await db.pamphlet.create({
    data: {
      title: "مشتق و کاربردهای آن (نسخهٔ بهبودیافته)",
      description: "فورکی از جزوهٔ محمدرضا منتجبی با افزودن مثال بالن هلیومی، بازی فکری سقوط آزاد و مرور مثال‌های کنکوری.",
      grade: "دوازدهم", subject: "حسابان", chapter: "فصل ۲ — مشتق",
      teachingMethod: "مفهومی", difficulty: "متوسط",
      authorId: ali.id, forkedFromId: mashot.id, viewCount: 87,
      createdAt: daysAgo(14), updatedAt: daysAgo(9),
    },
  });
  await db.pamphletVersion.create({
    data: {
      pamphletId: mashotFork.id, versionNumber: 1, content: mashotForkContent,
      createdById: ali.id, createdAt: daysAgo(14), changeSummary: "فورک از جزوهٔ اصلی",
    },
  });
  await db.contribution.create({
    data: { pamphletId: mashotFork.id, userId: ali.id, score: Math.max(countContentLines(mashotForkContent), 10) },
  });

  // merged MR: علی → محمدرضا (مشتق)
  const mergedMR = await db.mergeRequest.create({
    data: {
      sourceId: mashotFork.id, targetId: mashot.id,
      title: "افزودن مثال بالن هلیومی و بازی فکری سقوط آزاد",
      description: "سلام استاد! با اجازه‌تان دو مثال ملموس (بالن هلیومی و سقوط آزاد با چتر) به جزوه اضافه کردم. دانش‌آموزان مفهوم مشتق را با این مثال‌ها بهتر حس می‌کنند. ممنون می‌شوم بررسی کنید.",
      status: "MERGED", createdById: ali.id,
      reviewedById: mohammad.id, reviewedAt: daysAgo(9),
      createdAt: daysAgo(11), updatedAt: daysAgo(9),
    },
  });
  // merged version on target (v3)
  const vCount = await db.pamphletVersion.count({ where: { pamphletId: mashot.id } });
  await db.pamphletVersion.create({
    data: {
      pamphletId: mashot.id, versionNumber: vCount + 1, content: mashotForkContent,
      createdById: ali.id, createdAt: daysAgo(9),
      changeSummary: "ادغام پیشنهاد علی رضایی: مثال بالن هلیومی + بازی فکری سقوط آزاد",
    },
  });
  const d1 = lineDiff(mashotV2, mashotForkContent);
  await db.contribution.create({
    data: { pamphletId: mashot.id, userId: ali.id, score: Math.max(d1.addedCount, 1) },
  });
  await db.pamphlet.update({ where: { id: mashot.id }, data: { updatedAt: daysAgo(9) } });

  console.log("🍴 fork + merged MR created");

  // ---------- open MR (سلول) ----------
  const cellForkContent = `# سلول: واحد حیات — ویرایش دانش‌آموزی

## شهر کوچک سلول

سلول را مثل یک شهر تصور کنید:

- **غشای پلاسمی:** دیوار شهر با دروازه‌های هوشمند
- **هستهٔ سلول:** شهرداری (مرکز تصمیم‌گیری)
- **میتوکندری:** نیروگاه شهر
- **ریبوزوم:** کارخانه‌های ساخت پروتئین
- **دستگاه گلژی:** ادارهٔ پست و بسته‌بندی
- **لیزوزوم:** تیم بازیافت زبالهٔ شهر

## غشای پلاسمی: مدل مایکِ فطیری

مدل فسفولیپیدی دولایه با پروتئین‌های شناور:

- **نفوذپذیری انتخابی:** همه چیز وارد نمی‌شود!
- انتقال غیرفعال (بدون انرژی): انتشار ساده، انتشار یاری‌شده، اسمز
- انتقال فعال (با انرژی ATP): پمپ سدیم-پتاسیم

## جدول تفاوت سلول گیاهی و جانوری

| ویژگی | گیاهی | جانوری |
|---|---|---|
| دیوارهٔ سلولی | دارد | ندارد |
| کلروپلاست | دارد | ندارد |
| واکوئل مرکزی | بزرگ | کوچک یا отсутствует |

## مقایسهٔ پروکاریوت و یوکاریوت

| ویژگی | پروکاریوت | یوکاریوت |
|---|---|---|
| هسته | ندارد | دارد |
| اندامک غشادار | ندارد | دارد |
| مثال | باکتری | سلول گیاهی و جانوری |

> 🔬 **نکتهٔ المپیادی:** همهٔ سلول‌ها ریبوزوم دارند؛ حتی پروکاریوت‌ها.
> 🔬 **نکتهٔ تکمیلی:** اسکلت سلولی (سیتوسکلتت) در هر دو نوع سلول یوکاریوتی وجود دارد و شامل ریزلوله‌ها، رشته‌های میانی و ریزرشته‌هاست.`;

  const cellFork = await db.pamphlet.create({
    data: {
      title: "سلول: واحد حیات (نسخهٔ تکمیل‌شده)",
      description: "فورکی از جزوهٔ خانم حسینی با افزودن لیزوزوم، جدول گیاهی/جانوری و نکتهٔ سیتواسکلت.",
      grade: "دهم", subject: "زیست‌شناسی", chapter: "فصل ۲ — سلول",
      teachingMethod: "مفهومی", difficulty: "مقدماتی",
      authorId: hossein.id, forkedFromId: cell.id, viewCount: 34,
      createdAt: daysAgo(3), updatedAt: daysAgo(3),
    },
  });
  await db.pamphletVersion.create({
    data: {
      pamphletId: cellFork.id, versionNumber: 1, content: cellForkContent,
      createdById: hossein.id, createdAt: daysAgo(3), changeSummary: "فورک از جزوهٔ اصلی",
    },
  });
  await db.contribution.create({
    data: { pamphletId: cellFork.id, userId: hossein.id, score: Math.max(countContentLines(cellForkContent), 10) },
  });
  const openMR = await db.mergeRequest.create({
    data: {
      sourceId: cellFork.id, targetId: cell.id,
      title: "افزودن لیزوزوم، جدول مقایسهٔ گیاهی/جانوری و نکتهٔ سیتواسکلت",
      description: "سلام خانم حسینی. من دانش‌آموی پایهٔ دوازدهم هستم و با جزوهٔ شما فصل سلول را خواندم. پیشنهاد می‌کنم لیزوزوم به لیست اندامک‌ها اضافه شود و جدول تفاوت سلول گیاهی و جانوری هم بیاید. یک نکتهٔ المپیادی دربارهٔ سیتواسکلت هم گذاشتم.",
      status: "OPEN", createdById: hossein.id,
      createdAt: daysAgo(2), updatedAt: daysAgo(2),
    },
  });

  // ---------- rejected MR (حرکت‌شناسی) ----------
  const rejectedFork = await db.pamphlet.create({
    data: {
      title: "حرکت‌شناسی: بانک تست (تغییر واحد نمودارها)",
      description: "نسخهٔ آزمایشی؛ تغییر فرمول‌بندی نمودارها.",
      grade: "دوازدهم", subject: "فیزیک", chapter: "فصل ۱ — حرکت‌شناسی",
      teachingMethod: "کنکوری", difficulty: "پیشرفته",
      authorId: hossein.id, forkedFromId: zahra.id ? (await db.pamphlet.findFirst({ where: { title: { startsWith: "حرکت‌شناسی" }, authorId: zahra.id } }))!.id : cell.id,
      viewCount: 12,
      createdAt: daysAgo(20), updatedAt: daysAgo(20),
    },
  });

  console.log("🍴 open + rejected MRs scaffolding done");

  // ---------- reviews ----------
  const reviews: { pamphletId: string; userId: string; rating: number; comment: string; days: number; helpful: number; unhelpful: number }[] = [
    { pamphletId: mashot.id, userId: hossein.id, rating: 5, comment: "بهترین جزوهٔ مشتقی که تا حالا خواندم! مثال ماشین واقعاً مفهوم را جا انداخت. فقط کاش تمرین‌های بیشتری از قاعدهٔ ضرب داشت.", days: 18, helpful: 24, unhelpful: 1 },
    { pamphletId: mashot.id, userId: ali.id, rating: 5, comment: "دقیق و مفهومی؛ ساختار درسی‌شده دارد. برای دانش‌آموزانی که از فرمول می‌ترسند عالی است.", days: 15, helpful: 11, unhelpful: 0 },
    { pamphletId: mashot.id, userId: fateme.id, rating: 4, comment: "جزوهٔ خوبی است، پیشنهاد می‌کنم بخش کاربرد پزشکی (رشد تومور) کمی باز شود.", days: 7, helpful: 6, unhelpful: 0 },
    { pamphletId: had.id, userId: hossein.id, rating: 5, comment: "شب امتحان نجاتم داد! ده تست طلایی دقیقاً مثل امتحان ما بود.", days: 22, helpful: 19, unhelpful: 2 },
    { pamphletId: had.id, userId: mohammad.id, rating: 4, comment: "خلاصه و کاربردی؛ برای مرور سریع فوق‌العاده اما جای مثال تشریحی بیشتر خالی است.", days: 20, helpful: 8, unhelpful: 0 },
  ];
  // extra reviews for other pamphlets
  const allP = await db.pamphlet.findMany();
  const byTitle = (t: string) => allP.find((p) => p.title.startsWith(t))!;
  const extras = [
    { p: byTitle("حرکت‌شناسی"), u: hossein.id, rating: 5, comment: "حل گام‌به‌گام تست‌ها فوق‌العاده است؛ نقشهٔ راه مطالعه هم خیلی کمک کرد.", days: 10, helpful: 14, unhelpful: 0 },
    { p: byTitle("استوکیومتری"), u: hossein.id, rating: 5, comment: "مثال آشپزی برای همیشه مادهٔ محدودکننده را در ذهنم حک کرد!", days: 12, helpful: 9, unhelpful: 0 },
    { p: byTitle("استوکیومتری"), u: mehdi.id, rating: 4, comment: "زبان روان و دوستانه؛ فقط بخش بازده واکنش کمی حجیم‌تر می‌تواند باشد.", days: 9, helpful: 4, unhelpful: 1 },
    { p: byTitle("حافظ"), u: sara.id, rating: 5, comment: "روایت داستانی غزل‌ها واقعاً ماندگار است؛ جدول تحلیل بیت هم کاربردی.", days: 8, helpful: 7, unhelpful: 0 },
    { p: byTitle("سلول"), u: hossein.id, rating: 4, comment: "تشبیه شهر برای اندامک‌ها عالی بود؛ منتظر نسخهٔ تکمیل‌شده هستم.", days: 5, helpful: 5, unhelpful: 0 },
    { p: byTitle("قضیهٔ فیثاغورس"), u: fateme.id, rating: 5, comment: "دوازده مثال پله‌پله طراحی شده؛ از آسان به سخت. ممنون از استاد منتجبی.", days: 6, helpful: 6, unhelpful: 0 },
    { p: byTitle("توابع نمایی"), u: mohammad.id, rating: 5, comment: "نکتهٔ تستی دامنهٔ لگاریتم دقیقاً همان چیزهایی است که در کنکور گریبان‌گیر می‌شود.", days: 4, helpful: 10, unhelpful: 0 },
  ];
  const allReviews = [...reviews, ...extras.map((e) => ({ pamphletId: e.p.id, userId: e.u, rating: e.rating, comment: e.comment, days: e.days, helpful: e.helpful, unhelpful: e.unhelpful }))];

  const createdReviews: Review[] = [];
  for (const r of allReviews) {
    const created = await db.review.create({
      data: {
        pamphletId: r.pamphletId, userId: r.userId, rating: r.rating, comment: r.comment,
        helpfulBase: r.helpful, unhelpfulBase: r.unhelpful,
        createdAt: daysAgo(r.days), updatedAt: daysAgo(r.days),
      },
    });
    createdReviews.push(created);
  }
  console.log(`⭐ ${createdReviews.length} reviews created`);

  // ---------- rejected MR data ----------
  const movP = byTitle("حرکت‌شناسی");
  await db.pamphlet.update({
    where: { id: rejectedFork.id },
    data: { forkedFromId: movP.id },
  });
  const movForkContent = `# حرکت‌شناسی: بانک تست (تغییر واحد نمودارها)

## خلاصهٔ تغیرات

- تبدیل تمام نمودارهای سرعت-زمان به نمودار مکان-زمان
- تغییر گام حل مسئله‌ها به فرم جدولی
- حذف بخش سقوط آزاد برای کوتاه‌شدن جزوه`;

  await db.pamphletVersion.create({
    data: {
      pamphletId: rejectedFork.id, versionNumber: 1, content: movForkContent,
      createdById: hossein.id, createdAt: daysAgo(20), changeSummary: "فورک آزمایشی",
    },
  });
  await db.contribution.create({
    data: { pamphletId: rejectedFork.id, userId: hossein.id, score: 10 },
  });
  await db.mergeRequest.create({
    data: {
      sourceId: rejectedFork.id, targetId: movP.id,
      title: "تغییر ساختار نمودارها و حذف سقوط آزاد",
      description: "پیشنهاد حذف بخش سقوط آزاد و تغییر نمودارها به شکل جدولی.",
      status: "REJECTED", createdById: hossein.id,
      reviewedById: zahra.id, reviewedAt: daysAgo(19),
      createdAt: daysAgo(20), updatedAt: daysAgo(19),
    },
  });
  console.log("❌ rejected MR created");

  // ===================== Phase 2 — Teaching Marketplace =====================
  console.log("🎓 Seeding Phase 2: marketplace, wallet, sessions, courses …");

  /** Tomorrow-ish at a Tehran wall-clock time (UTC+3:30). */
  const tehranAt = (days: number, hour: number, minute = 0) => {
    const d = new Date(Date.now() + days * 24 * 3600 * 1000);
    d.setUTCHours(hour - 3, minute - 30, 0, 0);
    return d;
  };

  /** Running wallet balances + chronological transaction log. */
  const balances = new Map<string, number>();
  const txnQueue: { userId: string; type: string; amount: number; description: string; at: Date; refType?: string; refId?: string; status?: string }[] = [];
  function addTxn(userId: string, opts: { type: string; amount: number; description: string; at: Date; refType?: string; refId?: string; status?: string }) {
    txnQueue.push({ userId, ...opts });
  }

  // ---------- deposits (all users, chronological story) ----------
  addTxn(mohammad.id, { type: "DEPOSIT", amount: 300_000, description: "شارژ کیف پول از درگاه بانکی", at: daysAgo(30) });
  addTxn(zahra.id, { type: "DEPOSIT", amount: 1_000_000, description: "شارژ کیف پول از درگاه بانکی", at: daysAgo(28) });
  addTxn(ali.id, { type: "DEPOSIT", amount: 300_000, description: "شارژ کیف پول از درگاه بانکی", at: daysAgo(25) });
  addTxn(hossein.id, { type: "DEPOSIT", amount: 1_000_000, description: "شارژ کیف پول از درگاه بانکی", at: daysAgo(25) });
  addTxn(sara.id, { type: "DEPOSIT", amount: 500_000, description: "شارژ کیف پول از درگاه بانکی", at: daysAgo(20) });
  addTxn(fateme.id, { type: "DEPOSIT", amount: 2_000_000, description: "شارژ کیف پول از درگاه بانکی", at: daysAgo(15) });
  addTxn(mehdi.id, { type: "DEPOSIT", amount: 300_000, description: "شارژ کیف پول از درگاه بانکی", at: daysAgo(18) });
  addTxn(hossein.id, { type: "DEPOSIT", amount: 400_000, description: "شارژ کیف پول از درگاه بانکی", at: daysAgo(2) });
  addTxn(hossein.id, { type: "DEPOSIT", amount: 2_500_000, description: "شارژ کیف پول از درگاه بانکی", at: daysAgo(7) });
  addTxn(mohammad.id, { type: "DEPOSIT", amount: 200_000, description: "شارژ کیف پول از درگاه بانکی", at: daysAgo(3) });

  // ---------- course purchases (20d..9d ago) ----------
  // course 1 (مشتق, mohammad, 380k): hossein + fateme
  addTxn(hossein.id, { type: "COURSE_PURCHASE", amount: -380_000, description: "خرید دورهٔ «حسابان دوازدهم: مشتق و کاربردها»", at: daysAgo(20) });
  addTxn(mohammad.id, { type: "COURSE_EARNING", amount: 304_000, description: "فروش دورهٔ «حسابان دوازدهم: مشتق و کاربردها» (کمیسیون پلتفرم: ۷۶٬۰۰۰ تومان)", at: daysAgo(20) });
  // course 2 (آمار, ali, 250k): sara
  addTxn(sara.id, { type: "COURSE_PURCHASE", amount: -250_000, description: "خرید دورهٔ «آمار و احتمال از صفر تا صد»", at: daysAgo(15) });
  addTxn(ali.id, { type: "COURSE_EARNING", amount: 200_000, description: "فروش دورهٔ «آمار و احتمال از صفر تا صد» (کمیسیون پلتفرم: ۵۰٬۰۰۰ تومان)", at: daysAgo(15) });
  // course 1 again: fateme (12d)
  addTxn(fateme.id, { type: "COURSE_PURCHASE", amount: -380_000, description: "خرید دورهٔ «حسابان دوازدهم: مشتق و کاربردها»", at: daysAgo(12) });
  addTxn(mohammad.id, { type: "COURSE_EARNING", amount: 304_000, description: "فروش دورهٔ «حسابان دوازدهم: مشتق و کاربردها» (کمیسیون پلتفرم: ۷۶٬۰۰۰ تومان)", at: daysAgo(12) });
  // course 4 (ادبیات, mehdi, 220k): hossein (9d)
  addTxn(hossein.id, { type: "COURSE_PURCHASE", amount: -220_000, description: "خرید دورهٔ «ادبیات دوازدهم: آرایه‌های ادبی و لایه‌های متن»", at: daysAgo(9) });
  addTxn(mehdi.id, { type: "COURSE_EARNING", amount: 176_000, description: "فروش دورهٔ «ادبیات دوازدهم: آرایه‌های ادبی و لایه‌های متن» (کمیسیون پلتفرم: ۴۴٬۰۰۰ تومان)", at: daysAgo(9) });

  // ---------- cancelled session (ali ↔ hossein, 9-8d ago; student cancelled in time → full refund) ----------
  addTxn(hossein.id, { type: "SESSION_PAYMENT", amount: -100_000, description: "رزرو جلسهٔ «آمار: احتمال شرطی» با علی رضایی", at: daysAgo(9) });
  addTxn(hossein.id, { type: "SESSION_REFUND", amount: 100_000, description: "بازگشت کامل وجه جلسهٔ لغوشده «آمار: احتمال شرطی»", at: daysAgo(8) });

  // ---------- completed session (zahra ↔ hossein, 6d ago 17:00, 60min, 90k) ----------
  addTxn(hossein.id, { type: "SESSION_PAYMENT", amount: -90_000, description: "رزرو جلسهٔ «مرور فصل حرکت‌شناسی قبل از امتحان» با زهرا احمدی", at: daysAgo(6) });
  addTxn(zahra.id, { type: "SESSION_EARNING", amount: 72_000, description: "درآمد برگزاری جلسهٔ «مرور فصل حرکت‌شناسی» (کمیسیون پلتفرم: ۱۸٬۰۰۰ تومان)", at: daysAgo(5) });

  // ---------- upcoming session (mohammad ↔ hossein, tomorrow 19:00, 60min, 120k) — classroom demo ----------
  addTxn(hossein.id, { type: "SESSION_PAYMENT", amount: -120_000, description: "رزرو جلسهٔ «حل تمرین مشتق — فصل ۲ حسابان» با محمدرضا منتجبی", at: daysAgo(1) });

  // flush txns chronologically so balanceAfter chains correctly
  txnQueue.sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const t of txnQueue) {
    const current = balances.get(t.userId) ?? 0;
    const status = t.status ?? "SUCCESS";
    const next = status === "SUCCESS" ? current + t.amount : current;
    balances.set(t.userId, next);
    await db.txn.create({
      data: {
        userId: t.userId, type: t.type, amount: t.amount, balanceAfter: next,
        description: t.description, status, refType: t.refType ?? null, refId: t.refId ?? null,
        createdAt: t.at,
      },
    });
  }
  // wallets
  for (const u of [mohammad, ali, zahra, sara, mehdi, fateme, hossein]) {
    await db.wallet.create({ data: { userId: u.id, balance: balances.get(u.id) ?? 0 } });
  }
  console.log("👛 wallets + txns created:", Object.fromEntries(balances));

  // ---------- open teacher slots (next 14 days, Tehran afternoons) ----------
  const slotSpecs: { teacher: typeof mohammad; days: number; hour: number; minute?: number; price: number; duration: number }[] = [
    // محمدرضا منتجبی — حسابان
    { teacher: mohammad, days: 1, hour: 17, price: 120_000, duration: 60 },
    { teacher: mohammad, days: 1, hour: 19, price: 120_000, duration: 60 },
    { teacher: mohammad, days: 2, hour: 17, price: 150_000, duration: 90 },
    { teacher: mohammad, days: 4, hour: 19, price: 120_000, duration: 60 },
    { teacher: mohammad, days: 6, hour: 17, price: 120_000, duration: 60 },
    { teacher: mohammad, days: 9, hour: 19, price: 150_000, duration: 90 },
    { teacher: mohammad, days: 11, hour: 17, price: 120_000, duration: 60 },
    // علی رضایی — ریاضی و آمار
    { teacher: ali, days: 1, hour: 16, price: 100_000, duration: 45 },
    { teacher: ali, days: 3, hour: 18, price: 100_000, duration: 60 },
    { teacher: ali, days: 5, hour: 16, price: 110_000, duration: 60 },
    { teacher: ali, days: 8, hour: 18, price: 100_000, duration: 60 },
    { teacher: ali, days: 10, hour: 16, price: 100_000, duration: 45 },
    // زهرا احمدی — فیزیک
    { teacher: zahra, days: 2, hour: 16, minute: 30, price: 90_000, duration: 60 },
    { teacher: zahra, days: 4, hour: 18, price: 95_000, duration: 60 },
    { teacher: zahra, days: 7, hour: 16, minute: 30, price: 90_000, duration: 45 },
    { teacher: zahra, days: 10, hour: 18, price: 95_000, duration: 60 },
    { teacher: zahra, days: 13, hour: 16, minute: 30, price: 90_000, duration: 60 },
    // سارا محمدی — شیمی
    { teacher: sara, days: 1, hour: 18, price: 110_000, duration: 60 },
    { teacher: sara, days: 3, hour: 17, price: 110_000, duration: 60 },
    { teacher: sara, days: 6, hour: 18, price: 120_000, duration: 90 },
    { teacher: sara, days: 9, hour: 17, price: 110_000, duration: 60 },
    // مهدی کریمی — ادبیات
    { teacher: mehdi, days: 2, hour: 17, price: 95_000, duration: 60 },
    { teacher: mehdi, days: 5, hour: 19, price: 95_000, duration: 60 },
    { teacher: mehdi, days: 8, hour: 17, price: 100_000, duration: 60 },
    { teacher: mehdi, days: 12, hour: 19, price: 95_000, duration: 45 },
    // فاطمه حسینی — زیست
    { teacher: fateme, days: 1, hour: 15, price: 130_000, duration: 60 },
    { teacher: fateme, days: 3, hour: 16, price: 130_000, duration: 60 },
    { teacher: fateme, days: 6, hour: 15, price: 140_000, duration: 90 },
    { teacher: fateme, days: 11, hour: 16, price: 130_000, duration: 60 },
  ];
  const slotIds: Record<string, string> = {};
  for (const s of slotSpecs) {
    const startAt = tehranAt(s.days, s.hour, s.minute ?? 0);
    const created = await db.teacherSlot.create({
      data: {
        teacherId: s.teacher.id, startAt, durationMinutes: s.duration, price: s.price,
        status: "OPEN", createdAt: daysAgo(2),
      },
    });
    slotIds[`${s.teacher.id}:${startAt.toISOString()}`] = created.id;
  }
  console.log(`📅 ${slotSpecs.length} open slots created`);

  // ---------- class sessions ----------
  // 1) completed: zahra ↔ hossein (6d ago 17:00)
  const doneStart = tehranAt(-6, 17);
  const doneSlot = await db.teacherSlot.create({
    data: {
      teacherId: zahra.id, startAt: doneStart, durationMinutes: 60, price: 90_000,
      status: "BOOKED", createdAt: daysAgo(8),
    },
  });
  const doneSession = await db.classSession.create({
    data: {
      slotId: doneSlot.id, teacherId: zahra.id, studentId: hossein.id,
      startAt: doneStart, endAt: new Date(doneStart.getTime() + 60 * 60_000),
      durationMinutes: 60, price: 90_000, teacherShare: 72_000, commission: 18_000,
      status: "COMPLETED", meetingCode: "ZD7K2P", topic: "مرور فصل حرکت‌شناسی قبل از امتحان",
      createdAt: daysAgo(8), updatedAt: daysAgo(5),
    },
  });
  const doneMsgs: { sender: string; body: string; mins: number }[] = [
    { sender: hossein.id, body: "سلام خانم احمدی، جلسهٔ امشب ساعت ۱۷ درست است؟", mins: -8 },
    { sender: zahra.id, body: "سلام حسین جان، بله. نمودارهای سرعت-زمان را که فرستادم حل کن بیاور.", mins: -7 },
    { sender: hossein.id, body: "حل کردم! فقط سؤال ۴ را مشکل دارم؛ همان‌جا می‌پرسم.", mins: -6 },
    { sender: zahra.id, body: "جلسهٔ خوبی بود؛ سؤال ۴ را هم کامل بحث کردیم. برای امتحان آماده‌ای.", mins: 95 },
  ];
  for (const m of doneMsgs) {
    await db.sessionMessage.create({
      data: { sessionId: doneSession.id, senderId: m.sender, body: m.body, createdAt: new Date(doneStart.getTime() + m.mins * 60_000) },
    });
  }
  await db.sessionReview.create({
    data: {
      sessionId: doneSession.id, userId: hossein.id, rating: 5,
      comment: "خانم احمدی با صبر و حوصلهٔ فراوان توضیح می‌دهد و قبل از هر سؤال، مفهوم را کامل جا می‌اندازد. نمودارها را روی تختهٔ تعاملی می‌کشید و قدم‌به‌قدم پیش می‌رفت. کلاس فوق‌العاده‌ای بود.",
      createdAt: daysAgo(4), updatedAt: daysAgo(4),
    },
  });

  // 2) cancelled by student: ali ↔ hossein (8d ago, refunded)
  const cxStart = tehranAt(-8, 18);
  const cxSlot = await db.teacherSlot.create({
    data: { teacherId: ali.id, startAt: cxStart, durationMinutes: 45, price: 100_000, status: "BOOKED", createdAt: daysAgo(10) },
  });
  await db.classSession.create({
    data: {
      slotId: cxSlot.id, teacherId: ali.id, studentId: hossein.id,
      startAt: cxStart, endAt: new Date(cxStart.getTime() + 45 * 60_000),
      durationMinutes: 45, price: 100_000, teacherShare: 80_000, commission: 20_000,
      status: "CANCELLED_STUDENT", meetingCode: "AL3N9Q", topic: "آمار: احتمال شرطی",
      createdAt: daysAgo(10), updatedAt: daysAgo(8),
    },
  });

  // 3) upcoming (classroom demo): mohammad ↔ hossein, tomorrow 19:00
  const upStart = tehranAt(1, 19);
  const upSlot = await db.teacherSlot.create({
    data: { teacherId: mohammad.id, startAt: upStart, durationMinutes: 60, price: 120_000, status: "BOOKED", createdAt: daysAgo(3) },
  });
  const upSession = await db.classSession.create({
    data: {
      slotId: upSlot.id, teacherId: mohammad.id, studentId: hossein.id,
      startAt: upStart, endAt: new Date(upStart.getTime() + 60 * 60_000),
      durationMinutes: 60, price: 120_000, teacherShare: 96_000, commission: 24_000,
      status: "BOOKED", meetingCode: "MT4G8S", topic: "حل تمرین مشتق — فصل ۲ حسابان",
      createdAt: daysAgo(1), updatedAt: daysAgo(1),
    },
  });
  await db.sessionMessage.create({
    data: { sessionId: upSession.id, senderId: hossein.id, body: "سلام استاد منتجبی. برای جلسهٔ فردا تمرین‌های صفحهٔ ۴۲ را حل کرده‌ام؛ فقط سؤال‌های ترکیبی مشکل دارند.", createdAt: daysAgo(1) },
  });
  await db.sessionMessage.create({
    data: { sessionId: upSession.id, senderId: mohammad.id, body: "عالیه حسین. سه تست سخت هم از بانک کنکور می‌آورم. فردا ساعت ۱۹ منتظرت هستم.", createdAt: daysAgo(1) },
  });
  console.log("🏫 3 class sessions created (1 completed + review, 1 cancelled, 1 upcoming)");

  // ---------- video courses ----------
  async function makeCourse(opts: {
    teacher: typeof mohammad; title: string; description: string; grade: string; subject: string;
    level?: string; price: number; cover: string; video: string; days: number;
    lessons: { title: string; minutes: number; free?: boolean; description?: string }[];
  }) {
    const c = await db.videoCourse.create({
      data: {
        teacherId: opts.teacher.id, title: opts.title, description: opts.description,
        grade: opts.grade, subject: opts.subject, level: opts.level ?? null,
        price: opts.price, coverUrl: opts.cover, status: "PUBLISHED",
        createdAt: daysAgo(opts.days), updatedAt: daysAgo(opts.days),
      },
    });
    let order = 1;
    for (const l of opts.lessons) {
      await db.videoLesson.create({
        data: {
          courseId: c.id, order: order++, title: l.title, description: l.description ?? null,
          videoUrl: opts.video, durationMinutes: l.minutes, isFreePreview: l.free ?? false,
        },
      });
    }
    return c;
  }

  const course1 = await makeCourse({
    teacher: mohammad, title: "حسابان دوازدهم: مشتق و کاربردها — دورهٔ جامع",
    description: "از مفهوم شیب تا تست‌های ترکیبی کنکور؛ شش درس ویدیویی با تمرین پایان هر جلسه. اگر جزوهٔ مشتق را خوانده‌اید، این دوره مرحلهٔ بعدی شماست.",
    grade: "دوازدهم", subject: "حسابان", level: "متوسط", price: 380_000,
    cover: "/courses/cover-calculus.png", video: "/videos/lesson-calculus.mp4", days: 40,
    lessons: [
      { title: "مفهوم مشتق: شیب خط مماس", minutes: 12, free: true, description: "شروع با مثال سرعت خودرو؛ حد به‌عنوان شیب." },
      { title: "قاعدهٔ توان و قاعدهٔ ضرب", minutes: 10 },
      { title: "قاعدهٔ زنجیره‌ای", minutes: 14, description: "سه مثال پله‌پله از ساده تا ترکیبی." },
      { title: "مشتق توابع مثلثاتی", minutes: 11 },
      { title: "کاربرد: بیشینه و کمینه", minutes: 13 },
      { title: "جمع‌بندی و تست‌های کنکور", minutes: 15 },
    ],
  });
  const course2 = await makeCourse({
    teacher: ali, title: "آمار و احتمال از صفر تا صد",
    description: "برای دانش‌آموزانی که از آمار می‌ترسند؛ با نمودار درختی، مثال‌های روزمره و تحلیل دادهٔ واقعی.",
    grade: "یازدهم", subject: "آمار و احتمال", level: "مقدماتی", price: 250_000,
    cover: "/courses/cover-statistics.png", video: "/videos/lesson-statistics.mp4", days: 35,
    lessons: [
      { title: "آمار توصیفی در یک نگاه", minutes: 9, free: true },
      { title: "احتمال ساده و نمودار درختی", minutes: 11 },
      { title: "احتمال شرطی", minutes: 13 },
      { title: "ترکیب و جایگشت", minutes: 12 },
      { title: "تحلیل داده و آزمون آزمایشی", minutes: 10 },
    ],
  });
  const course3 = await makeCourse({
    teacher: fateme, title: "زیست‌شناسی: سلول در یک نگاه",
    description: "فصل سلول با تشبیه شهر و تصویرسازی ذهنی؛ همراه با تست‌های کنکور سری اخیر.",
    grade: "دهم", subject: "زیست‌شناسی", level: "متوسط", price: 190_000,
    cover: "/courses/cover-science.png", video: "/videos/lesson-science.mp4", days: 28,
    lessons: [
      { title: "سلول در یک نگاه: دنیای شگفت‌انگیز", minutes: 8, free: true },
      { title: "اندامک‌های سلولی و وظایفشان", minutes: 12 },
      { title: "تبادلات سلولی: نفوذ و اسمز", minutes: 11 },
      { title: "تست‌های کنکوری فصل سلول", minutes: 14 },
    ],
  });
  const course4 = await makeCourse({
    teacher: mehdi, title: "ادبیات دوازدهم: آرایه‌های ادبی و لایه‌های متن",
    description: "آرایه‌ها را نه حفظ کن، بفهم؛ روایت‌محور و همراه با تحلیل گام‌به‌گام غزل‌های حافظ.",
    grade: "دوازدهم", subject: "ادبیات فارسی", level: "متوسط", price: 220_000,
    cover: "/courses/cover-literature.png", video: "/videos/lesson-literature.mp4", days: 22,
    lessons: [
      { title: "چیستی آرایه‌های ادبی", minutes: 9, free: true },
      { title: "تشبیه و استعاره در غزل حافظ", minutes: 12 },
      { title: "کنایه و مجاز: مرز ظریف", minutes: 10 },
      { title: "لایه‌های متن و نقد ادبی", minutes: 13 },
      { title: "تحلیل یک غزل، گام‌به‌گام", minutes: 15 },
    ],
  });
  const course5 = await makeCourse({
    teacher: mohammad, title: "هندسهٔ یازدهم: تبدیل‌های هندسی",
    description: "دورهٔ رایگان جامعه‌محور؛ چرخش، انتقال و تقارن با انیمیشن و مسائل کنکور.",
    grade: "یازدهم", subject: "هندسه", level: "مقدماتی", price: 0,
    cover: "/courses/cover-geometry.png", video: "/videos/lesson-geometry.mp4", days: 15,
    lessons: [
      { title: "تبدیل‌های هندسی: چرخش", minutes: 10, free: true },
      { title: "انتقال و تقارن", minutes: 11 },
      { title: "ترکیب تبدیل‌ها و مسائل کنکور", minutes: 12 },
    ],
  });
  console.log("🎬 5 video courses created");

  // ---------- enrollments (paid + free) ----------
  await db.courseEnrollment.create({ data: { courseId: course1.id, studentId: hossein.id, price: 380_000, createdAt: daysAgo(20) } });
  await db.courseEnrollment.create({ data: { courseId: course1.id, studentId: fateme.id, price: 380_000, createdAt: daysAgo(12) } });
  await db.courseEnrollment.create({ data: { courseId: course2.id, studentId: sara.id, price: 250_000, createdAt: daysAgo(15) } });
  await db.courseEnrollment.create({ data: { courseId: course4.id, studentId: hossein.id, price: 220_000, createdAt: daysAgo(9) } });
  await db.courseEnrollment.create({ data: { courseId: course5.id, studentId: sara.id, price: 0, createdAt: daysAgo(5) } });
  await db.courseEnrollment.create({ data: { courseId: course5.id, studentId: fateme.id, price: 0, createdAt: daysAgo(10) } });

  // ---------- lesson progress ----------
  async function watch(courseId: string, userId: string, orders: number[]) {
    const lessons = await db.videoLesson.findMany({ where: { courseId }, select: { id: true, order: true } });
    for (const l of lessons.filter((x) => orders.includes(x.order))) {
      await db.lessonProgress.create({ data: { lessonId: l.id, userId, watched: true, watchedAt: daysAgo(3) } });
    }
  }
  await watch(course1.id, hossein.id, [1, 2, 3]); // 3/6
  await watch(course1.id, fateme.id, [1]); // 1/6
  await watch(course2.id, sara.id, [1, 2]); // 2/5
  await watch(course4.id, hossein.id, [1]); // 1/5
  await watch(course5.id, sara.id, [1]); // 1/3
  await watch(course5.id, fateme.id, [1, 2, 3]); // 3/3

  // ---------- course reviews (enrolled users only) ----------
  const courseReviews: { courseId: string; userId: string; rating: number; comment: string; days: number }[] = [
    { courseId: course1.id, userId: hossein.id, rating: 5, comment: "ویدیوهای مشتق واقعاً گرهٔ ذهنم را باز کرد؛ مخصوصاً درس قاعدهٔ زنجیره‌ای که با سه مثال پله‌پله توضیح داده شده. تمرین‌های پایان هر درس دقیقاً هم‌سطح کنکور است.", days: 18 },
    { courseId: course1.id, userId: fateme.id, rating: 4, comment: "ساختار درس‌ها مرتب و روان است. کاش ویدیوهای بیشتری از کاربردهای زیستی مشتق داشت.", days: 10 },
    { courseId: course2.id, userId: sara.id, rating: 5, comment: "به‌عنوان یک دبیر شیمی از آمار هیچ سر در نمی‌آوردم؛ این دوره مرا برای تحلیل نمره‌های کلاسم آماده کرد. نمودار درختی احتمال فوق‌العاده بود.", days: 12 },
    { courseId: course4.id, userId: hossein.id, rating: 5, comment: "آقای کریمی ادبیات را مثل یک داستان روایت می‌کنند. حالا آرایه‌ها را نه حفظ می‌کنم، می‌فهمم.", days: 7 },
    { courseId: course5.id, userId: sara.id, rating: 4, comment: "دورهٔ رایگان اما باکیفیت دوره‌های پولی! فقط کاش تعداد تمرین‌ها بیشتر بود.", days: 4 },
    { courseId: course5.id, userId: fateme.id, rating: 5, comment: "تبدیل‌های هندسی همیشه برایم ترسناک بود؛ حالا یکی از مباحث مورد علاقه‌ام است. ممنون از استاد منتجبی.", days: 9 },
  ];
  for (const r of courseReviews) {
    await db.courseReview.create({
      data: { courseId: r.courseId, userId: r.userId, rating: r.rating, comment: r.comment, createdAt: daysAgo(r.days), updatedAt: daysAgo(r.days) },
    });
  }

  // ===================== P13 — Seed Expansion =====================
  // Additive content: 26+ pamphlets, 10+ exams, 10 courses, 28 slots,
  // 5 sessions — all authored (no filler), all deterministic relative to now.
  // NOTE: the main txnQueue was flushed above, so new transactions apply
  // directly to wallets here (read-modify-write per row).

  /** Create a txn row and move the wallet balance in the same order. */
  async function applyTxn(userId: string, opts: { type: string; amount: number; description: string; at: Date; refType?: string; refId?: string }) {
    const wallet = await db.wallet.findUnique({ where: { userId }, select: { id: true, balance: true } });
    const balanceAfter = (wallet?.balance ?? 0) + opts.amount;
    await db.txn.create({
      data: {
        userId, type: opts.type, amount: opts.amount, balanceAfter,
        description: opts.description, status: "SUCCESS",
        refType: opts.refType ?? null, refId: opts.refId ?? null, createdAt: opts.at,
      },
    });
    if (wallet) {
      await db.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter } });
    }
  }

  // ---------- pamphlet expansion (26 more) ----------
  const p13Pamphlets: Parameters<typeof makePamphlet>[0][] = [
    {
      title: "توابع مثلثاتی: از دایرهٔ مثلثاتی تا معادلات",
      description: "همهٔ روابط مثلثاتی روی یک دایرهٔ واحد؛ معادله‌های سینوسی و تست‌های کنکور با حل کامل.",
      grade: "دوازدهم", subject: "حسابان", chapter: "فصل ۲ — توابع",
      method: "کنکوری", difficulty: "پیشرفته", authorId: ali.id, createdAt: daysAgo(38), viewCount: 233,
      content: `# توابع مثلثاتی: از دایره تا معادله

## دایرهٔ مثلثاتی: نقشهٔ کلی

روی دایرهٔ واحد، هر زاویهٔ $\\theta$ نقطهٔ $(\\cos\\theta, \\sin\\theta)$ را می‌دهد.

$$\\sin^2\\theta + \\cos^2\\theta = 1$$

## روابط مکمل

| رابطه | فرمول |
|---|---|
| تانژانت | $\\tan\\theta = \\frac{\\sin\\theta}{\\cos\\theta}$ |
| مکمل | $\\sin(90-\\theta) = \\cos\\theta$ |
| جمع | $\\sin(a+b) = \\sin a\\cos b + \\cos a\\sin b$ |

## معادلهٔ سینوسی

$$\\sin\\theta = \\frac{1}{2} \\Rightarrow \\theta = 30° \\text{ یا } 150° \\; (0 \\le \\theta \\le 180°)$$

**تست کنکور:** همهٔ جواب‌های $\\sin x = -\\frac{\\sqrt{3}}{2}$ در بازهٔ $[0, 360°]$؟

پاسخ: $x = 240°$ و $x = 300°$ — علامت منفی یعنی نیم‌ساعد پایین (سوم و چهارم).

> ⚡ **جمع‌بندی:** علامت تابع را از ربع تعیین کنید؛ همیشه یک دور کامل $360°$ به جواب اضافه کنید.`,
    },
    {
      title: "آمار: واریانس و انحراف معیار به زبان ساده",
      description: "پراکندگی داده‌ها را با مثال نمره‌های دو کلاس بفهمید؛ فرمول‌ها و محاسبهٔ گام‌به‌گام.",
      grade: "یازدهم", subject: "آمار و احتمال", chapter: "فصل ۱ — آمار توصیفی",
      method: "مفهومی", difficulty: "مقدماتی", authorId: ali.id, createdAt: daysAgo(33), viewCount: 176,
      content: `# واریانس و انحراف معیار

## دو کلاس، یک میانگین

کلاس الف نمره‌ها: ۱۴، ۱۵، ۱۶ (میانگین ۱۵) — کلاس ب: ۱۰، ۱۵، ۲۰ (میانگین ۱۵).

میانگین یکسان است، اما کلاس ب «پراکنده‌تر» است. اندازهٔ این پراکندگی = **واریانس**.

## محاسبه

$$\\sigma^2 = \\frac{\\sum (x_i - \\bar{x})^2}{n}$$

کلاس الف: $\\frac{(14-15)^2 + 0 + (16-15)^2}{3} = \\frac{2}{3}$

کلاس ب: $\\frac{25 + 0 + 25}{3} = \\frac{50}{3}$ — واریانس بزرگ‌تر ✓

## انحراف معیار

$$\\sigma = \\sqrt{\\sigma^2}$$

جذر واریانس تا واحد با داده هم‌اندازه شود. کلاس الف: $\\sigma \\approx 0.8$، کلاس ب: $\\sigma \\approx 4.1$.

> 📊 **جمع‌بندی:** میانگین می‌گوید «کجا»؛ انحراف معیار می‌گوید «چقدر پخش». هر دو را با هم بخوانید.`,
    },
    {
      title: "دایره: زاویهٔ مرکزی، محاطی و قوس",
      description: "قضیه‌های دایره با اثبات ساده و مثال‌های گام‌به‌گام؛ فصل دایرهٔ هندسهٔ یازدهم.",
      grade: "یازدهم", subject: "هندسه", chapter: "فصل ۳ — دایره",
      method: "مفهومی", difficulty: "متوسط", authorId: mohammad.id, createdAt: daysAgo(31), viewCount: 204,
      content: `# دایره: زاویه‌ها و قوس

## قضیهٔ زاویهٔ محاطی

زاویهٔ محاطی نصف زاویهٔ مرکزی روی همان قوس است:

$$\\angle BAC = \\frac{1}{2} \\angle BOC$$

**اثبات در یک خط:** مثلث $OAB$ متساوی‌الساقین است ($OA = OB$ شعاع)؛ جمع زاویه‌ها قضیه را می‌دهد.

## کاربرد: نیم‌دایره = قائمه

هر زاویهٔ محاطی روی قوس نیم‌دایره، $90°$ است (زاویهٔ مرکزی $180°$).

**مثال:** اگر $\\angle BOC = 100°$، آنگاه $\\angle BAC = 50°$ و زاویهٔ مقابل در چهارضلعی محاطی $= 130°$.

## طول قوس

$$L = \\frac{\\theta}{360°} \\times 2\\pi r$$

قوس $60°$ در شعاع ۳: $L = \\frac{1}{6} \\times 6\\pi = \\pi$

> 📐 **تمرین:** در دایره‌ای به شعاع ۵، طول وتر روبروی زاویهٔ مرکزی $120°$ چند است؟ (راهنما: قانون کسینوس‌ها)`,
    },
    {
      title: "اعداد گنگ: از مربع پیتاگوراس تا خط اعداد",
      description: "داستان کشف $\\sqrt{2}$ و راز جذرهای گنگ؛ عددی که مرگ‌آورد شد!",
      grade: "نهم", subject: "ریاضی", chapter: "فصل ۱ — اعداد حقیقی",
      method: "داستان‌محور", difficulty: "مقدماتی", authorId: mohammad.id, createdAt: daysAgo(29), viewCount: 167,
      content: `# اعداد گنگ: عددی که کشت

## داستان هیپاسوس

فیثاغوریسی‌ها باور داشتند هر عدد کسری است. سپس هیپاسوس قطر مربع واحد را اندازه گرفت: $\\sqrt{2}$. این عدد هیچ‌گاه به صورت کسر نوشته نمی‌شود — و افسانه است که او را به دریا انداختند!

## اثبات گنگ بودن $\\sqrt{2}$

فرض کنید $\\sqrt{2} = \\frac{a}{b}$ با کسر ساده‌شده:

$$2b^2 = a^2$$

پس $a^2$ زوج است ← $a$ زوج ← $a = 2k$ ← $b^2 = 2k^2$ ← $b$ هم زوج! تناقض با «ساده‌شده». پس $\\sqrt{2}$ گنگ است. ∎

## نمایش روی خط اعداد

$\\sqrt{2}$ = قطر مربع ۱×۱؛ با پرگار می‌شود آن را روی محور چرخاند.

$\\sqrt{5}$ = قطر مستطیل ۱×۲ — همین ترفند برای هر جذر!

> 🔢 **تمرین:** با همین روش ثابت کنید $\\sqrt{3}$ گنگ است.`,
    },
    {
      title: "احتمال شرطی و استقلال — با مثال‌های پزشکی",
      description: "P(A|B) را با آزمایش‌های پزشکی و درخت احتمال بفهمید؛ پایهٔ شیر یا خط‌های واقعی.",
      grade: "دوازدهم", subject: "آمار و احتمال", chapter: "فصل ۲ — احتمال",
      method: "مثال‌محور", difficulty: "متوسط", authorId: ali.id, createdAt: daysAgo(27), viewCount: 189,
      content: `# احتمال شرطی: وقتی اطلاعات، احتمال را عوض می‌کند

## تعریف

$$P(A|B) = \\frac{P(A \\cap B)}{P(B)}$$

یعنی: «با دانستن B، احتمال A چقدر است؟»

## مثال پزشکی (سنتز واقعی)

آزمایشی ۹۹٪ دقیق است. بیماری در ۱ نفر از هر ۱۰۰۰ نفر هست. اگر تست مثبت شد، احتمال بیماری چقدر است؟

درخت احتمال روی ۱۰۰٬۰۰۰ نفر:
- بیمار: ۱۰۰ نفر → تست مثبت برای ۹۹ نفر
- سالم: ۹۹٬۹۰۰ نفر → تست مثبت برای ۹۹۹ نفر

$$P(\\text{بیماری}|+) = \\frac{99}{99+999} \\approx 9\\%$$

فقط ۹٪! این «تناقض آزمایش پزشکی» است — پایهٔ کم بودن اخبار نگران‌کننده.

## استقلال

A و B مستقل‌اند اگر $P(A \\cap B) = P(A)P(B)$؛ یعنی دانستن یکی، دیگری را عوض نکند.

> 🎲 **تمرین:** دو سکه پرتاب می‌شود. اگر حداقل یکی رو باشد، احتمال اینکه هر دو رو باشند؟`,
    },
    {
      title: "انتگرال معکوس: جست‌وجوی تابع اصلی",
      description: "از مساحت زیر نمودار تا پادترکیب مشتق؛ دروازهٔ ورود به انتگرال‌گیری.",
      grade: "دوازدهم", subject: "حسابان", chapter: "فصل ۴ — انتگرال",
      method: "مفهومی", difficulty: "پیشرفته", authorId: mohammad.id, createdAt: daysAgo(24), viewCount: 258,
      content: `# انتگرال معکوس: پادمششتق

## ایدهٔ مرکزی

مشتق «سرعت تغییر» بود. انتگرال معکوس می‌پرسد: چه تابعی مشتقش $2x$ است؟ پاسخ: $x^2$ (به‌علاوهٔ یک عدد دلخواه).

$$\\int 2x\\,dx = x^2 + C$$

## جدول پایه

| تابع | انتگرال معکوس |
|---|---|
| $x^n \\; (n \\ne -1)$ | $\\frac{x^{n+1}}{n+1} + C$ |
| $\\frac{1}{x}$ | $\\ln|x| + C$ |
| $\\cos x$ | $\\sin x + C$ |
| $e^x$ | $e^x + C$ |

## مثال حل‌شده

$$\\int (3x^2 - 4x + 5)\\,dx = x^3 - 2x^2 + 5x + C$$

چک: مشتق بگیرید — باید به صورت برگردد. همیشه چک کنید!

## مساحت زیر نمودار

$$\\int_0^3 x^2\\,dx = \\left[\\frac{x^3}{3}\\right]_0^3 = 9$$

> 📏 **جمع‌بندی:** انتگرال معکوس = مساحت انباشته؛ حد بالا و پایین ثابت C را حذف می‌کنند.`,
    },
    {
      title: "کار، انرژی جنبشی و توان — با مثال پله و آسانسور",
      description: "قضیهٔ کار و انرژی را با بالا رفتن از پله بفهمید؛ محاسبات واقعی با اعداد فارسی.",
      grade: "دهم", subject: "فیزیک", chapter: "فصل ۴ — کار و انرژی",
      method: "مفهومی", difficulty: "مقدماتی", authorId: zahra.id, createdAt: daysAgo(26), viewCount: 145,
      content: `# کار، انرژی جنبشی و توان

## کار یعنی چه؟

فقط وقتی «کار» انجام شده که جابه‌جایی در راستای نیرو باشد:

$$W = F \\cdot d \\cdot \\cos\\theta$$

کتاب را بالای سر نگه دارید؟ خسته می‌شوید اما کار فیزیکی صفر است — جابه‌جایی صفر است!

## انرژی جنبشی و قضیهٔ طلایی

$$E_k = \\frac{1}{2}mv^2 \\qquad W_{\\text{کل}} = \\Delta E_k$$

**مثال:** اتومبیلی ۱۰۰۰ کیلوگرمی از سرعت ۱۰ به ۲۰ متر بر ثانیه می‌رسد. کار موتور؟

$\\Delta E_k = \\frac{1}{2}(1000)(400 - 100) = 150{,}000$ ژول

## توان: سرعت انجام کار

$$P = \\frac{W}{t}$$

بالا رفتن از ۲۰ پلهٔ ۱۷ سانتی‌متری با وزن ۶۰ کیلوگرم در ۱۰ ثانیه:

$W = mgh = 60 \\times 10 \\times 3.4 = 2040$ ژول ← $P \\approx 204$ وات

> ⚡ **نکته:** توان موتورهای خانگی هم با همین فرمول است؛ یک اسب بخار ≈ ۷۴۶ وات.`,
    },
    {
      title: "اندازه‌گیری و روش علمی: خطا را جدی بگیرید",
      description: "دقت خط‌کش و ترازو، خطای نسبت‌دار و نمودار آزمایش — شروع درست علوم نهم.",
      grade: "نهم", subject: "علوم", chapter: "فصل ۱ — اندازه‌گیری",
      method: "مثال‌محور", difficulty: "مقدماتی", authorId: zahra.id, createdAt: daysAgo(23), viewCount: 112,
      content: `# اندازه‌گیری: علم بدون خطا نیست

## هر اندازه‌گیری دو بخش دارد

عدد + خطا. خط‌کش میلی‌متری: طول مداد = ۱۷٫۴ ± ۰٫۰۵ سانتی‌متر.

## خطای نسبی

$$\\text{خطای نسبی} = \\frac{\\text{خطا}}{\\text{اندازه‌گیری}} \\times 100$$

اندازهٔ یک پشهٔ ۵ میلی‌متری با خطای ۰٫۵ میلی‌متر؟ خطای نسبی ۱۰٪ — فاجعه!
اندازهٔ کلاس ۵ متری با همان خطا؟ ۰٫۰۱٪ — عالی!

## روش علمی در پنج گام

۱. مشاهده → ۲. فرضیهٔ آزمون‌پذیر → ۳. آزمایش کنترل‌شده → ۴. تحلیل داده → ۵. نتیجه و اصلاح فرضیه

فرضیه‌ای که رد شود هم «موفقیت» است — علم با رد شدن پیش می‌رود.

## نمودار آزمایش

محور افقی: متغیر مستقل (کاری که ما می‌کنیم). محور عمودی: متغیر وابسته (نتیجهٔ اندازه‌گیری‌شده). همیشه عنوان، واحد و مقیاس بنویسید.

> 🔬 **آزمایش کلاسی:** زمان سقوط اجسام سبک و سنگین از یک ارتفاع را ۵ بار اندازه بگیرید و میانگین بگیرید.`,
    },
    {
      title: "مدارهای سری و موازی: جریان کجا می‌رود؟",
      description: "قانون اهم، مقایسهٔ سری/موازی با چراغ‌های خانه و حل مدارهای ترکیبی.",
      grade: "یازدهم", subject: "فیزیک", chapter: "فصل ۳ — الکتریسیته",
      method: "حل تمرین", difficulty: "متوسط", authorId: zahra.id, createdAt: daysAgo(21), viewCount: 167,
      content: `# مدارهای سری و موازی

## قانون اهم: قلب مدار

$$V = IR$$

## سری: یک مسیر

$R_{\\text{کل}} = R_1 + R_2 + \\cdots$ — جریان همه‌جا برابر، ولتاژ تقسیم می‌شود.

یک چراغ بسوزد؟ همه خاموش می‌شوند — رشتهٔ قدیمی چراغ‌های کارت‌پستالی!

## موازی: چند مسیر

$$\\frac{1}{R_{\\text{کل}}} = \\frac{1}{R_1} + \\frac{1}{R_2}$$

ولتاژ همه‌جا برابر، جریان تقسیم می‌شود. خانهٔ شما موازی است — یک لامپ خاموش، بقیه روشن!

## مثال حل‌شده

دو مقاومت ۶ و ۳ اهم موازی: $\\frac{1}{R} = \\frac{1}{6} + \\frac{1}{3} = \\frac{1}{2} \\Rightarrow R = 2\\;\\Omega$

با منبع ۱۲ ولت: $I = \\frac{12}{2} = 6$ آمپر (شاخهٔ ۶ اهم: ۲ آمپر، شاخهٔ ۳ اهم: ۴ آمپر).

> 💡 **ترفند:** موازی همیشه مقاومت کل را کوچک‌تر از کوچک‌ترین مقاومت می‌کند.`,
    },
    {
      title: "جدول تناوبی: نقشهٔ گنج مندلیف",
      description: "داستان رؤیای مندلیف و پیش‌بینی‌های درستش؛ چگونگی خواندن جدول و ریزترتیب‌ها.",
      grade: "دهم", subject: "شیمی", chapter: "فصل ۲ — جدول تناوبی",
      method: "داستان‌محور", difficulty: "مقدماتی", authorId: sara.id, createdAt: daysAgo(20), viewCount: 158,
      content: `# جدول تناوبی: نقشهٔ گنج

## رؤیای مندلیف (۱۸۶۹)

مندلیف عناصر را بر اساس جرم مرتب کرد و **جای خالی گذاشت**! برای «اکا-سیلیسیم» پیش‌بینی کرد چگالی، رنگ و ترکیبش چه باشد. هفده سال بعد ژرمانیم کشف شد — همهٔ پیش‌بینی‌ها درست بود. قدرت یک جدول خوب: پیش‌بینی آینده.

## ساختار جدول

- **گروه (ستون):** تعداد الکترون لایهٔ آخر → رفتار شیمیایی
- **دوره (ردیف):** تعداد لایه‌ها → شعاع اتمی

## ریزترتیب‌هایی که باید بدانید

| دسته | کجاست | مثال |
|---|---|---|
| فلزهای قلیایی | گروه ۱ | سدیم — نرم، با آب واکنش شدید |
| هالوژن‌ها | گروه ۱۷ | کلر — گاز زرد، ضدعفونی |
| گازهای نجیب | گروه ۱۸ | هلیوم — بی‌واکنش، بادکنک |

> 🧪 **نکتهٔ کنکوری:** عناصر یک گروه واکنش‌های مشابه می‌دهند چون «لایهٔ آخر» آن‌ها یکی است.`,
    },
    {
      title: "اسید و باز: pH در آشپزخانه و استخر",
      description: "از لیمو تا صابون؛ مقیاس pH، واکنش خنثی‌سازی و تیتراسیون ملموس.",
      grade: "یازدهم", subject: "شیمی", chapter: "فصل ۵ — اسید و باز",
      method: "مثال‌محور", difficulty: "متوسط", authorId: sara.id, createdAt: daysAgo(19), viewCount: 132,
      content: `# اسید و باز: شیمی قابل چشیدن

## مقیاس pH در یک نگاه

| ماده | pH |
|---|---|
| آب لیمو | ۲ (اسید) |
| قهوه | ۵ |
| آب خالص | ۷ (خنثی) |
| جوش‌شیرین | ۹ |
| صابون | ۱۰ (باز) |

$$pH = -\\log[H^+]$$

هر واحد pH یعنی ده برابر! استخر با pH ۶، اسیدی‌تر از استخر با pH ۷ است به اندازهٔ ۱۰ برابر.

## خنثی‌سازی

$$\\text{اسید} + \\text{باز} \\to \\text{نمک} + \\text{آب}$$

سوزش معده (اسید) را با جوش‌شیرین (باز) خنثی می‌کنیم — دقیقاً واکنش تیتراسیون.

## تیتراسیون: شمارش مولکول‌ها با قطره

چند میلی‌لیتر باز لازم است تا اسید کف ظرف خنثی شود؟ از حجم باز مصرفی، غلظت اسید را حساب می‌کنیم:

$$C_a V_a = C_b V_b$$

> 🧂 **آزمایش امن:** کلم بنفش به‌عنوان شناساگر خانگی — در اسید صورتی، در باز سبز می‌شود!`,
    },
    {
      title: "دستگاه گردش خون: نقشهٔ کامل مسیر",
      description: "دو مدار خون، اتاق‌های قلب، دریچه‌ها و صداها — قلب را با نقشه بشناسید.",
      grade: "یازدهم", subject: "زیست‌شناسی", chapter: "فصل ۴ — گردش مواد",
      method: "مفهومی", difficulty: "متوسط", authorId: fateme.id, createdAt: daysAgo(17), viewCount: 199,
      content: `# دستگاه گردش خون: پمپ دوطبقه

## دو مدار، یک قلب

- **مدار کوچک:** راست قلب → شش‌ها (برداشتن O₂، دادن CO₂)
- **مدار بزرگ:** چپ قلب → همهٔ بدن

مسیر کامل: بدن → دهلیز راست → بطن راست → شش‌ها → دهلیز چپ → بطن چپ → بدن

## دریچه‌ها: سوپاپ‌های یک‌طرفه

چهار دریچه جلوی برگشت خون را می‌گیرند. صدای «تا-تام» همان بسته‌شدن دریچه‌هاست!

## فشار خون دو عدد

۱۲۰ روی ۸۰: حداکثر فشار هنگام انقباض بطن (سیستول) و حداقل هنگام استراحت (دیاستول).

## جدول عروق

| رگ | جهت | ویژگی |
|---|---|---|
| شریان | از قلب | دیوارهٔ ضخیم، فشار بالا |
| ورید | به قلب | دریچهٔ داخلی، دیوارهٔ نازک |
| مویرگ | تبادل | دیوارهٔ یک‌لایه |

> 🫀 **نکتهٔ کنکوری:** وریدهای پا دریچه دارند اما شریان‌ها ندارند — چرا؟ (فشار قلب!)`,
    },
    {
      title: "فتوسنتز: از نور خورشید تا قند",
      description: "واکنش روشنایی و کالوین با تشبیه کارخانه؛ آزمایش برگ و عوامل مؤثر بر سرعت.",
      grade: "دهم", subject: "زیست‌شناسی", chapter: "فصل ۶ — فتوسنتز",
      method: "مفهومی", difficulty: "متوسط", authorId: fateme.id, createdAt: daysAgo(16), viewCount: 176,
      content: `# فتوسنتز: کارخانهٔ خورشیدی

## معادلهٔ بزرگ

$$6CO_2 + 6H_2O + \\text{نور} \\to C_6H_{12}O_6 + 6O_2$$

خورشید = برق، CO₂ و آب = مواد اولیه، قند = محصول، اکسیژن = زبالهٔ خوش‌بوی کارخانه!

## دو مرحله مثل دو خط تولید

- **واکنش روشنایی (غشای تیلاکوئید):** نور را می‌گیرد، ATP می‌سازد، آب را می‌شکند (O₂ همین‌جا بیرون می‌آید)
- **چرخهٔ کالوین (استروما):** با ATP، CO₂ را به قند می‌بافد — به نور مستقیم نیاز ندارد

## آزمایش برگ: نقش یُد

برگ را در الکل بجوشانید (کلروفیل برود) و یُد بریزید — رنگ آبی‌نیلی یعنی نشاسته ساخته شده. برگِ داخل تاریکی، رنگ نمی‌دهد: بدون نور، تولید متوقف است.

## عوامل مؤثر بر سرعت

نور، CO₂، دما (آنزیم‌ها!)، آب. هر عاملِ محدودکننده سرعت کل را کم می‌کند — مثل خط تولید با قطعهٔ کم‌یاب.

> 🌱 **پیوند با شیمی:** فتوسنتز دقیقاً عکس تنفس سلولی است — دو طرف یک سکهٔ انرژی.`,
    },
    {
      title: "ژنتیک مندلی: مربع پانت در پنج قدم",
      description: "قانون‌های توارث، هم‌خالتی و ناهم‌خالتی، حل مسائل مربع پانت با نسبت‌های کلاسیک.",
      grade: "دوازدهم", subject: "زیست‌شناسی", chapter: "فصل ۳ — ژنتیک",
      method: "حل تمرین", difficulty: "متوسط", authorId: fateme.id, createdAt: daysAgo(14), viewCount: 221,
      content: `# ژنتیک مندلی: ریاضیِ توارث

## پنج قدم مندلی

از نخود فرنگی شروع کرد چون: گل کامل خودگشا، تفاوت‌های واضح، سریع. قدم به قدم: خالص‌سازی → تلاقی → شمارش دقیق → نسبت → قانون.

## مفاهیم کلیدی

- **آلل:** نسخه‌های یک ژن (بلندی و کوتاهی)
- **هم‌خالتی:** TT یا tt · **ناهم‌خالتی:** Tt
- **فنوتیپ:** آنچه می‌بینیم · **ژنوتیپ:** آنچه هست

## مربع پانت کلاسیک (Tt × Tt)

| | T | t |
|---|---|---|
| **T** | TT | Tt |
| **t** | Tt | tt |

فنوتیپ: ۳ بلند : ۱ کوتاه — نسبت مشهور ۳:۱

## تست حل‌شده

تلاقی Tt × tt؟ نصف Tt (بلند) و نصف tt (کوتاه) — نسبت ۱:۱. برای تشخیص ژنوتیپِ بلندِ ناشناخته با کوتاه تلاقی می‌کنیم (تست‌کراس).

> 🧬 **نکتهٔ کنکوری:** ۳:۱ فقط در تلاقی دو ناهم‌خالتی می‌آید؛ ۱:۲:۱ نسبت ژنوتیپی همان تلاقی است.`,
    },
    {
      title: "تاریخ ادبیات: از دربار سامانی تا انقلاب مشروطه",
      description: "خط زمان ادبیات ایران در یک جزوه؛ هر دوره با نمایندهٔ اصلی و ویژگی زبانی.",
      grade: "دوازدهم", subject: "ادبیات فارسی", chapter: "فصل ۱ — تاریخ ادبیات",
      method: "داستان‌محور", difficulty: "متوسط", authorId: mehdi.id, createdAt: daysAgo(13), viewCount: 143,
      content: `# خط زمان ادبیات ایران

## قرن ۴ و ۵ — دربار و حماسه

شاهنامهٔ فردوسی: «نام نیکان» را زنده نگه داشت. سبک خراسانی: زبان سادهٔ چکمهٔ سواران — قوی و بی‌پیرایه.

## قرن ۶ و ۷ — عرفان و صوفیانه

مولوی مثنوی را «قانون معنوی» نامید؛ سعدی با «گلستان» نثر فارسی را به قله رساند. زبان روانِ شیرازی متولد شد.

## قرن ۸ و ۹ — حافظ و پایه‌گذاری پخته

حافظ همهٔ میراث را یک‌جا جمع کرد: عرفان مولوی، ظرافت سعدی، حماسهٔ خیام. ایرانیان از آن روز، دیوانش را کنار قرآن نگه می‌دارند.

## عصر قاجار — بازگشت ادبی

شبیه‌سازان به سبک قدیم خو کردند؛ اما «آینهٔ واقع‌نما» نام کار میرزای نائینی بود: اولین جنبش واقع‌گرایی.

## مشروطه به بعد — روزنامه‌نگاری و نثر جدید

تقی‌زاده و دهخدا با «سُر اسرار» نثر را به زبان مردم نزدیک کردند؛ شعر نو از نیما شروع شد.

> 📜 **حفظ کنید:** دوره‌ها به ترتیب: خراسانی → عراقی → هندی → بازگشت → مشروطه → معاصر`,
    },
    {
      title: "دستور زبان: نقشهٔ وابسته‌سازها و همپایه‌سازها",
      description: "جدول کامل حروف ربط با مثال‌های دوپاره‌شده؛ پایهٔ پاسخ درست سؤال‌های دستور امتحان.",
      grade: "دهم", subject: "ادبیات فارسی", chapter: "فصل ۲ — دستور زبان",
      method: "جمع‌بندی", difficulty: "مقدماتی", authorId: mehdi.id, createdAt: daysAgo(11), viewCount: 121,
      content: `# نقشهٔ کامل وابسته‌سازها

## دو خانوادهٔ بزرگ حروف ربط

**همپایه‌سازها** دو جزء هم‌ارزش می‌بندند: و، یا، اما، ولی، پس، چه...چه، هم...هم

**وابسته‌سازها** یک جزء را به دیگری وابسته می‌کنند: که، اگر، چون، وقتی، هرگاه، تا، زیرا، هرچند

## جدول شناسایی سریع

| وابسته‌ساز | جوابش چه می‌پرسد؟ | مثال |
|---|---|---|
| که | راستِ که | شنیدم **که** آمدی |
| اگر | شرط | **اگر** بیایی، شاد می‌شوم |
| چون/زیرا | سبب | آمد **چون** خبر داشتم |
| وقتی/هرگاه | زمان | **وقتی** باران آمد، رفتم |

## دام کوچک امتحان

«که» هم می‌تواند همپایه‌ساز تعجبی باشد: «که چه سفر خوبی!» — در این‌جا دو جمله را نمی‌بندد.

## سه گام پاسخ‌دهی

۱. دو جزء را جدا کن ۲. بپرس وابسته است یا هم‌ارزش؟ ۳. جای خالی را با جدول تطبیق بده

> ✏️ **تمرین:** در «چون تلاش کردی موفق شدی، خوشحالم» کدام بخش وابسته است؟`,
    },
    {
      title: "عربی دهم: قواعد حال و جر — الگوی ترجمه",
      description: "شناسایی حال و تمییز با الگوی ثابت ترجمه و تمرین‌های هدفمند امتحان نهایی.",
      grade: "دهم", subject: "عربی", chapter: "دروس ۲ و ۳",
      method: "جمع‌بندی", difficulty: "متوسط", authorId: mehdi.id, createdAt: daysAgo(10), viewCount: 103,
      content: `# قواعد حال و جر در عربی دهم

## حال چیست؟

اسم منصوبی که «چگونگی» فعل را نشان می‌دهد:

**جَاءَ الطَّالِبُ مُسْرِعًا** → دانش‌آموز با شتابِ دویدن آمد.

علامت: التنوین با فتحه (مُسْرِعًا) — همیشه منصوب است.

## الگوی ترجمه

حال معمولاً با «در حالی که» یا قید حالت ترجمه می‌شود:

**دَخَلَ الْفَصْلَ ضَاحِكًا** → در حالی که می‌خندید وارد کلاس شد.

## تمییز: کِی و چقدر را روشن می‌کند

**اشْتَرَيْتُ رَطْلًا عَسَلًا** → یک رطل (چقدر؟) عسل (چه چیزی؟)

تمییز بعد از عدد و واحدها می‌آید و منصوب است.

## جدول تمرینی امتحان

| عبارت | نقش | ترجمه |
|---|---|---|
| عادَ الْغَائِبُ سَاعِدًا | حال | در حالی که کمک می‌کرد بازگشت |
| حَضَرَ زَيْدٌ غَدَاةً | تمییز (زمان) | صبحِ زود آمد |

> 📝 **یادآوری:** حال پاسخ «چگونه؟» و تمییز پاسخ «چقدر؟/چه چیزی؟» می‌دهد.`,
    },
    {
      title: "زبان انگلیسی: گذشتهٔ ساده در ۲۰ جملهٔ واقعی",
      description: "Regular و irregular verbs را با ۲۰ جملهٔ روزمره حک کنید؛ بدون حفظ جدول خشک.",
      grade: "دهم", subject: "زبان انگلیسی", chapter: "Unit 2 — Past Tense",
      method: "مثال‌محور", difficulty: "مقدماتی", authorId: sara.id, createdAt: daysAgo(9), viewCount: 87,
      content: `# Past Simple: بیست جمله که کافی‌اند

## قاعدهٔ ساده

افعال Regular با **-ed**: watch → watched · play → played

افعال Irregular را باید دید و شنید: go → went · see → saw · eat → ate

## بیست جملهٔ واقعی (نصف روزمره، نصف امتحانی)

1. I **watched** a film last night.
2. She **went** to school by bus.
3. We **ate** lunch at noon.
4. He **saw** his friend at the park.
5. They **played** football yesterday.
6. My mother **cooked** rice.
7. I **did** my homework.
8. The bus **arrived** late.
9. It **rained** all day.
10. We **studied** for the exam.

## منفی و سوالی: did کمک می‌کند

- منفی: did **not** + شکل ساده → I **didn't watch**...
- سوالی: Did + فاعل + شکل ساده؟ → **Did** you **go**?

اشتباه رایج: ~~I didn't went~~ → درست: **I didn't go** (بعد از did همیشه شکل ساده!)

> 📌 **حفظ‌کاری هوشمند:** پنج فعل پرتکرار را کامل یاد بگیرید: go/went · do/did · see/saw · eat/ate · have/had`,
    },
    {
      title: "تاریخ: ایران از صفویه تا قاجار — خط زمان",
      description: "پنج قرن در یک جزوه؛ شاه‌عباس، نادر، زندیه و قاجار با نقاط عطف و پیامدها.",
      grade: "یازدهم", subject: "تاریخ", chapter: "فصل ۵ — صفویه و قاجار",
      method: "داستان‌محور", difficulty: "متوسط", authorId: mehdi.id, createdAt: daysAgo(8), viewCount: 134,
      content: `# ایران از صفویه تا قاجار: پنج قرن در یک خط زمان

## ۱۵۰۱ — شاه‌اسماعیل و یکپارچگی

صفویه برای نخستین بار پس از اسلام، ایران را به‌عنوان یک واحد سیاسی-مذهبی یکپارچه کرد. اردبیل → تبریز → اصفهان.

## شاه‌عباس (۱۵۸۸–۱۶۲۹) — اوج

اصفهان «نصف جهان» شد. جادهٔ ابریشم احیا شد، ارمنی‌ها به جلفا آمدند، سفارتخانه‌ها باز شدند.

## ۱۷۲۲ — سقوط با گلولهٔ افغان

محمدخان افغان اصفهان را محاصره کرد. صفویه با شکست نظامی و ضعف اقتصادی از میان رفت.

## نادرشاه (۱۷۳۶) — شمشیر و هند

از خراسان برخاست، افغان‌ها را بیرون راند و غنایم هند (از جمله تخت طاووس) را به ایران آورد.

## قاجار — آغا محمدخان تا مشروطه

تهران پایتخت شد. دو جنگ ایران و روسیه → **عهدنامهٔ ترکمانچای (۱۸۲۸)**: از دست رفتن قفقاز و امتیازات کاپیتولاسیون.

> 🗺️ **برای امتحان:** هر دوره را با یک شهر و یک رویداد به‌خاطر بسپار.`,
    },
    {
      title: "جغرافیا: اقلیم ایران — از سبلان تا چابهار",
      description: "چرا بندر چابهار باران زمستانی و رشت باران پاییزی می‌گیرد؟ ماجراهای جبهه‌های هوا.",
      grade: "یازدهم", subject: "جغرافیا", chapter: "فصل ۲ — اقلیم",
      method: "داستان‌محور", difficulty: "مقدماتی", authorId: mehdi.id, createdAt: daysAgo(7), viewCount: 118,
      content: `# اقلیم ایران: کشوری از چهار فصل

## سه دینام باران ایران

- **جبههٔ مدیترانه‌ای:** پاییز و زمستان؛ رشت و زنجان را سیراب می‌کند
- **جبههٔ سیبری:** زمستان؛ سرد و خشک، گاهی برف سنگین شمال‌شرق
- **پرفشار عربستان و موسم:** تابستان؛ جنوب‌شرق (سیستان و بلوچستان) را بارانی می‌کند

## چرا کویر مرکزی خشک است؟

دو دیوار کوهستان: البرز و زاگرس ابرهای رسیده را «می‌گیرند». مرکز، پشت این دیوارها (سایهٔ باران) می‌ماند. فاصله از دریا هم سهم دارد.

## مقایسهٔ سه شهر

| شهر | بارش اصلی | دما |
|---|---|---|
| رشت | تمام سال (پاییز بیشینه) | معتدل |
| یزد | کمتر از ۸۰ میلی‌متر | گرم و خشک |
| چابهار | زمستان (مونسون) | گرم و مرطوب |

> 🗺️ **تمرین نقشه:** روی نقشهٔ ایران، رشتهٔ زاگرس را بکشید و جهت بادهای باران‌زا را نشان دهید.`,
    },
    {
      title: "مثلثات دهم: روابط پایه و حل مثلث قائمه",
      description: "سینوس، کسینوس، تانژانت را با یک مثلث به‌خاطر بسپارید؛ ارتفاع ساختمان و پل با حساب کنید.",
      grade: "دهم", subject: "ریاضی", chapter: "فصل ۴ — مثلثات",
      method: "جمع‌بندی", difficulty: "مقدماتی", authorId: ali.id, createdAt: daysAgo(6), viewCount: 94,
      content: `# مثلثات دهم: سه نسبت طلایی

## مثلث یادگار

در مثلث قائمه:

$$\\sin\\theta = \\frac{\\text{مقابل}}{\\text{وتر}} \\qquad \\cos\\theta = \\frac{\\text{مجاور}}{\\text{وتر}} \\qquad \\tan\\theta = \\frac{\\text{مقابل}}{\\text{مجاور}}$$

حروف اول: **م‌م‌و** — مقابل بر وتر...

## مقادیر مهم

| زاویه | sin | cos | tan |
|---|---|---|---|
| ۰° | ۰ | ۱ | ۰ |
| ۳۰° | ۱/۲ | √۳/۲ | √۳/۳ |
| ۴۵° | √۲/۲ | √۲/۲ | ۱ |
| ۶۰° | √۳/۲ | ۱/۲ | √۳ |

## مثال واقعی: ارتفاع ساختمان

فاصلهٔ ۲۰ متری از پایهٔ ساختمان، زاویهٔ بالارفتن نگاه ۳۰°:

$$\\tan 30° = \\frac{h}{20} \\Rightarrow h = 20 \\times \\frac{\\sqrt{3}}{3} \\approx 11.5 \\text{ متر}$$

> 🏗️ **تمرین:** با زاویهٔ ۴۵°، ارتفاع چند می‌شود؟ (چرا بدون ماشین‌حساب می‌دانید؟)`,
    },
    {
      title: "تشابه و قضیهٔ تالس — با مسائل ترکیبی",
      description: "دو مثلث متشابه را با سه حالت تشخیص دهید؛ قضیهٔ تالس در زمین و خطوط موازی.",
      grade: "دهم", subject: "هندسه", chapter: "فصل ۳ — تشابه",
      method: "حل تمرین", difficulty: "متوسط", authorId: mohammad.id, createdAt: daysAgo(5), viewCount: 88,
      content: `# تشابه: هندسهٔ مقیاس‌پذیر

## سه حالت تشابه مثلث‌ها

1. **دو زاویه برابر (AA)** — رایج‌ترین حالت امتحان
2. **نسبت اضلاع دو به دو برابر (SSS)**
3. **دو ضلع متناسب با زاویهٔ محصور برابر (SAS)**

## قضیهٔ تالس

خطی موازی یک ضلع مثلث بکشید؛ مثلثی کوچک‌تر و **متشابه** می‌سازد:

$$\\frac{AB}{AB'} = \\frac{AC}{AC'}$$

## مثال زمینی: عرض رودخانه

بدون عبور از رود، عرضش را اندازه می‌گیرند: دو نقطهٔ دید روی ساحل و یک نقطهٔ نشانه در آن‌سو — با تشابه مثلث‌ها، عرض = فاصله × نسبت. دقیقاً روش مهندسان باستانی!

## مسئلهٔ ترکیبی حل‌شده

در مثلث ABC، خط DE موازی BC با AD = 4، DB = 6. اگر AE = 5، EC چند است؟

$$\\frac{AD}{DB} = \\frac{AE}{EC} \\Rightarrow \\frac{4}{6} = \\frac{5}{EC} \\Rightarrow EC = 7.5$$

> 📏 **نکتهٔ تستی:** تشابه زاویه‌ها را حفظ می‌کند ولی اضلاع را مقیاس می‌کند.`,
    },
    {
      title: "حرکت دورانی و گرانش: ماه چرا نمی‌افتد؟",
      description: "سرعت زاویه‌ای، شتاب مرکزگرا و پرسش نیوتن دربارهٔ ماه — فیزیک دوازدهم با حل تست.",
      grade: "دوازدهم", subject: "فیزیک", chapter: "فصل ۴ — حرکت دورانی",
      method: "کنکوری", difficulty: "پیشرفته", authorId: zahra.id, createdAt: daysAgo(4), viewCount: 121,
      content: `# حرکت دورانی: فیزیک چرخ‌وفلنگ

## کمیت‌های زاویه‌ای

$$\\theta = \\omega t \\qquad v = \\omega r$$

سرعت خطویی ($v$) با دور شدن از محور زیاد می‌شود — چرا انتهای چرخ‌وفلنگ خطرناک‌تر است!

## شتاب مرکزگرا

$$a_c = \\frac{v^2}{r} = \\omega^2 r$$

جهتش همیشه **به سمت مرکز** است. نبودنش یعنی پرتاب شدن در خط مماس — قانون اول نیوتن.

## پاسخ نیوتن به «ماه چرا نمی‌افتد؟»

ماه **دائماً** می‌افتد — اما به‌قدر کافی به‌کنار هم حرکت می‌کند! جاذبه همان شتاب مرکزگرای مدار است:

$$\\frac{GMm}{r^2} = \\frac{mv^2}{r} \\Rightarrow v = \\sqrt{\\frac{GM}{r}}$$

## تست کنکور حل‌شده

دورهٔ تناوب ماهواره‌ای با شعاع ۴ برابر یک ماهوارهٔ دیگر (جرم یکسان مرکز)؟

$T^2 \\propto r^3$ (قانون کپلر سوم) → $T' = 8T$

> 🛰️ **جمع‌بندی تستی:** مسائل دورانی را با سه چیز حل کنید: نیروی مرکزگرا را چه کسی تأمین می‌کند؟`,
    },
    {
      title: "ترمودینامیک: آنتالپی، انتروپی و جهت واکنش",
      description: "چرا بعضی واکنش‌ها خودبه‌خود می‌روند؟ انرژی آزاد گیبس با مثال یخ و آب.",
      grade: "دوازدهم", subject: "شیمی", chapter: "فصل ۶ — ترمودینامیک",
      method: "کنکوری", difficulty: "پیشرفته", authorId: sara.id, createdAt: daysAgo(3), viewCount: 96,
      content: `# ترمودینامیک: علم جهت واکنش

## دو پرسش هر واکنش

۱. انرژی می‌گیرد یا می‌دهد؟ ($\\Delta H$ آنتالپی)
۲. نظم زیاد می‌شود یا کم؟ ($\\Delta S$ انتروپی)

## انتروپی: میل به بی‌نظمی

یخ در دست آب → آب مایع. مولکول‌ها از نظم بلوری به بی‌نظمی می‌روند: $\\Delta S > 0$ — خودبه‌خود رخ می‌دهد.

## داور نهایی: انرژی آزاد گیبس

$$\\Delta G = \\Delta H - T\\Delta S$$

$\\Delta G < 0$ → واکنش خودبه‌خودی. $\\Delta G > 0$ → به کمک بیرونی نیاز دارد.

## جدول تصمیم

| ΔH | ΔS | نتیجه |
|---|---|---|
| − | + | همیشه خودبه‌خودی (سوختن) |
| + | − | هرگز (جمع‌شدن قطعات در هم!) |
| − | − | وابسته به دما |
| + | + | وابسته به دما |

> 🧊 **مثال یخ:** ذوب یخ $\\Delta H > 0$ و $\\Delta S > 0$ دارد — زیر صفر نمی‌رود، بالای صفر خودبه‌خودی است. همین «وابسته به دما» است!`,
    },
    {
      title: "دستگاه عصبی: نورون، سیناپس و رفلکس",
      description: "پیام عصبی چگونه سفر می‌کند؟ مسیر رفلکس زانو و نقش نورون‌های رابط.",
      grade: "دوازدهم", subject: "زیست‌شناسی", chapter: "فصل ۸ — دستگاه عصبی",
      method: "مفهومی", difficulty: "متوسط", authorId: fateme.id, createdAt: daysAgo(2), viewCount: 109,
      content: `# دستگاه عصبی: شبکهٔ سریع بدن

## نورون: واحد ساختاری

دندریت (دریافت) → جسم سلولی (پردازش) → آکسون (ارسال). پیام الکتریکی در آکسون با پتانسیل عمل سفر می‌کند — تا ۱۲۰ متر بر ثانیه!

## سیناپس: رابط شیمیایی

بین دو نورون فاصله‌ای هست؛ پیام با **ناقل عصبی** رد می‌شود (استیل‌کولین مشهورترین است). یک‌طرفه است: فقط از پیش‌سیناپس به پس‌سیناپس.

## قوس رفلکس: سریع‌ترین مسیر

ضربه به زانو → گیرنده → نورون حسی → **نخاع** (بدون مغز!) → نورون رابط → نورون حرکتی → انقباض عضله.

چرا بدون مغز؟ سرعت! مغز بعداً «خبر» می‌شود — شما اول می‌پرید، بعد می‌فهمید.

## جدول بخش‌ها

| بخش | وظیفه |
|---|---|
| مغز و نخاع (مرکزی) | پردازش و تصمیم |
| عصبی پیکری | حرکت ارادی، حس پوست |
| عصبی خودکار | ضربان قلب، گوارش (غیرارادی) |

> 🧠 **نکتهٔ کنکوری:** قوس رفلکس در نخاع است؛ ادراک درد در مغز رخ می‌دهد.`,
    },
    {
      title: "آرایه‌های ادبی در غزل معاصر — از سپهری تا فروغ",
      description: "همان آرایه‌های قدیمی در شعر امروز؛ تحلیل سه شاعر معاصر با مثال‌های امتحانی.",
      grade: "یازدهم", subject: "ادبیات فارسی", chapter: "فصل ۴ — شعر معاصر",
      method: "مثال‌محور", difficulty: "متوسط", authorId: mehdi.id, createdAt: daysAgo(1), viewCount: 64,
      content: `# آرایه‌ها در شعر معاصر

## سپهری: تشبیه‌های کیهانی

«حیات آبستن لحظهٔ روشنی است» — تشبیه حیات به موجودِ در حال تولد؛ آبستن به معنی باردارِ معنا.

## فروغ: کنایه‌های تلخ

«من به اندازهٔ همهٔ مردمانم» — کنایه از هم‌عرض بودن با بشریت؛ مقیاس را انسانی کرد و در همان یک خط، ادعای ماندگاری کرد.

## اخوان: اسطوره و ایهام

در شعرهای اسطوره‌ای اخوان، سیاوش هم قهرمان شاهنامه است و هم نماد مظلوم معاصر — **ایهام** چون هر دو معنا می‌دهند.

## جدول تطبیق با امتحان

| آرایه | در حافظ | در معاصر |
|---|---|---|
| تشبیه | روی سیاه مه بگشای | حیات آبستن لحظه |
| کنایه | دو صد گفته چو نیم کردار | به اندازهٔ همهٔ مردمان |

> ✍️ **تکنیک امتحان:** آرایه را با «چرا اینجا؟» تحلیل کنید — فقط نام‌بردن نمره ندارد.`,
    },
  ];
  for (const p of p13Pamphlets) {
    await makePamphlet(p);
  }
  console.log(`📚 +${p13Pamphlets.length} expanded pamphlets created`);

  // ---------- exam expansion (10 published + 2 drafts) ----------
  async function makeExam(opts: {
    teacher: typeof mohammad; title: string; description: string; grade: string; subject: string;
    published: boolean; days: number;
    questions: { text: string; options: string[]; correct: number; points?: number }[];
  }) {
    const e = await db.exam.create({
      data: {
        teacherId: opts.teacher.id, title: opts.title, description: opts.description,
        grade: opts.grade, subject: opts.subject, published: opts.published,
        createdAt: daysAgo(opts.days), updatedAt: daysAgo(opts.days),
      },
    });
    let order = 1;
    for (const q of opts.questions) {
      const options = q.options.map((text, i) => ({ id: `opt${order}-${i + 1}`, text }));
      await db.examQuestion.create({
        data: {
          examId: e.id, order, text: q.text,
          options: JSON.stringify(options),
          correctOptionId: options[q.correct].id,
          points: q.points ?? 1,
        },
      });
      order += 1;
    }
    return e;
  }

  const p13Exams: Parameters<typeof makeExam>[0][] = [
    {
      teacher: mohammad, title: "آزمون فصل ۲ حسابان — مشتق", grade: "دوازدهم", subject: "حسابان",
      description: "پنج سؤال استاندارد از قواعد مشتق و زنجیره‌ای.", published: true, days: 30,
      questions: [
        { text: "مشتق $f(x) = 5x^3$ کدام است؟", options: ["$15x^2$", "$5x^2$", "$8x^2$", "$15x^3$"], correct: 0 },
        { text: "مشتق $f(x) = x^2 \\sin x$ کدام است؟", options: ["$2x\\cos x$", "$2x\\sin x + x^2\\cos x$", "$x^2\\cos x$", "$2x + \\cos x$"], correct: 1, points: 2 },
        { text: "مشتق $f(x) = (2x+1)^5$ کدام است؟", options: ["$5(2x+1)^4$", "$10(2x+1)^4$", "$(2x+1)^4$", "$2(2x+1)^5$"], correct: 1 },
        { text: "شیب خط مماس به $y = x^3$ در نقطهٔ $x = 2$؟", options: ["۶", "۸", "۱۲", "۴"], correct: 2, points: 2 },
        { text: "مشتق $\\sin(3x)$ کدام است؟", options: ["$\\cos(3x)$", "$3\\cos(3x)$", "$-3\\cos(3x)$", "$3\\sin(3x)$"], correct: 1 },
      ],
    },
    {
      teacher: mohammad, title: "آزمون هندسهٔ یازدهم — دایره", grade: "یازدهم", subject: "هندسه",
      description: "چهار سؤال از زاویه‌های مرکزی و محاطی.", published: true, days: 26,
      questions: [
        { text: "زاویهٔ محاطی روی قوس نیم‌دایره چند درجه است؟", options: ["۴۵", "۶۰", "۹۰", "۱۸۰"], correct: 2 },
        { text: "اگر زاویهٔ مرکزی ۸۰° باشد، زاویهٔ محاطی روی همان قوس؟", options: ["۴۰", "۸۰", "۱۶۰", "۱۰۰"], correct: 0 },
        { text: "طول قوس ۹۰° در شعاع ۴ (با π ≈ ۳٫۱۴)؟", options: ["۳٫۱۴", "۶٫۲۸", "۱۲٫۵۶", "۲"], correct: 1, points: 2 },
        { text: "در چهارضلعی محاطی مجموع دو زاویهٔ مقابل؟", options: ["۹۰", "۱۸۰", "۳۶۰", "۲۷۰"], correct: 1 },
      ],
    },
    {
      teacher: ali, title: "آزمون آمار — واریانس و انحراف معیار", grade: "یازدهم", subject: "آمار و احتمال",
      description: "چهار سؤال محاسباتی از پراکندگی.", published: true, days: 24,
      questions: [
        { text: "واریانس داده‌های ۲، ۴، ۶ (میانگین ۴)؟", options: ["۲", "۴", "۸", "۱۶"], correct: 1 },
        { text: "انحراف معیار همیشه؟", options: ["منفی است", "نامنفتی است", "برابر واریانس", "بیشتر از بیشینه"], correct: 1 },
        { text: "داده‌های ۵، ۵، ۵: واریانس؟", options: ["۰", "۵", "۲۵", "۱"], correct: 0 },
        { text: "افزودن عدد ثابت به همهٔ داده‌ها انحراف معیار را…", options: ["زیاد می‌کند", "کم می‌کند", "تغییر نمی‌دهد", "دو برابر می‌کند"], correct: 2, points: 2 },
      ],
    },
    {
      teacher: ali, title: "آزمون احتمال شرطی", grade: "دوازدهم", subject: "آمار و احتمال",
      description: "سؤال‌های درخت احتمال و استقلال.", published: true, days: 20,
      questions: [
        { text: "P(A|B) کدام فرمول است؟", options: ["P(A)P(B)", "P(A∩B)/P(B)", "P(A)+P(B)", "P(A∪B)"], correct: 1 },
        { text: "دو سکه مستقل پرتاب می‌شود؛ P(دو رو)؟", options: ["۱/۲", "۱/۳", "۱/۴", "۳/۴"], correct: 2 },
        { text: "اگر A و B مستقل باشند، P(A∩B)؟", options: ["P(A)+P(B)", "P(A)P(B)", "P(A|B)", "۰"], correct: 1 },
        { text: "تست مثبتِ آزمایشِ نادر در بیماریِ نادر، احتمال بیماری را…", options: ["قطعی می‌کند", "کم اما مثبت نگه می‌دارد", "صفر می‌کند", "دو برابر می‌کند"], correct: 1, points: 2 },
      ],
    },
    {
      teacher: zahra, title: "آزمون فیزیک دهم — کار و انرژی", grade: "دهم", subject: "فیزیک",
      description: "پنج سؤال از قضیهٔ کار-انرژی و توان.", published: true, days: 22,
      questions: [
        { text: "کار نیروی عمود بر جابه‌جایی؟", options: ["بیشینه", "صفر", "منفی", "وابسته به جرم"], correct: 1 },
        { text: "انرژی جنبشی جسم ۲ کیلوگرمی با سرعت ۳؟", options: ["۶ ژول", "۹ ژول", "۱۸ ژول", "۳ ژول"], correct: 1, points: 2 },
        { text: "توان ۱۰۰ وات در ۱۰ ثانیه چند ژول کار می‌کند؟", options: ["۱۰", "۱۰۰", "۱۰۰۰", "۱۰۰۰۰"], correct: 2 },
        { text: "دو برابر شدن سرعت، انرژی جنبشی را…", options: ["دو برابر می‌کند", "چهار برابر می‌کند", "نصف می‌کند", "ثابت نگه می‌دارد"], correct: 1, points: 2 },
        { text: "کدام یک کار انجام می‌دهد؟", options: ["نگه‌داشتن جسم ساکن", "حمل ساک در مسیر افقی", "بالا بردن جسم از زمین", "فشار دیوار"], correct: 2 },
      ],
    },
    {
      teacher: zahra, title: "آزمون فیزیک یازدهم — مدارها (پیش‌نویس)", grade: "یازدهم", subject: "فیزیک",
      description: "پیش‌نویس آزمون مدارهای سری و موازی — در حال تکمیل سؤال‌های ترکیبی.", published: false, days: 18,
      questions: [
        { text: "دو مقاومت ۴ و ۴ اهم سری: مقاومت کل؟", options: ["۲", "۴", "۸", "۱۶"], correct: 2 },
        { text: "دو مقاومت ۶ و ۳ اهم موازی: مقاومت کل؟", options: ["۹", "۲", "۴٫۵", "۱۸"], correct: 1 },
        { text: "در مدار سری، کدام کمیت همه‌جا برابر است؟", options: ["ولتاژ", "جریان", "مقاومت", "توان"], correct: 1 },
        { text: "در مدار موازی، کدام کمیت همه‌جا برابر است؟", options: ["جریان", "ولتاژ", "مقاومت", "هیچ‌کدام"], correct: 1 },
      ],
    },
    {
      teacher: sara, title: "آزمون شیمی دهم — جدول تناوبی", grade: "دهم", subject: "شیمی",
      description: "چهار سؤال از گروه‌ها، دوره‌ها و ریزترتیب‌ها.", published: true, days: 16,
      questions: [
        { text: "عناصر یک گروه چه شباهتی دارند؟", options: ["جرم برابر", "الکترون لایهٔ آخر برابر", "تعداد لایه برابر", "چگالی برابر"], correct: 1 },
        { text: "گازهای نجیب در کدام گروه‌اند؟", options: ["گروه ۱", "گروه ۲", "گروه ۱۷", "گروه ۱۸"], correct: 3 },
        { text: "هالوژن‌ها به‌طور کلی…", options: ["فلز هستند", "بی‌واکنش‌اند", "واکنش‌پذیرند", "دو اتمی نیستند"], correct: 2 },
        { text: "دورهٔ عنصر با پیکربندی ۲، ۸، ۳؟", options: ["۲", "۳", "۴", "۵"], correct: 1, points: 2 },
      ],
    },
    {
      teacher: sara, title: "آزمون شیمی یازدهم — اسید و باز", grade: "یازدهم", subject: "شیمی",
      description: "پنج سؤال از pH، خنثی‌سازی و شناساگرها.", published: true, days: 14,
      questions: [
        { text: "pH محلول خنثی؟", options: ["۰", "۵", "۷", "۱۴"], correct: 2 },
        { text: "pH ۳ نسبت به pH ۵ چقدر اسیدی‌تر است؟", options: ["۲ برابر", "۱۰ برابر", "۱۰۰ برابر", "۲۰ برابر"], correct: 2, points: 2 },
        { text: "حاصل اسید + باز؟", options: ["نمک + آب", "فقط آب", "گاز + رسوب", "اسید قوی‌تر"], correct: 0 },
        { text: "کدام ماده بازی است؟", options: ["آب لیمو", "سرکه", "صابون", "قهوه"], correct: 2 },
        { text: "شناساگر کلم بنفش در باز چه رنگی می‌شود؟", options: ["صورتی", "سبز", "آبی‌نیلی", "بی‌رنگ"], correct: 1 },
      ],
    },
    {
      teacher: fateme, title: "آزمون زیست دهم — فتوسنتز", grade: "دهم", subject: "زیست‌شناسی",
      description: "چهار سؤال از دو مرحلهٔ فتوسنتز و عوامل مؤثر.", published: true, days: 12,
      questions: [
        { text: "اکسیژن فتوسنتز از شکست کدام ماده آزاد می‌شود؟", options: ["CO₂", "آب", "قند", "کلروفیل"], correct: 1 },
        { text: "چرخهٔ کالوین در کجا رخ می‌دهد؟", options: ["غشای تیلاکوئید", "استروما", "هسته", "میتوکندری"], correct: 1 },
        { text: "محصول نهایی فتوسنتز؟", options: ["O₂", "قند (گلوکز)", "ATP", "CO₂"], correct: 1 },
        { text: "کدام عامل محدودکننده نیست؟", options: ["نور", "CO₂", "دما", "رنگ گلبرگ"], correct: 3 },
      ],
    },
    {
      teacher: fateme, title: "آزمون زیست دوازدهم — ژنتیک مندلی", grade: "دوازدهم", subject: "زیست‌شناسی",
      description: "پیش‌نویس آزمون ژنتیک — پس از تکمیل بخش جهش‌ها منتشر می‌شود.", published: false, days: 10,
      questions: [
        { text: "ژنوتیپ ناهم‌خالتی کدام است؟", options: ["TT", "tt", "Tt", "همه"], correct: 2 },
        { text: "نتیجهٔ تلاقی Tt × Tt برای فنوتیپ؟", options: ["۱:۱", "۳:۱", "۱:۲:۱", "همه بلند"], correct: 1, points: 2 },
        { text: "تست‌کراس یعنی تلاقی با فرد…", options: ["ناهم‌خالتی غالب", "هم‌خالتی مغلوب", "هم‌خالتی غالب", "دلخواه"], correct: 1 },
        { text: "فنوتیپ tt چیست؟", options: ["بلند", "کوتاه", "متوسط", "نامشخص"], correct: 1 },
        { text: "مندلی روی کدام گیاه کار کرد؟", options: ["ذرت", "نخود فرنگی", "گل رز", "گندم"], correct: 1 },
      ],
    },
    {
      teacher: mehdi, title: "آزمون ادبیات — دستور زبان", grade: "دهم", subject: "ادبیات فارسی",
      description: "چهار سؤال از وابسته‌سازها و همپایه‌سازها.", published: true, days: 8,
      questions: [
        { text: "«که» در «شنیدم که آمدی» چه نقشی دارد؟", options: ["همپایه‌ساز", "وابسته‌ساز", "حرف تعریف", "ضمیر"], correct: 1 },
        { text: "کدام جفت همپایه‌ساز است؟", options: ["اگر…پس", "چه…چه", "چون…بنابراین", "هرگاه…تا"], correct: 1 },
        { text: "در «هم اومد هم رفت» حروف ربط…", options: ["وابسته‌سازند", "همپایه‌سازند", "حرف اضافه‌اند", "قیدند"], correct: 1 },
        { text: "«چون تلاش کردی، موفق شدی» — وابستهٔ عبارت کدام است؟", options: ["موفق شدی", "چون تلاش کردی", "خوشحالم", "هیچ‌کدام"], correct: 1, points: 2 },
      ],
    },
  ];
  for (const e of p13Exams) {
    await makeExam(e);
  }
  console.log(`📝 +${p13Exams.length} exams created (10 published + 2 drafts)`);

  // ---------- course expansion (10 more) ----------
  const p13Courses: Parameters<typeof makeCourse>[0][] = [
    {
      teacher: zahra, title: "فیزیک دهم: کار و انرژی — دورهٔ مفهومی",
      description: "قضیهٔ کار-انرژی با آزمایش‌های خانگی؛ از پله‌نوردی تا ترمز خودرو.",
      grade: "دهم", subject: "فیزیک", level: "مقدماتی", price: 240_000,
      cover: "/courses/cover-science.png", video: "/videos/lesson-science.mp4", days: 21,
      lessons: [
        { title: "کار فیزیکی یعنی چه؟", minutes: 10, free: true },
        { title: "انرژی جنبشی و قضیهٔ کار-انرژی", minutes: 12 },
        { title: "توان و بازدهی", minutes: 10 },
        { title: "مسائل ترکیبی امتحانی", minutes: 14 },
      ],
    },
    {
      teacher: sara, title: "شیمی یازدهم: اسید و باز در خانه",
      description: "pH را با آزمایش‌های امن آشپزخانه بفهمید؛ تیتراسیون به زبان ساده.",
      grade: "یازدهم", subject: "شیمی", level: "مقدماتی", price: 180_000,
      cover: "/courses/cover-science.png", video: "/videos/lesson-science.mp4", days: 19,
      lessons: [
        { title: "مقیاس pH و معنای لگاریتمی", minutes: 9, free: true },
        { title: "اسیدها و بازهای روزمره", minutes: 11 },
        { title: "خنثی‌سازی و کاربردها", minutes: 10 },
        { title: "تیتراسیون گام‌به‌گام", minutes: 13 },
      ],
    },
    {
      teacher: fateme, title: "زیست دوازدهم: ژنتیک و مربع پانت",
      description: "از قوانین مندلی تا تست‌کراس؛ ژنتیک را با حل مسئله یاد بگیرید.",
      grade: "دوازدهم", subject: "زیست‌شناسی", level: "متوسط", price: 320_000,
      cover: "/courses/cover-science.png", video: "/videos/lesson-science.mp4", days: 17,
      lessons: [
        { title: "مفاهیم پایه: آلل و ژنوتیپ", minutes: 10, free: true },
        { title: "مربع پانت و نسبت‌های کلاسیک", minutes: 13 },
        { title: "تست‌کراس و تشخیص ژنوتیپ", minutes: 11 },
        { title: "مسائل ترکیبی دو صفت", minutes: 15 },
        { title: "تست‌های کنکور ژنتیک", minutes: 14 },
      ],
    },
    {
      teacher: mehdi, title: "ادبیات یازدهم: حافظ به روایت داستان",
      description: "دورهٔ رایگان جامعه‌محور؛ ده غزل مشهور، هرکدام یک قصه.",
      grade: "یازدهم", subject: "ادبیات فارسی", level: "مقدماتی", price: 0,
      cover: "/courses/cover-literature.png", video: "/videos/lesson-literature.mp4", days: 16,
      lessons: [
        { title: "بیت‌المعانی چیست و چرا مهم است؟", minutes: 8, free: true },
        { title: "غزل «الا یا ایها الساقی» — روایت کامل", minutes: 12 },
        { title: "ساختار گره‌گاه و گشوده‌گاه", minutes: 10 },
        { title: "از حافظ تا شعر امروز", minutes: 11 },
      ],
    },
    {
      teacher: mohammad, title: "ریاضی نهم: اعداد حقیقی و جذر",
      description: "دورهٔ رایگان؛ اثبات گنگ بودن جذرها و نمایش روی خط اعداد.",
      grade: "نهم", subject: "ریاضی", level: "مقدماتی", price: 0,
      cover: "/courses/cover-geometry.png", video: "/videos/lesson-geometry.mp4", days: 15,
      lessons: [
        { title: "داستان هیپاسوس و کشف گنگ", minutes: 7, free: true },
        { title: "اثبات گنگ بودن √۲", minutes: 11 },
        { title: "جذر روی خط اعداد با پرگار", minutes: 10 },
      ],
    },
    {
      teacher: mohammad, title: "حسابان دوازدهم: انتگرال مقدماتی",
      description: "ادامهٔ مسیر مشتق؛ پادمشتق، مساحت زیر نمودار و کاربردها.",
      grade: "دوازدهم", subject: "حسابان", level: "پیشرفته", price: 300_000,
      cover: "/courses/cover-calculus.png", video: "/videos/lesson-calculus.mp4", days: 14,
      lessons: [
        { title: "ایدهٔ پادمشتق", minutes: 10, free: true },
        { title: "جدول انتگرال‌های پایه", minutes: 12 },
        { title: "قاعدهٔ توان در انتگرال", minutes: 11 },
        { title: "انتگرال معین و مساحت", minutes: 14 },
        { title: "کاربردها: مسافت از سرعت", minutes: 13 },
      ],
    },
    {
      teacher: ali, title: "آمار یازدهم: احتمال شرطی و درخت",
      description: "درخت احتمال، استقلال و تناقض آزمایش پزشکی — با دادهٔ واقعی.",
      grade: "یازدهم", subject: "آمار و احتمال", level: "متوسط", price: 210_000,
      cover: "/courses/cover-statistics.png", video: "/videos/lesson-statistics.mp4", days: 13,
      lessons: [
        { title: "شرطی‌سازی: وقتی اطلاعات می‌رسد", minutes: 10, free: true },
        { title: "درخت احتمال دو مرحله‌ای", minutes: 12 },
        { title: "استقلال و شمارش", minutes: 11 },
        { title: "تناقض آزمایش پزشکی", minutes: 13 },
      ],
    },
    {
      teacher: mohammad, title: "هندسهٔ یازدهم: دایره — قضیه‌ها و حل مسئله",
      description: "زاویه‌های مرکزی و محاطی، طول قوس و مسائل ترکیبی امتحانی.",
      grade: "یازدهم", subject: "هندسه", level: "متوسط", price: 190_000,
      cover: "/courses/cover-geometry.png", video: "/videos/lesson-geometry.mp4", days: 12,
      lessons: [
        { title: "زاویهٔ محاطی نصف مرکزی", minutes: 9, free: true },
        { title: "چهارضلعی محاطی", minutes: 10 },
        { title: "طول قوس و مساحت قطاع", minutes: 11 },
        { title: "مسائل ترکیبی امتحان نهایی", minutes: 13 },
      ],
    },
    {
      teacher: mehdi, title: "عربی دهم: قواعد ترجمه — دورهٔ فشرده",
      description: "الگوهای ترجمهٔ جملهٔ اسمیه و فعلیه با تمرین هدفمند نهایی.",
      grade: "دهم", subject: "عربی", level: "مقدماتی", price: 150_000,
      cover: "/courses/cover-literature.png", video: "/videos/lesson-literature.mp4", days: 11,
      lessons: [
        { title: "جملهٔ اسمیه: مبتدا و خبر", minutes: 9, free: true },
        { title: "جملهٔ فعلیه و ترتیب فارسی", minutes: 10 },
        { title: "ضمیرها و جدول ضروری", minutes: 8 },
      ],
    },
    {
      teacher: zahra, title: "فیزیک دوازدهم: حرکت دورانی و گرانش",
      description: "از چرخ‌وفلنگ تا مدار ماه؛ شتاب مرکزگرا با تست‌های کنکور.",
      grade: "دوازدهم", subject: "فیزیک", level: "پیشرفته", price: 260_000,
      cover: "/courses/cover-calculus.png", video: "/videos/lesson-calculus.mp4", days: 10,
      lessons: [
        { title: "کمیت‌های زاویه‌ای", minutes: 10, free: true },
        { title: "شتاب مرکزگرا", minutes: 12 },
        { title: "گرانش به‌عنوان نیروی مرکزگرا", minutes: 13 },
        { title: "قانون کپلر سوم و تست‌ها", minutes: 15 },
      ],
    },
  ];
  const p13CourseIds: string[] = [];
  for (const c of p13Courses) {
    const created = await makeCourse(c);
    p13CourseIds.push(created.id);
  }
  console.log(`🎬 +${p13Courses.length} courses created`);

  // a few enrollments + watch progress on the new courses (realistic spread)
  const newEnrollPlan: { courseId: string; student: typeof hossein; price: number; watched: number[] }[] = [
    { courseId: p13CourseIds[0], student: hossein, price: 240_000, watched: [1] },
    { courseId: p13CourseIds[2], student: hossein, price: 320_000, watched: [1, 2] },
    { courseId: p13CourseIds[4], student: hossein, price: 0, watched: [1, 2, 3] },
    { courseId: p13CourseIds[5], student: hossein, price: 300_000, watched: [1] },
    { courseId: p13CourseIds[7], student: hossein, price: 0, watched: [1, 2] },
  ];
  for (const plan of newEnrollPlan) {
    const c = { id: plan.courseId, title: p13Courses.find((_, i) => p13CourseIds[i] === plan.courseId)!.title, teacherId: p13Courses.find((_, i) => p13CourseIds[i] === plan.courseId)!.teacher.id };
    if (!c) continue;
    await db.courseEnrollment.create({
      data: { courseId: c.id, studentId: plan.student.id, price: plan.price, createdAt: daysAgo(6) },
    });
    await watch(c.id, plan.student.id, plan.watched);
    const lessons = await db.videoLesson.findMany({ where: { courseId: c.id } });
    const lastLesson = lessons[plan.watched[plan.watched.length - 1] - 1];
    if (plan.price > 0 && lastLesson) {
      // keep the wallet story consistent: purchases for paid new courses
      await applyTxn(plan.student.id, { type: "COURSE_PURCHASE", amount: -plan.price, description: `خرید دورهٔ «${c.title}»`, at: daysAgo(6), refType: "COURSE", refId: c.id });
      await applyTxn(c.teacherId, { type: "COURSE_EARNING", amount: Math.floor(plan.price * 0.8), description: `فروش دورهٔ «${c.title}» (کمیسیون پلتفرم: ${plan.price - Math.floor(plan.price * 0.8)} تومان)`, at: daysAgo(6), refType: "COURSE", refId: c.id });
    }
  }
  console.log("🎓 new enrollments + progress created");

  // ---------- slot expansion (28 more OPEN slots, next 2 weeks) ----------
  const p13Slots: { teacher: typeof mohammad; days: number; hour: number; minute?: number; price: number; duration: number }[] = [
    { teacher: mohammad, days: 3, hour: 18, price: 130_000, duration: 60 },
    { teacher: mohammad, days: 5, hour: 16, price: 120_000, duration: 45 },
    { teacher: mohammad, days: 7, hour: 18, price: 130_000, duration: 60 },
    { teacher: mohammad, days: 8, hour: 17, price: 120_000, duration: 60 },
    { teacher: mohammad, days: 10, hour: 18, price: 150_000, duration: 90 },
    { teacher: mohammad, days: 13, hour: 17, price: 120_000, duration: 60 },
    { teacher: ali, days: 2, hour: 17, price: 100_000, duration: 45 },
    { teacher: ali, days: 4, hour: 16, price: 110_000, duration: 60 },
    { teacher: ali, days: 6, hour: 19, price: 100_000, duration: 60 },
    { teacher: ali, days: 7, hour: 16, price: 110_000, duration: 45 },
    { teacher: ali, days: 9, hour: 18, price: 100_000, duration: 60 },
    { teacher: ali, days: 12, hour: 17, price: 110_000, duration: 60 },
    { teacher: zahra, days: 1, hour: 17, price: 90_000, duration: 45 },
    { teacher: zahra, days: 3, hour: 19, price: 95_000, duration: 60 },
    { teacher: zahra, days: 5, hour: 17, minute: 30, price: 90_000, duration: 45 },
    { teacher: zahra, days: 8, hour: 16, price: 95_000, duration: 60 },
    { teacher: zahra, days: 11, hour: 17, minute: 30, price: 90_000, duration: 45 },
    { teacher: zahra, days: 14, hour: 18, price: 95_000, duration: 60 },
    { teacher: sara, days: 2, hour: 16, price: 110_000, duration: 45 },
    { teacher: sara, days: 4, hour: 18, price: 115_000, duration: 60 },
    { teacher: sara, days: 5, hour: 17, price: 110_000, duration: 60 },
    { teacher: sara, days: 8, hour: 19, price: 120_000, duration: 90 },
    { teacher: sara, days: 10, hour: 16, price: 110_000, duration: 45 },
    { teacher: sara, days: 12, hour: 18, price: 115_000, duration: 60 },
    { teacher: mehdi, days: 1, hour: 18, price: 95_000, duration: 45 },
    { teacher: mehdi, days: 4, hour: 17, price: 100_000, duration: 60 },
    { teacher: fateme, days: 2, hour: 15, price: 130_000, duration: 45 },
    { teacher: fateme, days: 5, hour: 16, price: 140_000, duration: 60 },
  ];
  for (const s of p13Slots) {
    const startAt = tehranAt(s.days, s.hour, s.minute ?? 0);
    await db.teacherSlot.create({
      data: {
        teacherId: s.teacher.id, startAt, durationMinutes: s.duration, price: s.price,
        status: "OPEN", createdAt: daysAgo(2),
      },
    });
  }
  console.log(`📅 +${p13Slots.length} open slots created`);

  // ---------- session expansion (5 more: 2 completed, 1 cancelled, 2 booked) ----------
  // 4) completed: mohammad ↔ hossein (12d ago, 90min, 150k)
  const doneStart2 = tehranAt(-12, 17);
  const doneSlot2 = await db.teacherSlot.create({
    data: { teacherId: mohammad.id, startAt: doneStart2, durationMinutes: 90, price: 150_000, status: "BOOKED", createdAt: daysAgo(14) },
  });
  const doneSession2 = await db.classSession.create({
    data: {
      slotId: doneSlot2.id, teacherId: mohammad.id, studentId: hossein.id,
      startAt: doneStart2, endAt: new Date(doneStart2.getTime() + 90 * 60_000),
      durationMinutes: 90, price: 150_000, teacherShare: 120_000, commission: 30_000,
      status: "COMPLETED", meetingCode: "KD8M3T", topic: "هندسهٔ یازدهم — تبدیل‌ها",
      createdAt: daysAgo(14), updatedAt: daysAgo(11),
    },
  });
  await db.sessionReview.create({
    data: {
      sessionId: doneSession2.id, userId: hossein.id, rating: 5,
      comment: "جلسهٔ هندسهٔ فوق‌العاده‌ای بود؛ استاد منتجبی با تختهٔ زنده تبدیل چرخش را طوری کشید که دیگر هیچ‌وقت فراموش نمی‌کنم.",
      createdAt: daysAgo(11), updatedAt: daysAgo(11),
    },
  });
  await applyTxn(hossein.id, { type: "SESSION_PAYMENT", amount: -150_000, description: "رزرو جلسهٔ «هندسهٔ یازدهم — تبدیل‌ها» با محمدرضا منتجبی", at: daysAgo(14), refType: "SESSION", refId: doneSlot2.id });
  await applyTxn(mohammad.id, { type: "SESSION_EARNING", amount: 120_000, description: "درآمد برگزاری جلسهٔ «هندسهٔ یازدهم» (کمیسیون پلتفرم: ۳۰٬۰۰۰ تومان)", at: daysAgo(11), refType: "SESSION", refId: doneSlot2.id });

  // 5) completed: fateme ↔ hossein (9d ago, 60min, 130k)
  const doneStart3 = tehranAt(-9, 15);
  const doneSlot3 = await db.teacherSlot.create({
    data: { teacherId: fateme.id, startAt: doneStart3, durationMinutes: 60, price: 130_000, status: "BOOKED", createdAt: daysAgo(11) },
  });
  const doneSession3 = await db.classSession.create({
    data: {
      slotId: doneSlot3.id, teacherId: fateme.id, studentId: hossein.id,
      startAt: doneStart3, endAt: new Date(doneStart3.getTime() + 60 * 60_000),
      durationMinutes: 60, price: 130_000, teacherShare: 104_000, commission: 26_000,
      status: "COMPLETED", meetingCode: "FT6W9R", topic: "فصل سلول — مرور برای میان‌ترم",
      createdAt: daysAgo(11), updatedAt: daysAgo(8),
    },
  });
  await db.sessionMessage.create({
    data: { sessionId: doneSession3.id, senderId: fateme.id, body: "سلام حسین؛ قبل از جلسه، جدول اندامک‌های جزوهٔ سلول را مرور کن.", createdAt: daysAgo(10) },
  });
  await db.sessionReview.create({
    data: {
      sessionId: doneSession3.id, userId: hossein.id, rating: 4,
      comment: "خانم حسینی خیلی دقیق هستند؛ فقط کاش وقت بیشتری برای سؤال‌های المپیادی داشتیم.",
      createdAt: daysAgo(8), updatedAt: daysAgo(8),
    },
  });
  await applyTxn(hossein.id, { type: "SESSION_PAYMENT", amount: -130_000, description: "رزرو جلسهٔ «فصل سلول — مرور میان‌ترم» با فاطمه حسینی", at: daysAgo(11), refType: "SESSION", refId: doneSlot3.id });
  await applyTxn(fateme.id, { type: "SESSION_EARNING", amount: 104_000, description: "درآمد برگزاری جلسهٔ «فصل سلول» (کمیسیون پلتفرم: ۲۶٬۰۰۰ تومان)", at: daysAgo(8), refType: "SESSION", refId: doneSlot3.id });

  // 6) cancelled by teacher: sara ↔ hossein (5d ago, refunded)
  const cxStart2 = tehranAt(-5, 18);
  const cxSlot2 = await db.teacherSlot.create({
    data: { teacherId: sara.id, startAt: cxStart2, durationMinutes: 60, price: 110_000, status: "BOOKED", createdAt: daysAgo(7) },
  });
  await db.classSession.create({
    data: {
      slotId: cxSlot2.id, teacherId: sara.id, studentId: hossein.id,
      startAt: cxStart2, endAt: new Date(cxStart2.getTime() + 60 * 60_000),
      durationMinutes: 60, price: 110_000, teacherShare: 88_000, commission: 22_000,
      status: "CANCELLED_TEACHER", meetingCode: "SR2X7K", topic: "استوکیومتری — حل تمرین",
      createdAt: daysAgo(7), updatedAt: daysAgo(5),
    },
  });
  await applyTxn(hossein.id, { type: "SESSION_PAYMENT", amount: -110_000, description: "رزرو جلسهٔ «استوکیومتری — حل تمرین» با سارا محمدی", at: daysAgo(7), refType: "SESSION", refId: cxSlot2.id });
  await applyTxn(hossein.id, { type: "SESSION_REFUND", amount: 110_000, description: "بازگشت کامل وجه جلسهٔ لغوشدهٔ استاد محمدی", at: daysAgo(5), refType: "SESSION", refId: cxSlot2.id });

  // 7) upcoming: zahra ↔ hossein (4 days from now, 60min, 95k)
  const upStart2 = tehranAt(4, 16);
  const upSlot2 = await db.teacherSlot.create({
    data: { teacherId: zahra.id, startAt: upStart2, durationMinutes: 60, price: 95_000, status: "BOOKED", createdAt: daysAgo(2) },
  });
  const upSession2 = await db.classSession.create({
    data: {
      slotId: upSlot2.id, teacherId: zahra.id, studentId: hossein.id,
      startAt: upStart2, endAt: new Date(upStart2.getTime() + 60 * 60_000),
      durationMinutes: 60, price: 95_000, teacherShare: 76_000, commission: 19_000,
      status: "BOOKED", meetingCode: "ZG5B4N", topic: "کار و انرژی — آمادگی امتحان",
      createdAt: daysAgo(2), updatedAt: daysAgo(2),
    },
  });
  await db.sessionMessage.create({
    data: { sessionId: upSession2.id, senderId: zahra.id, body: "سلام حسین؛ جلسهٔ چهارشنبه ساعت ۱۶ قفل شد. سه تست از فصل کار و انرژی می‌آوریم.", createdAt: daysAgo(2) },
  });
  await applyTxn(hossein.id, { type: "SESSION_PAYMENT", amount: -95_000, description: "رزرو جلسهٔ «کار و انرژی — آمادگی امتحان» با زهرا احمدی", at: daysAgo(2), refType: "SESSION", refId: upSlot2.id });

  // 8) upcoming: ali ↔ hossein (6 days from now, 45min, 100k)
  const upStart3 = tehranAt(6, 16);
  const upSlot3 = await db.teacherSlot.create({
    data: { teacherId: ali.id, startAt: upStart3, durationMinutes: 45, price: 100_000, status: "BOOKED", createdAt: daysAgo(1) },
  });
  await db.classSession.create({
    data: {
      slotId: upSlot3.id, teacherId: ali.id, studentId: hossein.id,
      startAt: upStart3, endAt: new Date(upStart3.getTime() + 45 * 60_000),
      durationMinutes: 45, price: 100_000, teacherShare: 80_000, commission: 20_000,
      status: "BOOKED", meetingCode: "AL9C2V", topic: "توابع نمایی و لگاریتم — حل تست",
      createdAt: daysAgo(1), updatedAt: daysAgo(1),
    },
  });
  await applyTxn(hossein.id, { type: "SESSION_PAYMENT", amount: -100_000, description: "رزرو جلسهٔ «توابع نمایی و لگاریتم» با علی رضایی", at: daysAgo(1), refType: "SESSION", refId: upSlot3.id });
  console.log("🏫 +5 sessions created (2 completed + reviews, 1 cancelled, 2 upcoming)");

  const counts = {
    users: await db.user.count(),
    pamphlets: await db.pamphlet.count(),
    versions: await db.pamphletVersion.count(),
    reviews: await db.review.count(),
    mrs: await db.mergeRequest.count(),
    exams: await db.exam.count(),
    openSlots: await db.teacherSlot.count({ where: { status: "OPEN", startAt: { gt: new Date() } } }),
    sessions: await db.classSession.count(),
    courses: await db.videoCourse.count(),
    enrollments: await db.courseEnrollment.count(),
    txns: await db.txn.count(),
  };
  console.log("✅ Seed complete:", counts);
  console.log("🔑 Demo login (all users): password = 123456");
  console.log("   e.g. montajebii@montamooz.ir / 123456  (معلم — حسابان، دوره‌ها)");
  console.log("   e.g. hossein@montamooz.ir / 123456     (دانش‌آموز — کیف پول، جلسهٔ فردا با استاد منتجبی)");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
