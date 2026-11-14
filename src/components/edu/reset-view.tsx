"use client";

// مُنت‌آموز — password reset confirmation (#/reset, P10).
// The user enters the 32-char token the admin handed them (WhatsApp/Telegram)
// and picks a new password. No email involved.

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { Spinner } from "./bits";
import { navigate } from "./router";

export function ResetConfirmView() {
  const { toast } = useToast();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) {
      setError("کد بازنشانی را وارد کنید.");
      return;
    }
    if (password.length < 8) {
      setError("رمز جدید باید حداقل ۸ کاراکتر باشد.");
      return;
    }
    if (password !== confirm) {
      setError("رمز جدید و تکرار آن یکسان نیستند.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/auth/reset/confirm", {
        method: "POST",
        json: { token: token.trim(), newPassword: password },
      });
      toast({
        title: "رمز تغییر کرد. اکنون وارد شوید.",
        description: "با رمز جدید و ایمیل خود وارد حساب شوید.",
      });
      navigate("#/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای نامشخص رخ داد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="border-2 border-ink bg-white p-6 md:p-8">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <KeyRound className="size-6 text-primary" aria-hidden="true" /> بازنشانی رمز عبور
        </h1>
        <p className="mt-2 text-sm leading-7 text-gray-500">
          کد ۳۲ نویسه‌ای که مدیر برایتان فرستاده را وارد کنید و رمز جدید را انتخاب کنید.
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="reset-token" className="text-sm font-black">کد بازنشانی</Label>
            <Input
              id="reset-token"
              dir="ltr"
              value={token}
              onChange={(e) => setToken(e.target.value.toUpperCase())}
              placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              autoComplete="off"
              className="oeg-mono h-11 border-2 bg-white tracking-widest md:h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reset-password" className="text-sm font-black">رمز جدید</Label>
            <Input
              id="reset-password"
              dir="ltr"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 border-2 bg-white md:h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reset-confirm" className="text-sm font-black">تکرار رمز جدید</Label>
            <Input
              id="reset-confirm"
              dir="ltr"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-11 border-2 bg-white md:h-10"
            />
          </div>
          {error && (
            <p className="text-xs font-bold text-danger" role="alert">{error}</p>
          )}
          <Button
            type="submit"
            disabled={busy}
            className="h-11 w-full border-2 border-ink font-black md:h-10"
          >
            {busy && <Spinner />} ثبت رمز جدید
          </Button>
        </form>
      </div>
    </div>
  );
}
