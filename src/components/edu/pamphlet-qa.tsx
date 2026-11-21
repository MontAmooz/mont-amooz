"use client";

// مُنت‌آموز — pamphlet Q&A threads (پرسش و پاسخ tab, P19): students ask,
// anyone signed-in replies, everyone reads. Single-level replies by design;
// soft-deleted comments render a placeholder so replies keep their parent.
// Bodies render through MarkdownViewer; delete is author-or-admin (soft).

import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { faRelative, toFaDigits } from "@/lib/format";
import type { CommentListResponse, PamphletCommentItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyBox, ErrorBox, InfoNote, InitialsAvatar, PageSkeleton, Spinner } from "./bits";
import { useFetch } from "./hooks";
import { MarkdownViewer } from "./markdown-viewer";
import { ReportDialog } from "./report-dialog";
import { useEduStore } from "./store";

export function PamphletQA({
  pamphletId,
  onChanged,
}: {
  pamphletId: string;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  // viewer identity comes from the store — isMine already reflects it via the API
  const user = useEduStore((s) => s.user);
  const stats = useFetch<CommentListResponse>(
    () => api<CommentListResponse>(`/pamphlets/${pamphletId}/comments`),
    [pamphletId]
  );
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<PamphletCommentItem | null>(null);
  const [reportTarget, setReportTarget] = useState<PamphletCommentItem | null>(null);
  const [busy, setBusy] = useState(false);

  const data = stats.data;

  async function submit() {
    const text = body.trim();
    if (text.length < 2 || busy) return;
    setBusy(true);
    try {
      await api(`/pamphlets/${pamphletId}/comments`, {
        method: "POST",
        json: { body: text, parentId: replyTo?.id ?? undefined },
      });
      setBody("");
      setReplyTo(null);
      stats.retry();
      onChanged?.();
      toast({ title: "پیام شما ثبت شد", description: "پرسش یا پاسخ شما ثبت شد." });
    } catch (err) {
      toast({
        title: "ارسال پیام ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function deleteById(id: string) {
    try {
      await api(`/comments/${id}`, { method: "DELETE" });
      stats.retry();
      onChanged?.();
      toast({ title: "پیام حذف شد" });
    } catch (err) {
      toast({
        title: "حذف ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* composer */}
      {user ? (
        <div className="border-2 border-ink bg-white p-4">
          {replyTo && (
            <div className="mb-3 flex items-center justify-between border-2 border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <span>
                در پاسخ به پیام <span className="font-black">{replyTo.author.fullName}</span>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="font-bold text-primary hover:underline"
              >
                لغو
              </button>
            </div>
          )}
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="پرسش یا نظر خود را بنویسید… (مارک‌داون پشتیبانی می‌شود)"
            rows={3}
            maxLength={3000}
            aria-label="متن پرسش یا پاسخ"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="oeg-mono text-xs text-gray-400">
              {toFaDigits(body.length)} / ۳۰۰۰
            </span>
            <Button
              onClick={() => void submit()}
              disabled={busy || body.trim().length < 2}
              className="h-11 border-2 border-ink font-black md:h-10"
            >
              {busy ? <Spinner /> : <MessageCircle className="size-4" aria-hidden="true" />}
              {replyTo ? "ارسال پاسخ" : "ارسال پرسش"}
            </Button>
          </div>
        </div>
      ) : (
        <InfoNote>برای پرسیدن سؤال یا پاسخ دادن، ابتدا وارد حساب کاربری شوید.</InfoNote>
      )}

      {/* list */}
      {stats.loading && !data ? (
        <PageSkeleton />
      ) : stats.error ? (
        <ErrorBox message={stats.error} onRetry={stats.retry} />
      ) : data && data.items.length === 0 ? (
        <EmptyBox
          title="هنوز پرسشی ثبت نشده است"
          description="اولین نفر باشید — سؤال خود را از این جزوه بپرسید تا نویسنده یا بقیه پاسخ بدهند."
        />
      ) : data ? (
        <div className="space-y-4">
          {data.items.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              canReply={!!user && !c.deleted}
              onReply={() => setReplyTo(c)}
              onDeleteById={(id) => void deleteById(id)}
              onReport={(target) => setReportTarget(target)}
            />
          ))}
        </div>
      ) : null}

      {reportTarget && (
        <ReportDialog
          targetType="comment"
          targetId={reportTarget.id}
          open={!!reportTarget}
          onOpenChange={(open) => !open && setReportTarget(null)}
        />
      )}
    </div>
  );
}

function CommentRow({
  comment,
  canReply,
  onReply,
  onDeleteById,
  onReport,
  isReply = false,
}: {
  comment: PamphletCommentItem;
  canReply: boolean;
  onReply?: () => void;
  onDeleteById: (id: string) => void;
  onReport?: (target: PamphletCommentItem) => void;
  isReply?: boolean;
}) {
  const viewer = useEduStore((s) => s.user);
  const canDelete = !comment.deleted && (comment.isMine || comment.author.isAdmin);
  const canReport = !!viewer && !comment.isMine && !comment.deleted;
  return (
    <article
      className={cn(
        "border-2",
        isReply ? "border-gray-200 bg-gray-50" : "border-ink bg-white"
      )}
    >
      <div className={cn("p-3 md:p-4", isReply && "ms-6 md:ms-10")}>
        <div className="flex flex-wrap items-center gap-2">
          <InitialsAvatar
            name={comment.author.fullName}
            className="size-7 border-2 border-ink bg-primary text-xs"
          />
          <span className="text-sm font-black">{comment.author.fullName}</span>
          {comment.author.isPamphletAuthor && (
            <span className="border-2 border-primary bg-primary/10 px-1.5 text-[11px] font-black text-primary">
              نویسندهٔ جزوه
            </span>
          )}
          {comment.author.isAdmin && (
            <span className="border-2 border-gold bg-gold/15 px-1.5 text-[11px] font-black text-[#8a6a24]">
              مدیر
            </span>
          )}
          <span className="ms-auto text-xs text-gray-400">{faRelative(comment.createdAt)}</span>
        </div>
        {comment.deleted ? (
          <p className="mt-2 text-sm italic text-gray-400">[این پیام حذف شده است]</p>
        ) : (
          <div className="mt-2 text-sm leading-7">
            <MarkdownViewer content={comment.body} />
          </div>
        )}
        {(canReply || canDelete) && (
          <div className="mt-2 flex gap-4 text-xs font-bold">
            {canReply && onReply && (
              <button
                type="button"
                onClick={onReply}
                className="text-gray-500 hover:text-primary"
              >
                پاسخ
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDeleteById(comment.id)}
                className="text-danger hover:underline"
              >
                حذف
              </button>
            )}
            {canReport && onReport && (
              <button
                type="button"
                onClick={() => onReport(comment)}
                className="text-gray-400 hover:text-danger"
              >
                گزارش
              </button>
            )}
          </div>
        )}
        {comment.replies.length > 0 && (
          <div className="mt-3 space-y-2">
            {comment.replies.map((r) => (
              <CommentRow
                key={r.id}
                comment={r}
                canReply={false}
                onDeleteById={onDeleteById}
                onReport={onReport}
                isReply
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
