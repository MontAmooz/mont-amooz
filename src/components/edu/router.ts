"use client";

// مُنت‌آموز — tiny hash router for the single-route SPA.
// Phase 1: #/ , #/pamphlet/{id} , #/create , #/edit/{id} , #/requests , #/request/{id} , #/user/{id} , #/profile
// Phase 2: #/market , #/book/{id} , #/sessions , #/session/{id} , #/courses , #/course/{id} ,
//          #/learn , #/learn/{id} , #/teach , #/wallet

import { useEffect, useState } from "react";

export interface HomeParams {
  q?: string;
  grade?: string;
  subject?: string;
  method?: string;
  difficulty?: string;
  /** newest | top | popular */
  sort?: string;
  page?: number;
}

export interface ListParams {
  q?: string;
  grade?: string;
  subject?: string;
  /** courses: newest | top | popular | price_asc | price_desc — market: rating | price_asc | price_desc | sessions */
  sort?: string;
  page?: number;
}

export type Route =
  | { name: "home"; params: HomeParams }
  | { name: "pamphlet"; id: string }
  | { name: "create" }
  | { name: "edit"; id: string }
  | { name: "requests" }
  | { name: "request"; id: string }
  | { name: "user"; id: string }
  | { name: "profile" }
  // Phase 2 — teaching marketplace
  | { name: "market"; params: ListParams }
  | { name: "book"; id: string }
  | { name: "sessions" }
  | { name: "session"; id: string }
  | { name: "courses"; params: ListParams }
  | { name: "course"; id: string }
  | { name: "learn" }
  | { name: "learn-course"; id: string }
  | { name: "teach" }
  | { name: "wallet" }
  // P10 — auth hardening
  | { name: "admin" }
  | { name: "reset" }
  // P11 — notifications
  | { name: "notifications" }
  // P12 — exam builder (P14: + grade route)
  | { name: "exams"; mine: boolean }
  | { name: "exam-new" }
  | { name: "exam-edit"; id: string }
  | { name: "exam"; id: string }
  | { name: "exam-result"; id: string; attemptId: string }
  | { name: "exam-grade"; id: string; attemptId: string }
  // P15 — interactive learning
  | { name: "lessons"; mine: boolean }
  | { name: "lesson-new" }
  | { name: "lesson-edit"; id: string }
  | { name: "lesson"; id: string };

const HOME: Route = { name: "home", params: {} };

function parseListParams(query: URLSearchParams): ListParams {
  const params: ListParams = {};
  const q = query.get("q")?.trim();
  if (q) params.q = q;
  for (const key of ["grade", "subject", "sort"] as const) {
    const value = query.get(key);
    if (value) params[key] = value;
  }
  const page = Number(query.get("page"));
  if (Number.isFinite(page) && page > 1) params.page = page;
  return params;
}

/** Build a filterable-list hash (courses / market) omitting defaults for clean URLs. */
export function listHash(base: "courses" | "market", params: ListParams): string {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.grade) query.set("grade", params.grade);
  if (params.subject) query.set("subject", params.subject);
  if (params.sort) query.set("sort", params.sort);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const qs = query.toString();
  return `#/${base}${qs ? `?${qs}` : ""}`;
}

