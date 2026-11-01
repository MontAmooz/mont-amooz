"use client";

// مُنت‌آموز — Phase 2 realtime classroom hook (socket.io mini-service on :3003 via gateway).
// Fetches a join ticket from REST, then connects `io("/?XTransformPort=3003")` (gateway rule).
// Exposes presence (members), board strokes (snapshot + live) and external chat messages.
// Own strokes are appended locally on send (server only broadcasts to OTHERS — no echo).
//
// State design follows the shared useFetch pattern: one settled object tagged with the
// session key — all setState calls happen inside async callbacks, never in effect bodies.

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api } from "@/lib/client";
import type { JoinTicketResponse, SessionMessageItem } from "@/lib/types";

export interface BoardPoint {
  x: number; // normalized 0..1 of canvas box
  y: number;
}

export interface BoardStroke {
  uid: string;
  color: string;
  width: number; // px
  tool: "pen" | "eraser";
  points: BoardPoint[];
}

export interface RoomMember {
  uid: string;
  name: string;
  role: "teacher" | "student";
  online: boolean;
}

interface LiveState {
  connecting: boolean;
  connected: boolean;
  error: string | null;
  members: RoomMember[];
  strokes: BoardStroke[];
  chatMessages: SessionMessageItem[];
}

const EMPTY: LiveState = {
  connecting: true,
  connected: false,
  error: null,
  members: [],
  strokes: [],
  chatMessages: [],
};

export interface ClassroomApi {
  /** true once the socket is connected (and ticket accepted). */
  connected: boolean;
  /** true while fetching the ticket / establishing the connection. */
  connecting: boolean;
  /** Persian error when the join ticket is rejected (403/400) or the socket keeps failing. */
  error: string | null;
  members: RoomMember[];
  /** Full board state: server snapshot + incoming strokes + own committed strokes. */
  strokes: BoardStroke[];
  /** Chat messages received from OTHER participants via socket (REST history lives in the view). */
  chatMessages: SessionMessageItem[];
  /** Commit + broadcast a finished stroke (also appended locally). */
  sendStroke: (stroke: BoardStroke) => void;
  /** Remove my last stroke locally + notify others. */
  undoStroke: (uid: string) => void;
  /** Clear the board locally + notify others. */
  clearBoard: () => void;
  /** Relay a freshly-persisted chat message (already POSTed to REST) to the room. */
  sendChat: (message: SessionMessageItem) => void;
}

