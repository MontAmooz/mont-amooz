"use client";

// مُنت‌آموز — single-route SPA shell (hash routing).
// Layout: sticky navbar / main (route switch) / sticky footer + global auth dialog.

import { useEffect, useRef } from "react";
import { AuthDialog } from "@/components/edu/auth-dialog";
import { AuthRequiredBox } from "@/components/edu/bits";
import BookView from "@/components/edu/book-view";
import ClassroomView from "@/components/edu/classroom-view";
import CourseView from "@/components/edu/course-view";
import CoursesView from "@/components/edu/courses-view";
import { CreateView } from "@/components/edu/create-view";
import { EditView } from "@/components/edu/edit-view";
import { SiteFooter } from "@/components/edu/footer";
import { HomeView } from "@/components/edu/home-view";
import LearnPlayerView from "@/components/edu/learn-player-view";
import LearnView from "@/components/edu/learn-view";
import MarketView from "@/components/edu/market-view";
import { Navbar } from "@/components/edu/navbar";
import { PamphletView } from "@/components/edu/pamphlet-view";
import { ProfileView } from "@/components/edu/profile-view";
import { RequestDetailView } from "@/components/edu/request-detail-view";
import { RequestsView } from "@/components/edu/requests-view";
import { useHashRoute } from "@/components/edu/router";
import SessionsView from "@/components/edu/sessions-view";
import { refreshSession, useEduStore } from "@/components/edu/store";
import TeachView from "@/components/edu/teach-view";
import WalletView from "@/components/edu/wallet-view";

export default function Page() {
  const route = useHashRoute();
  const user = useEduStore((s) => s.user);
  const sessionLoaded = useEduStore((s) => s.sessionLoaded);

  // bootstrap session once
  useEffect(() => {
    void refreshSession();
  }, []);

  // scroll behavior on route change (skip the very first render)
  const scrollKey =
    route.name === "home"
      ? `home:${route.params.page ?? 1}`
      : "id" in route && route.id
        ? `${route.name}:${route.id}`
        : route.name;
  const prevScrollKey = useRef(scrollKey);

  useEffect(() => {
    if (prevScrollKey.current === scrollKey) return;
    prevScrollKey.current = scrollKey;
    if (route.name === "home") {
      document.getElementById("browse")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [scrollKey]);

  function renderView() {
    switch (route.name) {
      case "home":
        return <HomeView params={route.params} />;
      case "pamphlet":
        return <PamphletView key={route.id} id={route.id} />;
      case "create":
        return <CreateView />;
      case "edit":
        return <EditView key={route.id} id={route.id} />;
      case "requests":
        return <RequestsView />;
      case "request":
        return <RequestDetailView key={route.id} id={route.id} />;
      case "user":
        return <ProfileView key={route.id} id={route.id} />;
      case "profile":
        if (!sessionLoaded) {
          return null; // brief blank while session resolves — avoids a login-flash
        }
        return user ? (
          <ProfileView key={user.id} id={user.id} isMe />
        ) : (
          <div className="mx-auto max-w-7xl px-4 py-16">
            <AuthRequiredBox
              title="برای مشاهدهٔ پروفایل خود وارد حساب کاربری شوید"
              hint="پروفایل شما شامل جزوه‌ها، ادغام‌ها و سهم مشارکت‌هایتان است."
            />
          </div>
        );
      // ----- Phase 2 — teaching marketplace -----
      case "market":
        return <MarketView params={route.params} />;
      case "book":
        return <BookView key={route.id} id={route.id} />;
      case "sessions":
        return user ? (
          <SessionsView />
        ) : (
          <div className="mx-auto max-w-7xl px-4 py-16">
            <AuthRequiredBox
              title="برای مشاهدهٔ کلاس‌های خود وارد حساب کاربری شوید"
              hint="جلسات رزروشده و جلساتی که تدریس می‌کنید را اینجا می‌بینید."
            />
          </div>
        );
      case "session":
        return <ClassroomView key={route.id} id={route.id} />;
      case "courses":
        return <CoursesView params={route.params} />;
      case "course":
        return <CourseView key={route.id} id={route.id} />;
      case "learn":
        return user ? (
          <LearnView />
        ) : (
          <div className="mx-auto max-w-7xl px-4 py-16">
            <AuthRequiredBox
              title="برای مشاهدهٔ دوره‌های خود وارد حساب کاربری شوید"
              hint="دوره‌هایی که خریده‌اید و پیشرفتتان اینجا نمایش داده می‌شود."
            />
          </div>
        );
      case "learn-course":
        return <LearnPlayerView key={route.id} id={route.id} />;
      case "teach":
        return <TeachView />;
      case "wallet":
        return user ? (
          <WalletView />
        ) : (
          <div className="mx-auto max-w-7xl px-4 py-16">
            <AuthRequiredBox
              title="برای مشاهدهٔ کیف پول وارد حساب کاربری شوید"
              hint="موجودی، شارژ و تراکنش‌های شما اینجا نمایش داده می‌شود."
            />
          </div>
        );
      default:
        return <HomeView params={{}} />;
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">{renderView()}</main>
      <SiteFooter />
      <AuthDialog />
    </div>
  );
}
