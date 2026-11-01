"use client";

// مُنت‌آموز — pamphlet detail view: header, actions (fork/edit/propose-merge),
// GitHub-style tabs: محتوا / تاریخچه / مشارکت‌کنندگان / بازخوردها / درخواست‌های ادغام.

import { GitMerge, Pencil, Star, ThumbsDown, ThumbsUp, ArrowRight, Eye, GitFork, History } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { DIFFICULTY_STYLES, METHOD_STYLES } from "@/lib/constants";
import { faNumber, faRating, faRelative, toFaDigits } from "@/lib/format";
import type {
  MergeRequestItem,
  PamphletDetail,
  ReviewItem,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyBox, ErrorBox, InitialsAvatar, MRStatusBadge, Spinner } from "./bits";
import { MarkdownViewer } from "./markdown-viewer";
import { navigate } from "./router";
import { RatingStars } from "./rating-stars";
import { useFetch } from "./hooks";
import { useEduStore } from "./store";

/* ---------------- reviews ---------------- */

function ReviewForm({
  pamphletId,
  initial,
  onDone,
}: {
  pamphletId: string;
  initial?: ReviewItem | null;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      toast({
        title: "امتیاز یادتان رفته",
        description: "با ستاره‌ها به جزوه امتیاز بدهید (۱ تا ۵).",
        variant: "destructive",
      });
      return;
    }
    if (comment.trim().length < 3) {
      toast({
        title: "متن بازخورد خیلی کوتاه است",
        description: "چند خط دربارهٔ نقاط قوت و ضعف جزوه بنویسید.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      await api(`/pamphlets/${pamphletId}/reviews`, {
        method: "POST",
        json: { rating, comment: comment.trim() },
      });
      toast({
        title: "بازخورد شما ثبت شد؛ ممنون!",
        description: "نظر شما به بهتر شدن جزوه‌ها کمک می‌کند.",
      });
      onDone();
    } catch (err) {
      toast({
        title: "ثبت بازخورد ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="border-2 border-ink bg-white p-4 md:p-5"
      aria-label={initial ? "ویرایش بازخورد شما" : "ثبت بازخورد جدید"}
    >
      <h3 className="font-black">{initial ? "بازخورد شما (قابل ویرایش)" : "ثبت بازخورد شما"}</h3>
      <p className="mt-1 text-xs text-gray-500">
        امتیاز و نظرتان دربارهٔ این جزوه را بنویسید؛ برای مؤلف و سایر معلم‌ها ارزشمند است.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <RatingStars value={rating} onChange={setRating} size="lg" />
        <span className="oeg-mono text-sm font-bold text-gray-500">
          {rating > 0 ? `${toFaDigits(rating)} از ۵` : "بدون امتیاز"}
        </span>
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="مثلاً: توضیح مفهومی فصل ۲ عالی بود، اما تمرین‌های کم داشت…"
        className="mt-4 min-h-24 border-2 bg-white leading-7"
      />
      <Button type="submit" disabled={busy} className="mt-3 h-11 border-2 border-ink font-black md:h-10">
        {busy && <Spinner />}
        {initial ? "به‌روزرسانی بازخورد" : "ثبت بازخورد"}
      </Button>
    </form>
  );
}

function ReviewRow({
  review,
  onVote,
  isMine,
}: {
  review: ReviewItem;
  onVote: (review: ReviewItem, value: 1 | -1) => void;
  isMine: boolean;
}) {
  return (
    <article className="p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <InitialsAvatar name={review.user.fullName} className="size-9 border-2 border-ink text-xs" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">
            {review.user.fullName}
            {isMine && <span className="ms-2 text-xs font-bold text-primary">(شما)</span>}
          </p>
          <p className="text-xs text-gray-400">{faRelative(review.createdAt)}</p>
        </div>
        <span className="ms-auto flex items-center gap-1.5">
          <RatingStars value={review.rating} />
          <span className="oeg-mono text-xs font-bold text-gray-500">{faRating(review.rating)}</span>
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">{review.comment}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onVote(review, 1)}
          aria-pressed={review.myVote === 1}
          aria-label="این بازخورد مفید بود"
          className={cn(
            "h-9 border-2 font-bold",
            review.myVote === 1
              ? "border-success bg-success/10 text-success"
              : "border-gray-200 text-gray-600 hover:border-success hover:text-success"
          )}
        >
          <ThumbsUp className={cn("size-4", review.myVote === 1 && "fill-success")} aria-hidden="true" />
          <span className="oeg-mono">{faNumber(review.helpful)}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onVote(review, -1)}
          aria-pressed={review.myVote === -1}
          aria-label="این بازخورد مفید نبود"
          className={cn(
            "h-9 border-2 font-bold",
            review.myVote === -1
              ? "border-danger bg-danger/10 text-danger"
              : "border-gray-200 text-gray-600 hover:border-danger hover:text-danger"
          )}
        >
          <ThumbsDown className={cn("size-4", review.myVote === -1 && "fill-danger")} aria-hidden="true" />
          <span className="oeg-mono">{faNumber(review.unhelpful)}</span>
        </Button>
        <span className="text-xs text-gray-400">آیا این بازخورد مفید بود؟</span>
      </div>
    </article>
  );
}

/* ---------------- main view ---------------- */

export function PamphletView({ id }: { id: string }) {
  const { toast } = useToast();
  const { user, openAuth } = useEduStore();

  const [tab, setTab] = useState("content");
  const [forking, setForking] = useState(false);
  const [mrOpen, setMrOpen] = useState(false);
  const [mrTitle, setMrTitle] = useState("");
  const [mrDesc, setMrDesc] = useState("");
  const [mrBusy, setMrBusy] = useState(false);

  const detail = useFetch<PamphletDetail>(
    () => api<PamphletDetail>(`/pamphlets/${id}`),
    [id, user?.id] // refetch after login so isMine/myReview update
  );
  const reviews = useFetch<{ items: ReviewItem[] }>(
    () => api<{ items: ReviewItem[] }>(`/pamphlets/${id}/reviews`),
    [id, user?.id]
  );
  const mrs = useFetch<{ items: MergeRequestItem[] }>(
    () => api<{ items: MergeRequestItem[] }>(`/merge-requests?targetId=${id}`),
    [id],
    { enabled: tab === "mrs" } // lazy — fetched when the tab is first opened
  );

  const p = detail.data;

  // keep the MR dialog title/desc fresh-ish — clear drafts whenever the
  // pamphlet id changes; adjust state during render on prop change
  // (react.dev/learn/you-might-not-need-an-effect)
  const [prevId, setPrevId] = useState(id);
  if (id !== prevId) {
    setPrevId(id);
    setMrTitle("");
    setMrDesc("");
  }

  async function handleFork() {
    if (!user) {
      openAuth("برای فورک کردن جزوه باید وارد حساب کاربری شوید.");
      return;
    }
    setForking(true);
    try {
      const { id: newId } = await api<{ id: string }>(`/pamphlets/${id}/fork`, {
        method: "POST",
      });
      toast({
        title: "فورک شد!",
        description: "حالا جزوه را بهبود ببخشید — تغییرات شما به‌عنوان نسخهٔ جدید ذخیره می‌شود.",
      });
      navigate(`#/edit/${newId}`);
    } catch (err) {
      toast({
        title: "فورک ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setForking(false);
    }
  }

  async function submitMergeRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!p?.forkedFromId) return;
    if (mrTitle.trim().length < 5) {
      toast({
        title: "عنوان درخواست خیلی کوتاه است",
        description: "در ۵ کلمه بگویید چه چیزی را بهبود داده‌اید.",
        variant: "destructive",
      });
      return;
    }
    setMrBusy(true);
    try {
      const { id: mrId } = await api<{ id: string }>("/merge-requests", {
        method: "POST",
        json: {
          sourceId: p.id,
          targetId: p.forkedFromId,
          title: mrTitle.trim(),
          description: mrDesc.trim() || undefined,
        },
      });
      toast({
        title: "درخواست ادغام ثبت شد",
        description: "نویسندهٔ جزوهٔ اصلی تغییرات شما را بررسی خواهد کرد.",
      });
      setMrOpen(false);
      navigate(`#/request/${mrId}`);
    } catch (err) {
      toast({
        title: "ثبت درخواست ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setMrBusy(false);
    }
  }

  async function vote(review: ReviewItem, value: 1 | -1) {
    if (!user) {
      openAuth("برای مشارکت در بازخوردها وارد حساب کاربری شوید.");
      return;
    }
    try {
      const result = await api<{ helpful: number; unhelpful: number; myVote: number }>(
        `/reviews/${review.id}/vote`,
        { method: "POST", json: { value: review.myVote === value ? 0 : value } }
      );
      reviews.setData((prev) =>
        prev
          ? {
              items: prev.items.map((r) =>
                r.id === review.id ? { ...r, ...result } : r
              ),
            }
          : prev
      );
    } catch (err) {
      toast({
        title: "ثبت رأی ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  }

  /* ----- loading / error ----- */
  if (detail.loading && !detail.data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10" aria-busy="true" aria-label="در حال بارگذاری جزوه">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-6 h-10 w-3/4" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-24" />
        </div>
        <div className="mt-6 flex gap-2">
          <Skeleton className="h-11 w-48" />
          <Skeleton className="h-11 w-40" />
        </div>
        <Skeleton className="mt-8 h-96 w-full" />
      </div>
    );
  }

  if (detail.error || !p) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorBox
          message={detail.error ?? "جزوه پیدا نشد."}
          onRetry={detail.retry}
        />
      </div>
    );
  }

  const myUserId = user?.id;
  const sortedVersions = [...p.versions].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* back + fork lineage */}
      <a
        href="#/"
        className="inline-flex h-9 items-center gap-1 text-sm font-bold text-gray-500 transition-colors hover:text-primary"
      >
        <ArrowRight className="size-4" aria-hidden="true" /> بازگشت به کتابخانه
      </a>

      {p.forkedFromId && (
        <div className="mt-4 border-2 border-gold bg-gold/10 p-3 text-sm font-medium text-[#7a5c1e]">
          این جزوه فورکی از{" "}
          <a
            href={`#/pamphlet/${p.forkedFromId}`}
            className="font-black underline decoration-gold decoration-2 underline-offset-4 hover:text-primary"
          >
            «{p.forkedFromTitle ?? "جزوهٔ اصلی"}»
          </a>{" "}
          است — یعنی بر پایهٔ کار یک معلم دیگر بهبود یافته است.
        </div>
      )}

      {/* header */}
      <h1 className="mt-4 text-3xl font-black leading-snug md:text-4xl">{p.title}</h1>
      <p className="mt-2 text-sm text-gray-600">
        نوشتهٔ{" "}
        <a
          href={`#/user/${p.author.id}`}
          className="font-black text-primary hover:underline"
        >
          {p.author.fullName}
        </a>
        {p.author.title ? ` — ${p.author.title}` : ""}
      </p>

      {/* meta badges */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="border-2 border-ink px-2 font-bold">پایهٔ {p.grade}</Badge>
        <Badge variant="outline" className="border-2 border-ink px-2 font-bold">{p.subject}</Badge>
        {p.chapter && (
          <Badge variant="outline" className="border-2 border-ink px-2 font-bold">فصل: {p.chapter}</Badge>
        )}
        <span
          className={cn(
            "border px-2 py-0.5 text-xs font-bold",
            METHOD_STYLES[p.teachingMethod] ?? "border-gray-300 bg-gray-100 text-gray-700"
          )}
        >
          {p.teachingMethod}
        </span>
        <span
          className={cn(
            "border px-2 py-0.5 text-xs font-bold",
            DIFFICULTY_STYLES[p.difficulty] ?? "border-gray-300 bg-gray-100 text-gray-700"
          )}
        >
          {p.difficulty}
        </span>
      </div>

      {/* stats */}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-600">
        <span className="flex items-center gap-1.5">
          <RatingStars value={p.ratingAvg} />
          <b className="text-ink">{faRating(p.ratingAvg)}</b>
          <span className="text-xs">({faNumber(p.ratingCount)} بازخورد)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Eye className="size-4 text-gray-400" aria-hidden="true" />
          <span className="oeg-mono">{faNumber(p.viewCount)}</span> بازدید
        </span>
        <span className="flex items-center gap-1.5">
          <GitFork className="size-4 text-gray-400" aria-hidden="true" />
          <span className="oeg-mono">{faNumber(p.forkCount)}</span> فورک
        </span>
        <span className="flex items-center gap-1.5">
          <History className="size-4 text-gray-400" aria-hidden="true" />
          <span className="oeg-mono">{faNumber(p.versionCount)}</span> نسخه
        </span>
        {p.openMergeRequestCount > 0 && (
          <span className="flex items-center gap-1.5 border-2 border-gold bg-gold/15 px-2 py-0.5 text-xs font-bold text-[#8a6a24]">
            <GitMerge className="size-4" aria-hidden="true" />
            {faNumber(p.openMergeRequestCount)} درخواست ادغام باز
          </span>
        )}
      </div>

      {/* actions */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button
          onClick={() => void handleFork()}
          disabled={forking}
          className="h-11 border-2 border-ink px-5 font-black md:h-10"
        >
          {forking ? <Spinner /> : <GitFork className="size-4" aria-hidden="true" />}
          فورک (کپی و بهبود)
        </Button>

        {p.isMine && (
          <>
            <Button
              variant="outline"
              onClick={() => navigate(`#/edit/${id}`)}
              className="h-11 border-2 border-ink font-black hover:bg-gray-50 md:h-10"
            >
              <Pencil className="size-4" aria-hidden="true" /> ویرایش و نسخهٔ جدید
            </Button>
            {p.forkedFromId && (
              <Button
                variant="outline"
                onClick={() => setMrOpen(true)}
                className="h-11 border-2 border-gold font-black text-[#8a6a24] hover:bg-gold/10 md:h-10"
              >
                <GitMerge className="size-4" aria-hidden="true" /> پیشنهاد ادغام با نسخهٔ اصلی
              </Button>
            )}
          </>
        )}

        {!user && (
          <button
            type="button"
            onClick={() => openAuth("برای فورک، بازخورد و ثبت امتیاز وارد حساب کاربری شوید.")}
            className="h-11 px-3 text-sm font-bold text-primary underline decoration-2 underline-offset-4 md:h-10"
          >
            برای فورک و بازخورد وارد شوید
          </button>
        )}
      </div>

      {/* tabs */}
      <Tabs value={tab} onValueChange={setTab} className="mt-8">
        <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-b-2 border-gray-200 bg-transparent p-0 sm:w-fit">
          <TabsTrigger
            value="content"
            className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-bold text-gray-500 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            محتوا
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-bold text-gray-500 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            تاریخچه
            <span className="oeg-mono ms-1 bg-gray-100 px-1.5 text-xs">
              {faNumber(p.versions.length)}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="contributors"
            className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-bold text-gray-500 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            مشارکت‌کنندگان
            <span className="oeg-mono ms-1 bg-gray-100 px-1.5 text-xs">
              {faNumber(p.contributors.length)}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="reviews"
            className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-bold text-gray-500 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            بازخوردها
          </TabsTrigger>
          <TabsTrigger
            value="mrs"
            className="rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-bold text-gray-500 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            درخواست‌های ادغام
            <span className="oeg-mono ms-1 bg-gray-100 px-1.5 text-xs">
              {faNumber(p.openMergeRequestCount)}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* محتوا */}
        <TabsContent value="content" className="mt-4">
          <div className="border-2 border-ink bg-white p-4 md:p-8">
            <MarkdownViewer content={p.content} />
          </div>
        </TabsContent>

        {/* تاریخچه */}
        <TabsContent value="history" className="mt-4">
          {sortedVersions.length === 0 ? (
            <EmptyBox title="نسخه‌ای ثبت نشده است" />
          ) : (
            <ul className="oeg-scroll max-h-96 divide-y divide-gray-100 overflow-y-auto border-2 border-ink bg-white">
              {sortedVersions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-3 p-4">
                  <span className="oeg-mono border-2 border-ink bg-gray-50 px-2 py-1 text-xs font-bold">
                    v{toFaDigits(v.versionNumber)}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium leading-6">
                    {v.changeSummary || <span className="text-gray-400">بدون توضیح تغییرات</span>}
                  </span>
                  <span className="text-xs text-gray-400">
                    {v.createdBy.fullName} · {faRelative(v.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* مشارکت‌کنندگان */}
        <TabsContent value="contributors" className="mt-4">
          <div className="border-2 border-ink bg-white p-4 md:p-6">
            <h3 className="font-black">
              سهم مالکیت فکری — جمع: <span className="oeg-mono text-primary">۱۰۰٪</span>
            </h3>
            <p className="mt-1 text-xs leading-6 text-gray-500">
              سهم هر نفر بر اساس خطوط محتوای نوشته‌شده (جزوهٔ اولیه، نسخه‌های جدید و ادغام‌های تأییدشده) محاسبه می‌شود.
            </p>
            <div className="mt-6 space-y-5">
              {p.contributors.map((c) => (
                <div key={c.userId}>
                  <div className="flex flex-wrap items-center gap-3">
                    <InitialsAvatar name={c.fullName} className="size-9 border-2 border-ink text-xs" />
                    <a
                      href={`#/user/${c.userId}`}
                      className="font-bold transition-colors hover:text-primary"
                    >
                      {c.fullName}
                    </a>
                    {c.isAuthor && (
                      <Badge className="border-2 border-ink bg-ink px-2 text-xs font-bold text-white">
                        مؤلف اصلی
                      </Badge>
                    )}
                    <span className="oeg-mono ms-auto text-sm font-black">
                      {toFaDigits(c.percentage)}٪
                    </span>
                  </div>
                  <div className="mt-2 h-3 border-2 border-ink bg-gray-100" role="presentation">
                    {/* runtime-computed width: contribution percentage */}
                    <div
                      className={cn(
                        "h-full transition-all duration-500",
                        c.isAuthor ? "bg-primary" : "bg-gold"
                      )}
                      style={{ width: `${c.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* بازخوردها */}
        <TabsContent value="reviews" className="mt-4 space-y-4">
          {user ? (
            <ReviewForm
              key={p.myReview?.id ?? "new"}
              pamphletId={id}
              initial={p.myReview ?? null}
              onDone={() => {
                reviews.retry();
                detail.retry();
              }}
            />
          ) : (
            <EmptyBox
              title="برای ثبت بازخورد وارد شوید"
              description="تجربهٔ شما از استفادهٔ این جزوه در کلاس، برای مؤلف و سایر معلم‌ها راهنمای خوبی است."
              action={
                <Button
                  className="h-11 border-2 border-ink font-black"
                  onClick={() => openAuth("برای ثبت بازخورد و امتیاز وارد حساب کاربری شوید.")}
                >
                  ورود | ثبت‌نام
                </Button>
              }
            />
          )}

          {reviews.loading && !reviews.data ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : reviews.error ? (
            <ErrorBox message={reviews.error} onRetry={reviews.retry} />
          ) : reviews.data && reviews.data.items.length > 0 ? (
            <div className="divide-y divide-gray-100 border-2 border-ink bg-white">
              <p className="p-4 text-sm font-black">
                {faNumber(reviews.data.items.length)} بازخورد ثبت‌شده
              </p>
              {reviews.data.items.map((r) => (
                <ReviewRow
                  key={r.id}
                  review={r}
                  onVote={vote}
                  isMine={r.user.id === myUserId}
                />
              ))}
            </div>
          ) : (
            <EmptyBox
              title="هنوز بازخوردی ثبت نشده است"
              description="اولین نفری باشید که تجربهٔ خود را از این جزوه می‌نویسد."
            />
          )}
        </TabsContent>

        {/* درخواست‌های ادغام */}
        <TabsContent value="mrs" className="mt-4">
          {mrs.loading && !mrs.data ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : mrs.error ? (
            <ErrorBox message={mrs.error} onRetry={mrs.retry} />
          ) : mrs.data && mrs.data.items.length > 0 ? (
            <ul className="divide-y divide-gray-100 border-2 border-ink bg-white">
              {mrs.data.items.map((mr) => (
                <li key={mr.id}>
                  <a
                    href={`#/request/${mr.id}`}
                    className="block p-4 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <MRStatusBadge status={mr.status} />
                      <span className="font-black">{mr.title}</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                      {mr.createdBy.fullName} · {faRelative(mr.createdAt)}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyBox
              title="درخواست ادغامی برای این جزوه ثبت نشده است"
              description="اگر جزوهٔ دیگری را فورک و بهبود داده‌اید، از صفحهٔ همان فورک می‌توانید ادغام پیشنهاد دهید."
            />
          )}
        </TabsContent>
      </Tabs>

      {/* propose merge dialog */}
      <Dialog open={mrOpen} onOpenChange={setMrOpen}>
        <DialogContent className="border-2 border-ink sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">پیشنهاد ادغام با جزوهٔ اصلی</DialogTitle>
            <DialogDescription>
              تغییرات شما برای بررسی به نویسندهٔ «{p.forkedFromTitle ?? "جزوهٔ اصلی"}» ارسال می‌شود؛
              در صورت تأیید، سهم شما در جزوهٔ اصلی ثبت خواهد شد.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitMergeRequest}>
            <div className="space-y-1.5">
              <Label htmlFor="mr-title" className="text-sm font-black">عنوان درخواست</Label>
              <Input
                id="mr-title"
                value={mrTitle}
                onChange={(e) => setMrTitle(e.target.value)}
                placeholder="مثلاً: افزودن ۱۵ تمرین کنکوری به فصل ۲"
                className="h-11 border-2 bg-white md:h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mr-desc" className="text-sm font-black">توضیح تغییرات (اختیاری)</Label>
              <Textarea
                id="mr-desc"
                value={mrDesc}
                onChange={(e) => setMrDesc(e.target.value)}
                placeholder="چه چیزهایی را بهبود دادید و چرا؟"
                className="min-h-24 border-2 bg-white leading-7"
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={mrBusy}
                className="h-11 w-full border-2 border-ink font-black md:h-10 sm:w-auto"
              >
                {mrBusy && <Spinner />} <GitMerge className="size-4" aria-hidden="true" /> ثبت درخواست ادغام
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