export function useClassroom(
  sessionId: string,
  options?: { enabled?: boolean }
): ClassroomApi {
  const enabled = options?.enabled !== false;
  const [state, setState] = useState<{ key: string; data: LiveState } | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const current = state && state.key === sessionId ? state.data : null;
  const connected = current?.connected ?? false;
  const connecting = enabled && (current ? current.connecting : true);
  const error = current?.error ?? null;
  const members = current?.members ?? [];
  const strokes = current?.strokes ?? [];
  const chatMessages = current?.chatMessages ?? [];

  const update = useCallback(
    (patch: Partial<LiveState>) => {
      setState((prev) => {
        const base: LiveState = prev && prev.key === sessionId ? prev.data : EMPTY;
        return { key: sessionId, data: { ...base, ...patch } };
      });
    },
    [sessionId]
  );

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let socket: Socket | null = null;

    void (async () => {
      let ticket: JoinTicketResponse;
      try {
        ticket = await api<JoinTicketResponse>(`/sessions/${sessionId}/join`);
      } catch (err) {
        if (alive) {
          update({
            connecting: false,
            connected: false,
            error: err instanceof Error ? err.message : "ورود به کلاس ممکن نشد.",
          });
        }
        return;
      }
      if (!alive) return;

      try {
        // gateway rule: relative path + XTransformPort query ONLY — never a port URL
        socket = io("/?XTransformPort=3003", {
          auth: { ticket: ticket.ticket },
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 6,
          reconnectionDelay: 1500,
          timeout: 12_000,
        });
      } catch {
        if (alive) {
          update({ connecting: false, error: "اتصال به کلاس ممکن نشد؛ لطفاً دوباره تلاش کنید." });
        }
        return;
      }
      if (!alive) {
        socket.disconnect();
        return;
      }
      socketRef.current = socket;

      socket.on("connect", () => {
        if (alive) update({ connected: true, connecting: false, error: null });
      });
      socket.on("disconnect", () => {
        if (alive) update({ connected: false });
      });
      socket.on("connect_error", () => {
        if (alive) {
          update({
            connected: false,
            connecting: false,
            error: "ارتباط زندهٔ کلاس برقرار نشد؛ تختهٔ سفید و گفت‌وگو در حالت آفلاین است.",
          });
        }
      });

      socket.on("room:welcome", (payload: { snapshot: BoardStroke[]; members: RoomMember[] }) => {
        if (!alive) return;
        update({
          strokes: Array.isArray(payload?.snapshot) ? payload.snapshot : [],
          members: Array.isArray(payload?.members) ? payload.members : [],
        });
      });
      socket.on("room:member-joined", (payload: { member: RoomMember }) => {
        if (!alive || !payload?.member) return;
        const member = payload.member;
        setState((prev) => {
          const base: LiveState = prev && prev.key === sessionId ? prev.data : EMPTY;
          const exists = base.members.some((m) => m.uid === member.uid);
          return {
            key: sessionId,
            data: {
              ...base,
              members: exists
                ? base.members.map((m) => (m.uid === member.uid ? member : m))
                : [...base.members, member],
            },
          };
        });
      });
      socket.on("room:member-left", (payload: { uid: string }) => {
        if (!alive || !payload?.uid) return;
        const uid = payload.uid;
        setState((prev) => {
          const base: LiveState = prev && prev.key === sessionId ? prev.data : EMPTY;
          return {
            key: sessionId,
            data: {
              ...base,
              members: base.members.map((m) => (m.uid === uid ? { ...m, online: false } : m)),
            },
          };
        });
      });

      socket.on("board:stroke", (payload: { stroke: BoardStroke }) => {
        if (!alive || !payload?.stroke) return;
        const stroke = payload.stroke;
        setState((prev) => {
          const base: LiveState = prev && prev.key === sessionId ? prev.data : EMPTY;
          return { key: sessionId, data: { ...base, strokes: [...base.strokes, stroke] } };
        });
      });
      socket.on("board:cleared", () => {
        if (alive) update({ strokes: [] });
      });
      socket.on("board:undo", (payload: { uid: string }) => {
        if (!alive || !payload?.uid) return;
        const uid = payload.uid;
        setState((prev) => {
          const base: LiveState = prev && prev.key === sessionId ? prev.data : EMPTY;
          for (let i = base.strokes.length - 1; i >= 0; i--) {
            if (base.strokes[i].uid === uid) {
              const strokes = [...base.strokes];
              strokes.splice(i, 1);
              return { key: sessionId, data: { ...base, strokes } };
            }
          }
          return prev;
        });
      });

      socket.on("chat:new", (payload: { message: SessionMessageItem }) => {
        if (!alive || !payload?.message) return;
        const message = payload.message;
        setState((prev) => {
          const base: LiveState = prev && prev.key === sessionId ? prev.data : EMPTY;
          return { key: sessionId, data: { ...base, chatMessages: [...base.chatMessages, message] } };
        });
      });
    })();

    return () => {
      alive = false;
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [sessionId, update, enabled]);

  const sendStroke = useCallback(
    (stroke: BoardStroke) => {
      setState((prev) => {
        const base: LiveState = prev && prev.key === sessionId ? prev.data : EMPTY;
        return { key: sessionId, data: { ...base, strokes: [...base.strokes, stroke] } };
      });
      socketRef.current?.emit("board:stroke", { stroke });
    },
    [sessionId]
  );

  const undoStroke = useCallback(
    (uid: string) => {
      setState((prev) => {
        const base: LiveState = prev && prev.key === sessionId ? prev.data : EMPTY;
        for (let i = base.strokes.length - 1; i >= 0; i--) {
          if (base.strokes[i].uid === uid) {
            const strokes = [...base.strokes];
            strokes.splice(i, 1);
            return { key: sessionId, data: { ...base, strokes } };
          }
        }
        return prev;
      });
      socketRef.current?.emit("board:undo", {});
    },
    [sessionId]
  );

  const clearBoard = useCallback(() => {
    update({ strokes: [] });
    socketRef.current?.emit("board:clear", {});
  }, [update]);

  const sendChat = useCallback(
    (message: SessionMessageItem) => {
      socketRef.current?.emit("chat:relay", { message });
    },
    []
  );

  return {
    connected,
    connecting,
    error,
    members,
    strokes,
    chatMessages,
    sendStroke,
    undoStroke,
    clearBoard,
    sendChat,
  };
}
