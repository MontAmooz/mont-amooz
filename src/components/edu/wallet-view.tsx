"use client";

// مُنت‌آموز — Phase 2 wallet view (#/wallet): balance hero, deposit through a mock
// Zarinpal-style gateway («پرداخت‌یار»), withdraw dialog and the transactions ledger.

import { ArrowDownLeft, ArrowUpRight, CreditCard, History, ShieldCheck, Wallet as WalletIcon } from "lucide-react";
import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { WALLET_MAX_DEPOSIT, WALLET_MIN_DEPOSIT, WALLET_MIN_WITHDRAW } from "@/lib/constants";
import { faNumber, faRelative, faSignedAmount, faToman, toFaDigits } from "@/lib/format";
import type { DepositRequestResponse, TxnItem, WalletResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ErrorBox, InfoNote, Spinner, TxnTypeBadge } from "./bits";
import { useFetch } from "./hooks";

const QUICK_AMOUNTS = [50_000, 100_000, 200_000, 500_000];

function parseAmount(raw: string): number {
  // accept Persian digits too
  const normalized = raw
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[,٬,\s]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.floor(n) : NaN;
}

/* ---------------- deposit (amount picker) ---------------- */

function DepositDialog({
  open,
  onOpenChange,
  onAuthority,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** called with the gateway authority after POST /wallet/deposit succeeds */
  onAuthority: (data: DepositRequestResponse) => void;
}) {
  const { toast } = useToast();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const amount = parseAmount(raw);

  const invalid =
    raw.trim() !== "" &&
    (Number.isNaN(amount) ||
      amount < WALLET_MIN_DEPOSIT ||
      amount > WALLET_MAX_DEPOSIT ||
      amount % 1_000 !== 0);

  async function request() {
    if (Number.isNaN(amount) || amount < WALLET_MIN_DEPOSIT || amount > WALLET_MAX_DEPOSIT || amount % 1_000 !== 0) {
      toast({
        title: "مبلغ نامعتبر است",
        description: `مبلغ باید بین ${faToman(WALLET_MIN_DEPOSIT)} تا ${faToman(WALLET_MAX_DEPOSIT)} و مضرب ${faNumber(1_000)} باشد.`,
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const data = await api<DepositRequestResponse>("/wallet/deposit", {
        method: "POST",
        json: { amount },
      });
      onAuthority(data); // → switches to the mock gateway dialog
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "شروع پرداخت ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent className="border-2 border-ink sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">افزایش موجودی کیف پول</DialogTitle>
          <DialogDescription>
            مبلغ شارژ را انتخاب کنید؛ سپس به درگاه پرداخت امن منتقل می‌شوید.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {QUICK_AMOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRaw(String(value))}
                className={cn(
                  "h-11 border-2 border-ink bg-white text-sm font-black transition-all duration-150 hover:bg-gray-50 active:translate-y-0.5",
                  amount === value && "border-ink bg-ink text-white hover:bg-ink"
                )}
                aria-pressed={amount === value}
              >
                {faNumber(value / 1000)} هزار
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dep-amount" className="text-sm font-black">
              مبلغ دلخواه (تومان)
            </Label>
            <Input
              id="dep-amount"
              inputMode="numeric"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={`حداقل ${faNumber(WALLET_MIN_DEPOSIT)}`}
              className="oeg-mono h-11 border-2 bg-white text-base md:h-10"
              aria-invalid={invalid}
            />
            {invalid ? (
              <p className="text-xs font-bold text-danger" role="alert">
                مبلغ باید بین {faToman(WALLET_MIN_DEPOSIT)} تا {faToman(WALLET_MAX_DEPOSIT)} و مضرب{" "}
                {faNumber(1_000)} تومان باشد.
              </p>
            ) : (
              <p className="text-xs text-gray-400">
                {Number.isFinite(amount) && amount >= WALLET_MIN_DEPOSIT && amount % 1_000 === 0
                  ? `پس از پرداخت موفق، ${faToman(amount)} به کیف پول شما اضافه می‌شود.`
                  : `مبلغ باید مضرب ${faNumber(1_000)} تومان باشد.`}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => void request()}
            disabled={busy || invalid || raw.trim() === ""}
            className="h-11 w-full border-2 border-ink font-black sm:w-auto sm:px-6 md:h-10"
          >
            {busy ? <Spinner /> : <ArrowUpRight className="size-4" aria-hidden="true" />}
            ادامه و پرداخت
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- mock payment gateway ---------------- */

function GatewayDialog({
  data,
  onDone,
}: {
  data: DepositRequestResponse | null;
  /** called after verify settles (success or fail) so the wallet can refresh */
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<"pay" | "cancel" | null>(null);

  async function verify(result: "success" | "fail") {
    if (!data) return;
    setBusy(result === "success" ? "pay" : "cancel");
    try {
      await api<{ balance: number }>("/wallet/deposit/verify", {
        method: "POST",
        json: { authority: data.authority, result },
      });
      if (result === "success") {
        toast({
          title: "پرداخت با موفقیت انجام شد",
          description: `${faToman(data.amount)} به کیف پول شما اضافه شد.`,
        });
      } else {
        toast({
          title: "پرداخت لغو شد",
          description: "مبلغی از حساب شما کسر نشد؛ تراکنش در وضعیت ناموفق ثبت شد.",
        });
      }
      onDone();
    } catch (err) {
      toast({
        title: "تأیید پرداخت ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog
      open={data !== null}
      onOpenChange={(next) => {
        // closing the gateway without paying counts as abandoning the payment
        if (!next && data && busy === null) void verify("fail");
      }}
    >
      <DialogContent className="border-2 border-ink p-0 sm:max-w-md">
        <DialogTitle className="sr-only">درگاه پرداخت امن پرداخت‌یار</DialogTitle>
        <DialogDescription className="sr-only">
          صفحهٔ درگاه پرداخت شبیه‌سازی‌شده برای شارژ کیف پول
        </DialogDescription>
        {/* gateway chrome */}
        <div className="flex items-center justify-between border-b-2 border-ink bg-ink px-4 py-3 text-white">
          <span className="flex items-center gap-2 font-black">
            <ShieldCheck className="size-5 text-gold" aria-hidden="true" />
            درگاه پرداخت امن
          </span>
          <span className="oeg-mono border-2 border-gold bg-gold px-2 py-0.5 text-xs font-black text-white">
            پرداخت‌یار
          </span>
        </div>

        <div className="space-y-4 p-4 md:p-5">
          <div className="grid grid-cols-2 border-2 border-gray-200 text-sm">
            <div className="border-e-2 border-gray-200 p-3">
              <p className="text-xs text-gray-400">پرداخت به</p>
              <p className="mt-1 font-black">اُپن‌ای‌دیو گیت</p>
            </div>
            <div className="p-3">
              <p className="text-xs text-gray-400">مبلغ قابل پرداخت</p>
              <p className="oeg-mono mt-1 font-black text-primary">{data ? faToman(data.amount) : "—"}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-gray-500">شماره کارت</Label>
              <div
                className="oeg-mono flex h-11 items-center border-2 border-gray-200 bg-gray-100 px-3 text-base font-bold tracking-widest text-gray-500 md:h-10"
                aria-label="شماره کارت نمونه"
              >
                ۶۰۳۷-۹۹-۷۵-۱۲۳۴-۵۶۷۸
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-black text-gray-500">تاریخ انقضا</Label>
                <div
                  className="oeg-mono flex h-11 items-center border-2 border-gray-200 bg-gray-100 px-3 font-bold text-gray-500 md:h-10"
                  aria-label="تاریخ انقضای کارت نمونه"
                >
                  ۰۸/۰۸
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-black text-gray-500">CVV2</Label>
                <div
                  className="oeg-mono flex h-11 items-center border-2 border-gray-200 bg-gray-100 px-3 font-bold text-gray-500 md:h-10"
                  aria-label="کد CVV2 نمونه"
                >
                  ***
                </div>
              </div>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-gray-400">
              <CreditCard className="size-4" aria-hidden="true" />
              کارت نمونه به‌صورت خودکار ثبت شده است؛ نیازی به وارد کردن اطلاعات نیست.
            </p>
          </div>

          <InfoNote>درگاه پرداخت در این نسخهٔ نمایشی شبیه‌سازی شده است؛ هیچ مبلغ واقعی جابه‌جا نمی‌شود.</InfoNote>
        </div>

        <div className="flex flex-col gap-2 border-t-2 border-gray-100 p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <button
            type="button"
            onClick={() => void verify("fail")}
            disabled={busy !== null}
            className="h-11 text-sm font-bold text-gray-500 underline-offset-4 transition-colors hover:text-danger hover:underline md:h-10"
          >
            {busy === "cancel" ? "در حال انصراف…" : "انصراف از پرداخت"}
          </button>
          <Button
            onClick={() => void verify("success")}
            disabled={busy !== null}
            className="h-12 border-2 border-ink bg-success px-8 text-base font-black text-white hover:bg-success/90 md:h-11"
          >
            {busy === "pay" ? <Spinner /> : <ShieldCheck className="size-5" aria-hidden="true" />}
            پرداخت {data ? toFaDigits(faNumber(data.amount)) + " تومان" : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- withdraw ---------------- */

function WithdrawDialog({
  open,
  onOpenChange,
  balance,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance: number;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const amount = parseAmount(raw);

  function close() {
    setRaw("");
    setError(null);
    onOpenChange(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (Number.isNaN(amount) || amount < WALLET_MIN_WITHDRAW) {
      setError(`حداقل مبلغ برداشت ${faToman(WALLET_MIN_WITHDRAW)} است.`);
      return;
    }
    if (amount > balance) {
      setError("موجودی کافی نیست؛ مبلغ را کاهش دهید.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api<{ balance: number }>("/wallet/withdraw", {
        method: "POST",
        json: { amount },
      });
      toast({
        title: "برداشت ثبت شد",
        description: `${faToman(amount)} از کیف پول شما برداشت شد.`,
      });
      close();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای نامشخص رخ داد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="border-2 border-ink sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">برداشت از کیف پول</DialogTitle>
          <DialogDescription>
            موجودی فعلی شما {faToman(balance)} است؛ مبلغ برداشت بلافاصله ثبت می‌شود.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="wd-amount" className="text-sm font-black">
              مبلغ برداشت (تومان)
            </Label>
            <Input
              id="wd-amount"
              inputMode="numeric"
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setError(null);
              }}
              placeholder={`حداقل ${faNumber(WALLET_MIN_WITHDRAW)}`}
              className="oeg-mono h-11 border-2 bg-white text-base md:h-10"
              aria-invalid={!!error}
            />
            {error ? (
              <p className="text-xs font-bold text-danger" role="alert">
                {error}
              </p>
            ) : (
              <p className="text-xs text-gray-400">
                حداقل {faToman(WALLET_MIN_WITHDRAW)} و حداکثر تا میزان موجودی.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={busy || raw.trim() === ""}
              className="h-11 w-full border-2 border-ink font-black sm:w-auto sm:px-6 md:h-10"
            >
              {busy ? <Spinner /> : <ArrowDownLeft className="size-4" aria-hidden="true" />}
              ثبت برداشت
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- transactions ---------------- */

function TxnRow({ txn }: { txn: TxnItem }) {
  const pending = txn.status === "PENDING";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b-2 border-gray-100 px-4 py-3 last:border-b-0">
      <TxnTypeBadge type={txn.type} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-700">{txn.description}</p>
        <p className="text-xs text-gray-400">{faRelative(txn.createdAt)}</p>
      </div>
      <div className="text-left">
        <p
          className={cn(
            "oeg-mono text-sm font-black",
            pending ? "text-gray-400" : txn.amount >= 0 ? "text-success" : "text-primary"
          )}
        >
          {faSignedAmount(txn.amount)}
        </p>
        <p className="text-xs text-gray-400">
          {pending ? (
            <span className="flex items-center justify-end gap-1 font-bold text-gold">
              <Spinner /> در انتظار پرداخت
            </span>
          ) : (
            <>موجودی: {faNumber(txn.balanceAfter)}</>
          )}
        </p>
      </div>
    </li>
  );
}

/* ---------------- main view ---------------- */

export default function WalletView() {
  const wallet = useFetch<WalletResponse>(() => api<WalletResponse>("/wallet"), []);
  const [depositOpen, setDepositOpen] = useState(false);
  const [gateway, setGateway] = useState<DepositRequestResponse | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const balance = wallet.data?.balance ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-black">کیف پول</h1>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-gray-500">
        شارژ، برداشت و خریدهای شما در بازارچهٔ تدریس از این کیف پول انجام می‌شود؛
        سهم معلم‌ها هم پس از برگزاری جلسه به همین کیف پول واریز می‌شود.
      </p>

      {/* balance hero */}
      <div className="mt-6 border-2 border-ink bg-ink p-6 text-white md:p-8">
        {wallet.loading ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-5 w-32 bg-white/15" />
            <Skeleton className="h-12 w-56 bg-white/15" />
          </div>
        ) : wallet.error ? (
          <ErrorBox message={wallet.error} onRetry={wallet.retry} compact />
        ) : (
          <>
            <p className="flex items-center gap-2 text-sm font-bold text-white/60">
              <WalletIcon className="size-4 text-gold" aria-hidden="true" />
              موجودی فعلی
            </p>
            <p className="mt-2 flex flex-wrap items-baseline gap-2">
              <span className="oeg-mono text-4xl font-black md:text-5xl">{faNumber(balance)}</span>
              <span className="text-lg font-bold text-white/60">تومان</span>
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                onClick={() => setDepositOpen(true)}
                className="oeg-hard-shadow h-12 border-2 border-white bg-gold px-6 text-base font-black text-white transition-all duration-150 hover:bg-gold/90 active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                <ArrowUpRight className="size-5" aria-hidden="true" /> افزایش موجودی
              </Button>
              <Button
                variant="outline"
                onClick={() => setWithdrawOpen(true)}
                disabled={balance < WALLET_MIN_WITHDRAW}
                className="h-12 border-2 border-white bg-transparent px-6 text-base font-black text-white hover:bg-white/10 disabled:opacity-40 md:h-11"
              >
                <ArrowDownLeft className="size-5" aria-hidden="true" /> برداشت
              </Button>
            </div>
          </>
        )}
      </div>

      {/* transactions */}
      <section className="mt-8" aria-label="تراکنش‌های کیف پول">
        <h2 className="flex items-center gap-2 text-xl font-black">
          <History className="size-5 text-primary" aria-hidden="true" /> تراکنش‌ها
        </h2>
        <div className="mt-4 border-2 border-ink bg-white">
          {wallet.loading ? (
            <div className="space-y-3 p-4" aria-busy="true">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : wallet.error ? (
            <div className="p-4">
              <ErrorBox message={wallet.error} onRetry={wallet.retry} compact />
            </div>
          ) : wallet.data && wallet.data.transactions.length > 0 ? (
            <ul className="oeg-scroll max-h-96 overflow-y-auto">
              {wallet.data.transactions.map((txn) => (
                <TxnRow key={txn.id} txn={txn} />
              ))}
            </ul>
          ) : (
            <p className="p-8 text-center text-sm text-gray-500">
              هنوز تراکنشی ثبت نشده است؛ با شارژ کیف پول شروع کنید.
            </p>
          )}
        </div>
        {wallet.data && wallet.data.transactions.length > 8 && (
          <p className="mt-2 text-xs text-gray-400">
            {toFaDigits(wallet.data.transactions.length)} تراکنش آخر نمایش داده می‌شود.
          </p>
        )}
      </section>

      <DepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        onAuthority={(data) => setGateway(data)}
      />
      <GatewayDialog
        data={gateway}
        onDone={() => {
          setGateway(null);
          wallet.retry();
        }}
      />
      <WithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        balance={balance}
        onDone={() => wallet.retry()}
      />
    </div>
  );
}
