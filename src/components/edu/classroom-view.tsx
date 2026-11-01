"use client";

// مُنت‌آموز — Phase 2 realtime classroom (#/session/{id}): socket.io chat +
// collaborative whiteboard (normalized strokes, dpr-aware canvas, undo/clear),
// presence, and member-gated access (403 → ErrorBox). Read-only after end/cancel.

import {
  ArrowRight,
  CheckCheck,
  Eraser,
  MessageSquare,
  Paintbrush,
  Pencil,
  Send,
  Trash2,
  Undo2,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { faDateTime, faToman, faTime } from "@/lib/format";
import type { SessionDetail, SessionMessageItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ErrorBox, InfoNote, InitialsAvatar, PageSkeleton, SessionStatusBadge, Spinner } from "./bits";
import { useFetch } from "./hooks";
import { navigate } from "./router";
import { useEduStore } from "./store";
import { useClassroom, type BoardPoint, type BoardStroke } from "./use-classroom";

const PEN_COLORS = ["#111827", "#DD614C", "#DAA144", "#16A34A", "#DC2626"] as const;
const PEN_WIDTHS = [
  { value: 2, label: "نازک", box: "h-2 w-2" },
  { value: 4, label: "متوسط", box: "h-3.5 w-3.5" },
  { value: 9, label: "ضخیم", box: "h-5 w-5" },
] as const;
const ERASER_WIDTH = 28;

/* ---------------- whiteboard ---------------- */

function drawSegment(
  ctx: CanvasRenderingContext2D,
  from: BoardPoint,
  to: BoardPoint,
  w: number,
  h: number,
  color: string,
  width: number
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(from.x * w, from.y * h);
  ctx.lineTo(to.x * w, to.y * h);
  ctx.stroke();
}

function drawWholeStroke(ctx: CanvasRenderingContext2D, stroke: BoardStroke, w: number, h: number) {
  const color = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
  for (let i = 1; i < stroke.points.length; i++) {
    drawSegment(ctx, stroke.points[i - 1], stroke.points[i], w, h, color, stroke.width);
  }
  // dot for single-point taps
  if (stroke.points.length === 1) {
    const p = stroke.points[0];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, stroke.width / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function Whiteboard({
  strokes,
  myUid,
  disabled,
  onCommit,
  onUndo,
  onClear,
}: {
  strokes: BoardStroke[];
  myUid: string;
  disabled: boolean;
  onCommit: (stroke: BoardStroke) => void;
  onUndo: () => void;
  onClear: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef(strokes);
  const drawingRef = useRef<BoardStroke | null>(null);
  const [color, setColor] = useState<string>("#111827");
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [width, setWidth] = useState<number>(4);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    // subtle dot-grid paper
    ctx.save();
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    for (let gx = 32; gx < w; gx += 32) {
      ctx.beginPath();
      ctx.moveTo(gx + 0.5, 0);
      ctx.lineTo(gx + 0.5, h);
      ctx.stroke();
    }
    for (let gy = 32; gy < h; gy += 32) {
      ctx.beginPath();
      ctx.moveTo(0, gy + 0.5);
      ctx.lineTo(w, gy + 0.5);
      ctx.stroke();
    }
    ctx.restore();
    for (const stroke of strokesRef.current) {
      drawWholeStroke(ctx, stroke, w, h);
    }
  }, []);

  // dpr-aware sizing + redraw on resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [redraw]);

  useEffect(() => {
    redraw();
  }, [strokes, redraw]);

  function pointOf(e: React.PointerEvent<HTMLCanvasElement>): BoardPoint {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  function handleDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const stroke: BoardStroke = {
      uid: myUid,
      color,
      width: tool === "eraser" ? ERASER_WIDTH : width,
      tool,
      points: [pointOf(e)],
    };
    drawingRef.current = stroke;
    const ctx = e.currentTarget.getContext("2d");
    if (ctx) {
      drawWholeStroke(ctx, stroke, e.currentTarget.clientWidth, e.currentTarget.clientHeight);
    }
  }

  function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = drawingRef.current;
    if (!stroke) return;
    const point = pointOf(e);
    const prev = stroke.points[stroke.points.length - 1];
    stroke.points.push(point);
    const ctx = e.currentTarget.getContext("2d");
    if (ctx) {
      drawSegment(
        ctx,
        prev,
        point,
        e.currentTarget.clientWidth,
        e.currentTarget.clientHeight,
        stroke.tool === "eraser" ? "#ffffff" : stroke.color,
        stroke.width
      );
    }
  }

  function handleUp() {
    const stroke = drawingRef.current;
    drawingRef.current = null;
    if (stroke) onCommit(stroke);
  }

  return (
    <section aria-label="تختهٔ سفید تعاملی" className="flex flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-ink bg-white p-2">
        <div className="flex items-center gap-1" role="group" aria-label="رنگ قلم">
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setColor(c);
                setTool("pen");
              }}
              aria-label={`رنگ ${c}`}
              aria-pressed={tool === "pen" && color === c}
              className={cn(
                "size-8 border-2 transition-all duration-100",
                tool === "pen" && color === c
                  ? "scale-110 border-ink shadow-[2px_2px_0_0_#111827]"
                  : "border-gray-200 hover:border-ink"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <span className="h-6 w-0.5 bg-gray-200" aria-hidden="true" />

        <div className="flex items-center gap-1" role="group" aria-label="ابزار">
          <button
            type="button"
            onClick={() => setTool("pen")}
            aria-pressed={tool === "pen"}
            aria-label="قلم"
            className={cn(
              "flex size-9 items-center justify-center border-2 transition-colors",
              tool === "pen" ? "border-ink bg-ink text-white" : "border-gray-200 bg-white hover:border-ink"
            )}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setTool("eraser")}
            aria-pressed={tool === "eraser"}
            aria-label="پاک‌کن"
            className={cn(
              "flex size-9 items-center justify-center border-2 transition-colors",
              tool === "eraser" ? "border-ink bg-ink text-white" : "border-gray-200 bg-white hover:border-ink"
            )}
          >
            <Eraser className="size-4" aria-hidden="true" />
          </button>
        </div>

        <span className="h-6 w-0.5 bg-gray-200" aria-hidden="true" />

        <div className="flex items-center gap-1" role="group" aria-label="ضخامت قلم">
          {PEN_WIDTHS.map((w) => (
            <button
              key={w.value}
              type="button"
              onClick={() => {
                setWidth(w.value);
                setTool("pen");
              }}
              aria-label={`ضخامت ${w.label}`}
              aria-pressed={tool === "pen" && width === w.value}
              className={cn(
                "flex size-9 items-center justify-center border-2 transition-colors",
                tool === "pen" && width === w.value
                  ? "border-ink bg-ink"
                  : "border-gray-200 bg-white hover:border-ink"
              )}
            >
              <span className={cn("rounded-full bg-ink", w.box)} aria-hidden="true" />
            </button>
          ))}
        </div>

        <div className="ms-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onUndo}
            disabled={disabled}
            className="h-9 border-2 border-gray-200 font-bold hover:border-ink"
          >
            <Undo2 className="size-4" aria-hidden="true" /> بازگردانی
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                className="h-9 border-2 border-danger font-bold text-danger hover:bg-danger/10"
              >
                <Trash2 className="size-4" aria-hidden="true" /> پاک کردن همه
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-2 border-ink">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-black">کل تخته پاک شود؟</AlertDialogTitle>
                <AlertDialogDescription className="leading-7">
                  همهٔ خطوط تختهٔ سفید برای هر دو شرکت‌کننده پاک می‌شود.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="h-11 border-2 border-ink font-bold md:h-10">انصراف</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onClear}
                  className="h-11 border-2 border-ink bg-danger font-black text-white hover:bg-danger/90 md:h-10"
                >
                  بله، پاک کن
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="تختهٔ سفید کلاس — با ماوس یا لمس روی آن بکشید"
          className={cn(
            "block h-[380px] w-full touch-none border-ink bg-white md:h-[520px]",
            disabled ? "cursor-not-allowed opacity-60" : "cursor-crosshair"
          )}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
        />
        {disabled && (
          <p className="absolute inset-0 flex items-center justify-center bg-white/60 p-4 text-center text-sm font-black text-gray-500">
            تختهٔ سفید فقط در طول جلسهٔ رزروشده فعال است.
          </p>
        )}
      </div>
    </section>
  );
}