export function parseHash(hash: string): Route {
  const raw = (hash || "").replace(/^#/, "");
  const [pathPart, queryPart] = raw.split("?");
  const segments = (pathPart || "/").split("/").filter(Boolean);
  const query = new URLSearchParams(queryPart || "");

  if (segments.length === 0) {
    const params: HomeParams = {};
    const q = query.get("q")?.trim();
    if (q) params.q = q;
    const keys = ["grade", "subject", "method", "difficulty", "sort"] as const;
    for (const key of keys) {
      const value = query.get(key);
      if (value) params[key] = value;
    }
    const page = Number(query.get("page"));
    if (Number.isFinite(page) && page > 1) params.page = page;
    return { name: "home", params };
  }

  const [head, id, extra, fourth] = segments;
  // #/learn/{courseId} (player) vs #/learn (my enrollments)
  if (head === "learn" && id) return { name: "learn-course", id };
  if (head === "learn" && !id) return { name: "learn" };
  // P12 — exams: #/exam/new | #/exam/{id} | #/exam/{id}/edit | #/exam/{id}/result/{attemptId}
  if (head === "exam" && !id) return { name: "exams", mine: false };
  if (head === "exams") return { name: "exams", mine: query.get("mine") === "true" };
  if (head === "exam" && id && extra === "result" && fourth) {
    return { name: "exam-result", id, attemptId: fourth };
  }
  if (head === "exam" && id && extra === "attempt" && fourth) {
    return { name: "exam-grade", id, attemptId: fourth };
  }
  if (head === "exam" && id && extra === "edit") return { name: "exam-edit", id };
  if (head === "exam" && id === "new") return { name: "exam-new" };
  if (head === "exam" && id) return { name: "exam", id };
  // P15 — interactive lessons: #/lesson/new | #/lesson/{id} | #/lesson/{id}/edit
  if (head === "lesson" && !id) return { name: "lessons", mine: false };
  if (head === "lessons") return { name: "lessons", mine: query.get("mine") === "true" };
  if (head === "lesson" && id && extra === "edit") return { name: "lesson-edit", id };
  if (head === "lesson" && id === "new") return { name: "lesson-new" };
  if (head === "lesson" && id) return { name: "lesson", id };
  switch (head) {
    case "pamphlet":
      return id ? { name: "pamphlet", id } : HOME;
    case "edit":
      return id ? { name: "edit", id } : HOME;
    case "request":
      return id ? { name: "request", id } : HOME;
    case "user":
      return id ? { name: "user", id } : HOME;
    case "book":
      return id && !extra ? { name: "book", id } : HOME;
    case "session":
      return id && !extra ? { name: "session", id } : HOME;
    case "course":
      return id && !extra ? { name: "course", id } : HOME;
    case "create":
      return { name: "create" };
    case "requests":
      return { name: "requests" };
    case "profile":
      return { name: "profile" };
    case "market":
      return { name: "market", params: parseListParams(query) };
    case "courses":
      return { name: "courses", params: parseListParams(query) };
    case "sessions":
      return { name: "sessions" };
    case "teach":
      return { name: "teach" };
    case "wallet":
      return { name: "wallet" };
    case "admin":
      return { name: "admin" };
    case "reset":
      return { name: "reset" };
    case "notifications":
      return { name: "notifications" };
    case "exams":
      return { name: "exams", mine: false };
    case "lessons":
      return { name: "lessons", mine: false };
    case "lesson":
      return { name: "lesson", id: id ?? "" };
    case "lesson-new":
      return { name: "lesson-new" };
    case "lesson-edit":
      return id ? { name: "lesson-edit", id } : { name: "lessons", mine: true };
    case "exam":
      return { name: "exam", id: id ?? "" };
    case "exam-new":
      return { name: "exam-new" };
    case "exam-edit":
      return id ? { name: "exam-edit", id } : { name: "exams", mine: true };
    case "exam-result":
      return id ? { name: "exam-result", id, attemptId: extra ?? "" } : { name: "exams", mine: false };
    case "exam-grade":
      return id ? { name: "exam-grade", id, attemptId: extra ?? "" } : { name: "exams", mine: false };
    default:
      return HOME;
  }
}

/** Build the home hash with the given params (omits defaults for clean URLs). */
export function homeHash(params: HomeParams): string {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.grade) query.set("grade", params.grade);
  if (params.subject) query.set("subject", params.subject);
  if (params.method) query.set("method", params.method);
  if (params.difficulty) query.set("difficulty", params.difficulty);
  if (params.sort && params.sort !== "newest") query.set("sort", params.sort);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const qs = query.toString();
  return `#/${qs ? `?${qs}` : ""}`;
}

/** Programmatic navigation helper. */
export function navigate(hash: string): void {
  if (typeof window === "undefined") return;
  if (window.location.hash === hash) {
    window.scrollTo({ top: 0 });
    return;
  }
  window.location.hash = hash;
}

/**
 * Subscribe to hash changes.
 * The initial value is always Home on the server AND the first client render,
 * so SSR markup matches (no hydration mismatch); the real hash is applied in the effect.
 */
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(HOME);

  useEffect(() => {
    const apply = () => setRoute(parseHash(window.location.hash));
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  return route;
}
