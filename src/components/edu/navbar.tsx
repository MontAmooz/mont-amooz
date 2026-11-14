"use client";

// مُنت‌آموز — sticky top navbar: logo, search, nav links, upload CTA, user menu, mobile drawer.

import { useState } from "react";
import {
  BookOpen,
  GitMerge,
  GraduationCap,
  LogOut,
  Menu,
  PlayCircle,
  Plus,
  Search,
  ShieldCheck,
  User,
  Users,
  Video,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { InitialsAvatar, LogoMark, Spinner } from "./bits";
import { homeHash, navigate, useHashRoute } from "./router";
import { useEduStore } from "./store";

function NavLink({
  hash,
  active,
  children,
}: {
  hash: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={hash}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-11 items-center gap-1.5 border-2 px-3 text-sm font-bold transition-colors duration-150 md:h-9",
        active
          ? "border-ink bg-ink text-white"
          : "border-transparent text-gray-600 hover:border-gray-200 hover:text-ink"
      )}
    >
      {children}
    </a>
  );
}

export function Navbar() {
  const route = useHashRoute();
  const { user, openAuth } = useEduStore();
  const { toast } = useToast();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  function goToCreate() {
    setMobileOpen(false);
    if (!user) {
      openAuth("برای بارگذاری جزوه ابتدا وارد حساب کاربری شوید.");
      return;
    }
    navigate("#/create");
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    navigate(homeHash(q ? { q } : {}));
    setMobileOpen(false);
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await api("/auth/logout", { method: "POST" });
      useEduStore.getState().setUser(null);
      toast({ title: "خارج شدید", description: "از حساب کاربری خود خارج شدید." });
      setMobileOpen(false);
      if (["create", "edit", "profile"].includes(route.name)) navigate("#/");
    } catch (err) {
      toast({
        title: "خروج ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoggingOut(false);
    }
  }

  function goTeachers() {
    setMobileOpen(false);
    if (route.name !== "home") navigate("#/");
    window.setTimeout(() => {
      document.getElementById("top-teachers")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
  }

  return (
    <header className="sticky top-0 z-50 border-b-2 border-ink bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        {/* logo (RTL start) */}
        <a
          href="#/"
          className="flex shrink-0 items-center gap-2"
          aria-label="مُنت‌آموز — صفحهٔ اصلی"
        >
          <LogoMark className="size-9 text-ink" />
          <span className="hidden text-lg font-black sm:inline">
            مُنت <span className="text-primary">آموز</span>
          </span>
        </a>

        {/* desktop search */}
        <form
          className="hidden min-w-0 max-w-sm flex-1 md:block"
          role="search"
          onSubmit={submitSearch}
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو در جزوه‌ها…"
              aria-label="جستجو در جزوه‌ها"
              className="h-10 border-2 border-gray-200 bg-white ps-9 focus-visible:border-ink"
            />
          </div>
        </form>

        {/* desktop nav links */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="ناوبری اصلی">
          <NavLink hash="#/" active={route.name === "home"}>
            <BookOpen className="size-4" aria-hidden="true" /> جزوه‌ها
          </NavLink>
          <NavLink hash="#/courses" active={route.name === "courses" || route.name === "course" || route.name === "learn" || route.name === "learn-course"}>
            <PlayCircle className="size-4" aria-hidden="true" /> دوره‌ها
          </NavLink>
          <NavLink hash="#/market" active={route.name === "market" || route.name === "book" || route.name === "sessions" || route.name === "session"}>
            <GraduationCap className="size-4" aria-hidden="true" /> بازارچهٔ تدریس
          </NavLink>
          <NavLink
            hash="#/requests"
            active={route.name === "requests" || route.name === "request"}
          >
            <GitMerge className="size-4" aria-hidden="true" /> درخواست‌های ادغام
          </NavLink>
        </nav>

        <div className="flex-1 md:hidden" />

        {/* actions (RTL end) */}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            onClick={goToCreate}
            className="h-11 border-2 border-ink font-black md:h-10"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">بارگذاری جزوه</span>
            <span className="sr-only sm:hidden">بارگذاری جزوه</span>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex h-11 items-center gap-2 border-2 border-transparent px-1 outline-none transition-colors hover:border-gray-200 focus-visible:border-ink md:h-10"
                aria-label="حساب کاربری"
              >
                <InitialsAvatar
                  name={user.fullName}
                  className="size-9 border-2 border-ink bg-primary text-sm"
                />
                <span className="hidden max-w-32 truncate text-sm font-bold md:inline">
                  {user.fullName}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 border-2 border-ink">
                <DropdownMenuLabel className="font-black">{user.fullName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="h-11 cursor-pointer gap-2 font-bold"
                  onClick={() => navigate("#/profile")}
                >
                  <User className="size-4" aria-hidden="true" /> پروفایل من
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="h-11 cursor-pointer gap-2 font-bold"
                  onClick={() => navigate("#/wallet")}
                >
                  <Wallet className="size-4" aria-hidden="true" /> کیف پول
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="h-11 cursor-pointer gap-2 font-bold"
                  onClick={() => navigate("#/sessions")}
                >
                  <GraduationCap className="size-4" aria-hidden="true" /> کلاس‌های من
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="h-11 cursor-pointer gap-2 font-bold"
                  onClick={() => navigate("#/learn")}
                >
                  <PlayCircle className="size-4" aria-hidden="true" /> یادگیری من
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="h-11 cursor-pointer gap-2 font-bold"
                  onClick={() => navigate("#/teach")}
                >
                  <Video className="size-4" aria-hidden="true" /> پنل تدریس
                </DropdownMenuItem>
                {user.isAdmin && (
                  <DropdownMenuItem
                    className="h-11 cursor-pointer gap-2 font-bold"
                    onClick={() => navigate("#/admin")}
                  >
                    <ShieldCheck className="size-4" aria-hidden="true" /> پنل مدیریت
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="h-11 cursor-pointer gap-2 font-bold text-danger focus:text-danger"
                  onClick={() => void logout()}
                  disabled={loggingOut}
                >
                  {loggingOut ? <Spinner /> : <LogOut className="size-4" aria-hidden="true" />}
                  خروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="outline"
              onClick={() => openAuth()}
              className="hidden h-11 border-2 border-ink font-black md:inline-flex md:h-10"
            >
              ورود | ثبت‌نام
            </Button>
          )}

          {/* mobile hamburger */}
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 border-2 border-ink lg:hidden"
            aria-label="باز کردن منو"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-[300px] gap-0 overflow-y-auto p-0 sm:w-[320px]">
          <SheetHeader className="border-b-2 border-ink">
            <SheetTitle className="flex items-center gap-2 font-black">
              <LogoMark className="size-7 text-ink" /> مُنت‌آموز
            </SheetTitle>
            <SheetDescription className="sr-only">
              منوی ناوبری و جستجوی مُنت‌آموز
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-1 p-4">
            <form role="search" onSubmit={submitSearch} className="mb-4">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="جستجو در جزوه‌ها…"
                  aria-label="جستجو در جزوه‌ها"
                  className="h-11 border-2 border-gray-200 bg-white ps-9"
                />
              </div>
            </form>

            <a
              href="#/"
              onClick={() => setMobileOpen(false)}
              className="flex h-11 items-center gap-3 border-2 border-transparent px-3 font-bold hover:border-gray-200"
            >
              <BookOpen className="size-5 text-primary" aria-hidden="true" /> جزوه‌ها
            </a>
            <a
              href="#/courses"
              onClick={() => setMobileOpen(false)}
              className="flex h-11 items-center gap-3 border-2 border-transparent px-3 font-bold hover:border-gray-200"
            >
              <PlayCircle className="size-5 text-primary" aria-hidden="true" /> دوره‌های ویدیویی
            </a>
            <a
              href="#/market"
              onClick={() => setMobileOpen(false)}
              className="flex h-11 items-center gap-3 border-2 border-transparent px-3 font-bold hover:border-gray-200"
            >
              <GraduationCap className="size-5 text-primary" aria-hidden="true" /> بازارچهٔ تدریس
            </a>
            <a
              href="#/requests"
              onClick={() => setMobileOpen(false)}
              className="flex h-11 items-center gap-3 border-2 border-transparent px-3 font-bold hover:border-gray-200"
            >
              <GitMerge className="size-5 text-primary" aria-hidden="true" /> درخواست‌های ادغام
            </a>
            <button
              type="button"
              onClick={goTeachers}
              className="flex h-11 w-full items-center gap-3 border-2 border-transparent px-3 text-start font-bold hover:border-gray-200"
            >
              <Users className="size-5 text-primary" aria-hidden="true" /> معلم‌های برتر
            </button>

            <Separator className="my-4" />

            {user ? (
              <>
                <a
                  href="#/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-11 items-center gap-3 border-2 border-transparent px-3 font-bold hover:border-gray-200"
                >
                  <User className="size-5 text-gold" aria-hidden="true" /> پروفایل من
                </a>
                <a
                  href="#/wallet"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-11 items-center gap-3 border-2 border-transparent px-3 font-bold hover:border-gray-200"
                >
                  <Wallet className="size-5 text-gold" aria-hidden="true" /> کیف پول
                </a>
                <a
                  href="#/sessions"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-11 items-center gap-3 border-2 border-transparent px-3 font-bold hover:border-gray-200"
                >
                  <GraduationCap className="size-5 text-gold" aria-hidden="true" /> کلاس‌های من
                </a>
                <a
                  href="#/learn"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-11 items-center gap-3 border-2 border-transparent px-3 font-bold hover:border-gray-200"
                >
                  <PlayCircle className="size-5 text-gold" aria-hidden="true" /> یادگیری من
                </a>
                <a
                  href="#/teach"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-11 items-center gap-3 border-2 border-transparent px-3 font-bold hover:border-gray-200"
                >
                  <Video className="size-5 text-gold" aria-hidden="true" /> پنل تدریس
                </a>
                <Button
                  variant="ghost"
                  className="h-11 w-full justify-start gap-3 border-2 border-transparent px-3 font-bold text-danger hover:text-danger"
                  onClick={() => void logout()}
                  disabled={loggingOut}
                >
                  {loggingOut ? <Spinner /> : <LogOut className="size-5" aria-hidden="true" />} خروج
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  setMobileOpen(false);
                  openAuth();
                }}
                className="h-11 w-full border-2 border-ink font-black"
              >
                ورود | ثبت‌نام
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
