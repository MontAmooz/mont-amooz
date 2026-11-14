"use client";

// مُنت‌آموز — login/register dialog (tabs), controlled by the global store.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { ROLES } from "@/lib/constants";
import type { PublicUser } from "@/lib/types";
import { InfoNote, Spinner } from "./bits";
import { useEduStore } from "./store";

export function AuthDialog() {
  const { authOpen, authHint, closeAuth, setUser } = useEduStore();
  const { toast } = useToast();

  const [tab, setTab] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState<string>(ROLES[0]);
  // P10 — honeypot: visually hidden, tabbable=false; humans never fill it
  const [websiteHoneypot, setWebsiteHoneypot] = useState("");

  // Reset stale error/busy whenever the dialog reopens — adjust state during
  // render on prop change (react.dev/learn/you-might-not-need-an-effect).
  const [prevAuthOpen, setPrevAuthOpen] = useState(authOpen);
  if (authOpen !== prevAuthOpen) {
    setPrevAuthOpen(authOpen);
    if (authOpen) {
      setError(null);
      setBusy(false);
    }
  }

  function validate(mode: "login" | "register"): string | null {
    if (mode === "login") {
      if (!loginEmail.trim()) return "نشانی ایمیل را وارد کنید.";
      if (!loginPassword) return "رمز عبور را وارد کنید.";
      return null;
    }
    if (!regName.trim()) return "نام و نام‌خانوادگی را وارد کنید.";
    if (!regEmail.trim()) return "نشانی ایمیل را وارد کنید.";
    if (regPassword.length < 6) return "رمز عبور باید حداقل ۶ کاراکتر باشد.";
    return null;
  }

  async function submit(mode: "login" | "register") {
    const validationError = validate(mode);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body =
        mode === "login"
          ? { email: loginEmail.trim(), password: loginPassword, rememberMe }
          : {
              email: regEmail.trim(),
              password: regPassword,
              fullName: regName.trim(),
              role: regRole,
              website: websiteHoneypot, // honeypot — must stay empty
            };
      const { user } = await api<{ user: PublicUser }>(
        mode === "login" ? "/auth/login" : "/auth/register",
        { method: "POST", json: body }
      );
      setUser(user);
      closeAuth();
      setLoginPassword("");
      setRegPassword("");
      setWebsiteHoneypot("");
      toast({
        title: `خوش آمدید ${user.fullName}!`,
        description: "حالا می‌توانید جزوه بگذارید، فورک کنید و بازخورد بدهید.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای نامشخص رخ داد.");
    } finally {
      setBusy(false);
    }
  }

  const errorBox = error && (
    <p className="text-xs font-bold text-danger" role="alert">
      {error}
    </p>
  );

  return (
    <Dialog open={authOpen} onOpenChange={(open) => !open && closeAuth()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-2 border-ink sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">ورود / ثبت‌نام</DialogTitle>
          <DialogDescription>
            به مُنت‌آموز بپیوندید — کتابخانهٔ زندهٔ جزوه‌های درسی ایران.
          </DialogDescription>
        </DialogHeader>

        {authHint && <InfoNote>{authHint}</InfoNote>}

        <Tabs value={tab} onValueChange={(v) => { setTab(v as "login" | "register"); setError(null); }}>
          <TabsList className="grid h-11 w-full grid-cols-2">
            <TabsTrigger value="login" className="font-bold">ورود</TabsTrigger>
            <TabsTrigger value="register" className="font-bold">ثبت‌نام</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="pt-4">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submit("login");
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-sm font-black">ایمیل</Label>
                <Input
                  id="login-email"
                  dir="ltr"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="h-11 border-2 bg-white md:h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-sm font-black">رمز عبور</Label>
                <Input
                  id="login-password"
                  dir="ltr"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="h-11 border-2 bg-white md:h-10"
                />
              </div>
              <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm font-bold text-gray-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-4 accent-primary"
                />
                مرا به خاطر بسپار (۳۰ روز)
              </label>
              {errorBox}
              <Button type="submit" disabled={busy} className="h-11 w-full border-2 border-ink font-black md:h-10">
                {busy && <Spinner />} ورود به حساب
              </Button>
              <div className="border-2 border-gold bg-gold/10 p-3 text-xs leading-6 text-[#7a5c1e]">
                <span className="font-black">حساب نمونه برای تست:</span>{" "}
                <span className="oeg-mono" dir="ltr">montajebii@montamooz.ir</span> با رمز{" "}
                <span className="oeg-mono" dir="ltr">123456</span>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="register" className="pt-4">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submit("register");
              }}
            >
              {/* P10 — honeypot: invisible to humans, irresistible to bots */}
              <div style={{ position: "absolute", left: "-9999px", opacity: 0 }} aria-hidden="true">
                <label>
                  Website (leave blank)
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={websiteHoneypot}
                    onChange={(e) => setWebsiteHoneypot(e.target.value)}
                  />
                </label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-name" className="text-sm font-black">نام و نام‌خانوادگی</Label>
                <Input
                  id="reg-name"
                  placeholder="مثلاً: مریم منتظری"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="h-11 border-2 bg-white md:h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-email" className="text-sm font-black">ایمیل</Label>
                <Input
                  id="reg-email"
                  dir="ltr"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="h-11 border-2 bg-white md:h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-password" className="text-sm font-black">رمز عبور</Label>
                <Input
                  id="reg-password"
                  dir="ltr"
                  type="password"
                  autoComplete="new-password"
                  placeholder="حداقل ۶ کاراکتر"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="h-11 border-2 bg-white md:h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-black">نقش شما</Label>
                <Select value={regRole} onValueChange={setRegRole}>
                  <SelectTrigger className="h-11 w-full border-2 bg-white font-medium md:h-10" aria-label="نقش">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {errorBox}
              <p className="text-xs leading-6 text-gray-500">
                با ثبت‌نام، محتوای آموزشی شما تحت مجوز{" "}
                <span className="oeg-mono font-bold" dir="ltr">CC BY-SA 4.0</span> با حفظ نام
                مؤلف منتشر می‌شود.
              </p>
              <Button type="submit" disabled={busy} className="h-11 w-full border-2 border-ink font-black md:h-10">
                {busy && <Spinner />} ایجاد حساب کاربری
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