/* ---------------- chat ---------------- */

function ChatPanel({
  messages,
  myId,
  teacherId,
  disabled,
  placeholder,
  onSend,
}: {
  messages: SessionMessageItem[];
  myId?: string;
  teacherId: string;
  disabled: boolean;
  placeholder: string;
  onSend: (body: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // keep the latest message in view (DOM-only effect — no state)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const ok = await onSend(body);
    if (ok) setText("");
    setSending(false);
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-2 border-ink bg-white" aria-label="گفت‌وگوی زندهٔ کلاس">
      <h2 className="flex items-center gap-2 border-b-2 border-ink px-4 py-3 font-black">
        <MessageSquare className="size-4 text-primary" aria-hidden="true" /> گفت‌وگو
      </h2>

      <ul className="oeg-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <li className="py-8 text-center text-sm text-gray-400">
            هنوز پیامی رد و بدل نشده است؛ اولین نفر باشید!
          </li>
        )}
        {messages.map((message) => {
          const mine = message.sender.id === myId;
          const isTeacher = message.sender.id === teacherId;
          return (
            <li
              key={message.id}
              className={cn(
                "border-2 border-gray-100 p-3",
                mine ? "border-s-4 border-s-primary bg-primary/10" : "bg-gray-50"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black">{message.sender.fullName}</span>
                <span
                  className={cn(
                    "border px-1.5 py-0.5 text-[10px] font-bold",
                    isTeacher
                      ? "border-gold bg-gold/15 text-[#8a6a24]"
                      : "border-gray-300 bg-white text-gray-600"
                  )}
                >
                  {isTeacher ? "معلم" : "دانش‌آموز"}
                </span>
                <span className="oeg-mono ms-auto text-[11px] text-gray-400">{faTime(message.createdAt)}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-7 text-gray-800">
                {message.body}
              </p>
            </li>
          );
        })}
        <div ref={bottomRef} aria-hidden="true" />
      </ul>

      <form onSubmit={submit} className="flex gap-2 border-t-2 border-ink p-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || sending}
          aria-label="پیام جدید"
          className="h-11 min-w-0 flex-1 border-2 border-gray-200 bg-white focus-visible:border-primary md:h-10"
          maxLength={1000}
        />
        <Button
          type="submit"
          disabled={disabled || sending || text.trim() === ""}
          className="h-11 w-11 shrink-0 border-2 border-ink p-0 font-black md:h-10 md:w-10"
          aria-label="ارسال پیام"
        >
          {sending ? <Spinner /> : <Send className="size-4" aria-hidden="true" />}
        </Button>
      </form>
    </div>
  );
}

/* ---------------- main view ---------------- */

export default function ClassroomView({ id }: { id: string }) {
  const { toast } = useToast();
  const { user } = useEduStore();

  const detail = useFetch<SessionDetail>(
    () => api<SessionDetail>(`/sessions/${id}`),
    [id, user?.id]
  );

  if (detail.loading && !detail.data) {
    return <PageSkeleton />;
  }
  if (detail.error || !detail.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorBox message={detail.error ?? "جلسه پیدا نشد."} onRetry={detail.retry} />
      </div>
    );
  }

  return <ClassroomLive key={id} session={detail.data} user={user} onRefresh={detail.retry} />;
}

