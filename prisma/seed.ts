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

  const counts = {
    users: await db.user.count(),
    pamphlets: await db.pamphlet.count(),
    versions: await db.pamphletVersion.count(),
    reviews: await db.review.count(),
    mrs: await db.mergeRequest.count(),
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