function ClassroomLive({
  session,
  user,
  onRefresh,
}: {
  session: SessionDetail;
  user: ReturnType<typeof useEduStore.getState>["user"];
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const isTeacher = session.myRole === "teacher";
  const readOnly = session.status !== "BOOKED";
  const [ownMessages, setOwnMessages] = useState<SessionMessageItem[]>([]);
  const [acting, setActing] = useState<"cancel" | "complete" | null>(null);

  const classroom = useClassroom(session.id, { enabled: !readOnly });

  // one-shot toast when the live connection drops (not on every retry)
  const dropToastedRef = useRef(false);
  useEffect(() => {
    if (classroom.error && !dropToastedRef.current) {
      dropToastedRef.current = true;
      toast({
        title: "ارتباط زنده قطع است",
        description: classroom.error,
        variant: "destructive",
      });
    }
    if (classroom.connected) dropToastedRef.current = false;
  }, [classroom.error, classroom.connected, toast]);

  // REST history + external socket messages + own sent messages (dedup by id)
  const messages = useMemo(() => {
    const map = new Map<string, SessionMessageItem>();
    for (const message of session.messages) map.set(message.id, message);
    for (const message of classroom.chatMessages) map.set(message.id, message);
    for (const message of ownMessages) map.set(message.id, message);
    return [...map.values()].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [session.messages, classroom.chatMessages, ownMessages]);

  async function sendChat(body: string): Promise<boolean> {
    try {
      const { message } = await api<{ message: SessionMessageItem }>(
        `/sessions/${session.id}/messages`,
        { method: "POST", json: { body } }
      );
      setOwnMessages((prev) => [...prev, message]);
      classroom.sendChat(message); // relay to the other participant
      return true;
    } catch (err) {
      toast({
        title: "ارسال پیام ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
      return false;
    }
  }

  async function endSession() {
    setActing("complete");
    try {
      await api(`/sessions/${session.id}/complete`, { method: "POST" });
      toast({
        title: "جلسه پایان یافت",
        description: `سهم شما (${faToman(session.teacherShare)}) به کیف پولتان واریز شد.`,
      });
      onRefresh();
    } catch (err) {
      toast({
        title: "پایان جلسه ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setActing(null);
    }
  }

  async function cancelSession() {
    setActing("cancel");
    try {
      await api(`/sessions/${session.id}/cancel`, { method: "POST" });
      toast({ title: "جلسه لغو شد" });
      onRefresh();
    } catch (err) {
      toast({
        title: "لغو جلسه ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setActing(null);
    }
  }

  const participants = [
    { id: session.teacher.id, name: session.teacher.fullName, role: "معلم" },
    { id: session.student.id, name: session.student.fullName, role: "دانش‌آموز" },
  ];

  const connection = classroom.connected ? (
    <span className="flex items-center gap-1.5 border-2 border-success bg-success/10 px-2 py-1 text-xs font-black text-success">
      <Wifi className="size-3.5" aria-hidden="true" /> متصل
    </span>
  ) : classroom.connecting ? (
    <span className="flex items-center gap-1.5 border-2 border-gray-200 bg-gray-50 px-2 py-1 text-xs font-bold text-gray-500">
      <Spinner /> در حال اتصال…
    </span>
  ) : (
    <span className="flex items-center gap-1.5 border-2 border-danger bg-danger/10 px-2 py-1 text-xs font-black text-danger">
      <WifiOff className="size-3.5" aria-hidden="true" /> قطع
    </span>
  );

  const board = (
    <Whiteboard
      strokes={classroom.strokes}
      myUid={user?.id ?? "anonymous"}
      disabled={readOnly || !classroom.connected}
      onCommit={classroom.sendStroke}
      onUndo={() => classroom.undoStroke(user?.id ?? "")}
      onClear={classroom.clearBoard}
    />
  );

  const chat = (
    <ChatPanel
      messages={messages}
      myId={user?.id}
      teacherId={session.teacher.id}
      disabled={readOnly || !classroom.connected}
      placeholder={readOnly ? "جلسه پایان یافته است" : "پیام خود را بنویسید…"}
      onSend={sendChat}
    />
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <a
        href="#/sessions"
        className="inline-flex h-9 items-center gap-1 text-sm font-bold text-gray-500 transition-colors hover:text-primary"
      >
        <ArrowRight className="size-4" aria-hidden="true" /> کلاس‌های من
      </a>

      {/* ---------- header ---------- */}
      <div className="mt-3 border-2 border-ink bg-white p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <SessionStatusBadge status={session.status} />
          <h1 className="min-w-0 flex-1 text-xl font-black md:text-2xl">
            {session.topic || "جلسهٔ تدریس"}
          </h1>
          <span
            className="oeg-mono border-2 border-ink bg-gray-50 px-2 py-1 text-sm font-black tracking-widest"
            aria-label={`کد جلسه ${session.meetingCode}`}
          >
            {session.meetingCode}
          </span>
          {connection}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t-2 border-gray-100 pt-4">
          <div className="flex items-center gap-4">
            {participants.map((participant) => {
              const online = classroom.members.some(
                (m) => m.uid === participant.id && m.online
              );
              return (
                <span key={participant.id} className="flex items-center gap-2">
                  <span className="relative inline-flex">
                    <InitialsAvatar name={participant.name} className="size-10 border-2 border-ink text-xs" />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute -bottom-0.5 -start-0.5 size-3 border-2 border-white",
                        online ? "bg-success" : "bg-gray-300"
                      )}
                    />
                  </span>
                  <span className="text-sm">
                    <span className="block font-bold leading-5">{participant.name}</span>
                    <span className={cn("text-xs", participant.id === session.teacher.id ? "font-bold text-[#8a6a24]" : "text-gray-500")}>
                      {participant.role}
                    </span>
                  </span>
                </span>
              );
            })}
            <span className="hidden items-center gap-1 text-xs text-gray-400 sm:flex">
              <Users className="size-3.5" aria-hidden="true" />
              {faDateTime(session.startAt)}
            </span>
          </div>

          {session.status === "BOOKED" && (
            <div className="flex flex-wrap gap-2">
              {isTeacher && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      disabled={acting !== null}
                      className="h-11 border-2 border-ink bg-success px-5 font-black text-white hover:bg-success/90 md:h-10"
                    >
                      {acting === "complete" ? <Spinner /> : <CheckCheck className="size-4" aria-hidden="true" />}
                      پایان جلسه
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-2 border-ink">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-black">پایان جلسه را ثبت می‌کنید؟</AlertDialogTitle>
                      <AlertDialogDescription className="leading-7">
                        با پایان جلسه، سهم شما ({faToman(session.teacherShare)}) به کیف پولتان واریز
                        می‌شود و تختهٔ سفید و گفت‌وگو به حالت فقط‌خواندنی می‌رود.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="h-11 border-2 border-ink font-bold md:h-10" disabled={acting !== null}>
                        انصراف
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          e.preventDefault();
                          void endSession();
                        }}
                        disabled={acting !== null}
                        className="h-11 border-2 border-ink bg-success font-black text-white hover:bg-success/90 md:h-10"
                      >
                        بله، پایان جلسه
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={acting !== null}
                    className="h-11 border-2 border-danger font-bold text-danger hover:bg-danger/10 md:h-10"
                  >
                    {acting === "cancel" ? <Spinner /> : <X className="size-4" aria-hidden="true" />}
                    لغو جلسه
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-2 border-ink">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-black">لغو این جلسه؟</AlertDialogTitle>
                    <AlertDialogDescription className="leading-7">
                      {isTeacher
                        ? "کل مبلغ پرداختی به کیف پول دانش‌آموز بازگردانده می‌شود."
                        : "اگر بیش از ۲ ساعت تا شروع مانده باشد کل مبلغ برمی‌گردد؛ وگرنه ۵۰٪ به‌عنوان غرامت معلم کسر می‌شود."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="h-11 border-2 border-ink font-bold md:h-10" disabled={acting !== null}>
                      انصراف
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        void cancelSession();
                      }}
                      disabled={acting !== null}
                      className="h-11 border-2 border-ink bg-danger font-black text-white hover:bg-danger/90 md:h-10"
                    >
                      بله، لغو کن
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <InfoNote>
          صدا و تصویر در این نسخهٔ نمایشی فعال نیست؛ تختهٔ سفید تعاملی و گفت‌وگوی زنده فعال است.
        </InfoNote>
        {readOnly && (
          <p
            className="border-2 border-ink bg-ink px-4 py-3 text-center text-sm font-black text-white"
            role="status"
          >
            {session.status === "COMPLETED"
              ? "جلسه پایان یافته — گفت‌وگو و تختهٔ سفید در حالت فقط‌خواندنی است."
              : "این جلسه لغو شده است — گفت‌وگو و تختهٔ سفید در حالت فقط‌خواندنی است."}
          </p>
        )}
      </div>

      {/* ---------- board + chat ---------- */}
      <div className="mt-4">
        {/* desktop: side-by-side */}
        <div className="hidden gap-4 lg:grid lg:grid-cols-[1fr_340px]">
          <div className="border-2 border-ink bg-white">{board}</div>
          <div className="h-[calc(380px+3.25rem)] lg:h-[calc(520px+3.25rem)]">{chat}</div>
        </div>

        {/* mobile / tablet: tabs */}
        <Tabs defaultValue="board" className="gap-4 lg:hidden">
          <TabsList className="h-11 grid-cols-2">
            <TabsTrigger value="board" className="gap-1.5 font-bold">
              <Paintbrush className="size-4" aria-hidden="true" /> تختهٔ سفید
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-1.5 font-bold">
              <MessageSquare className="size-4" aria-hidden="true" /> گفت‌وگو
            </TabsTrigger>
          </TabsList>
          <TabsContent value="board" className="border-2 border-ink bg-white">
            {board}
          </TabsContent>
          <TabsContent value="chat" className="h-[520px]">
            {chat}
          </TabsContent>
        </Tabs>
      </div>

      {classroom.connecting && !classroom.error && !readOnly && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm font-bold text-gray-500" aria-live="polite">
          <Spinner /> در حال برقراری ارتباط زنده با کلاس…
        </div>
      )}
      {classroom.error && !readOnly && (
        <div className="mt-4">
          <InfoNote>{classroom.error} می‌توانید صفحه را نوسازی کنید یا بعداً دوباره تلاش کنید.</InfoNote>
        </div>
      )}
    </div>
  );
}
