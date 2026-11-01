// Integration tests — wallet: lazy creation, mock-gateway deposit, verify, withdraw
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import { api, registerUser, ensureWalletBalance } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

describe("Wallet — GET /wallet", () => {
  test("unauthenticated → 401", async () => {
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/wallet");
    expect(r.status).toBe(401);
  });

  test("lazy-create on first access → balance 0, empty transactions", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ balance: number; transactions: unknown[] }>(baseUrl(), "/api/v1/wallet", { cookie });
    expect(r.status).toBe(200);
    expect(r.data.balance).toBe(0);
    expect(r.data.transactions).toHaveLength(0);
  });
});

describe("Wallet — POST /deposit", () => {
  test("invalid amount (not multiple of 1000) → 400 with Persian message", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/wallet/deposit", {
      method: "POST", cookie, json: { amount: 12345 },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("مبلغ باید بین ۱۰,۰۰۰ تا ۵,۰۰۰,۰۰۰ تومان و مضرب ۱,۰۰۰ باشد");
  });

  test("amount above max → 400", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/wallet/deposit", {
      method: "POST", cookie, json: { amount: 6_000_000 },
    });
    expect(r.status).toBe(400);
  });

  test("amount below min → 400", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/wallet/deposit", {
      method: "POST", cookie, json: { amount: 5000 },
    });
    expect(r.status).toBe(400);
  });

  test("valid deposit → 201 {authority, amount}; balance unchanged while PENDING", async () => {
    const { cookie } = await registerUser(baseUrl());
    const dep = await api<{ authority: string; amount: number }>(baseUrl(), "/api/v1/wallet/deposit", {
      method: "POST", cookie, json: { amount: 100000 },
    });
    expect(dep.status).toBe(201);
    expect(dep.data.authority).toHaveLength(36);
    expect(dep.data.amount).toBe(100000);

    const w = await api<{ balance: number; transactions: Array<{ status: string; type: string }> }>(
      baseUrl(), "/api/v1/wallet", { cookie }
    );
    expect(w.data.balance).toBe(0);
    expect(w.data.transactions[0].status).toBe("PENDING");
    expect(w.data.transactions[0].type).toBe("DEPOSIT");
  });

  test("unauthenticated deposit → 401", async () => {
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/wallet/deposit", {
      method: "POST", json: { amount: 100000 },
    });
    expect(r.status).toBe(401);
  });
});

describe("Wallet — POST /deposit/verify", () => {
  test("missing authority → 400 «شناسهٔ تراکنش درگاه الزامی است»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/wallet/deposit/verify", {
      method: "POST", cookie, json: { result: "success" },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("شناسهٔ تراکنش درگاه الزامی است");
  });

  test("bad result → 400 «نتیجهٔ پرداخت باید «success» یا «fail» باشد»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/wallet/deposit/verify", {
      method: "POST", cookie, json: { authority: "whatever", result: "maybe" },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("نتیجهٔ پرداخت باید «success» یا «fail» باشد");
  });

  test("unknown authority → 404 «تراکنش پرداخت پیدا نشد»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/wallet/deposit/verify", {
      method: "POST", cookie, json: { authority: "NO_SUCH_AUTHORITY_123456789", result: "success" },
    });
    expect(r.status).toBe(404);
    expect(r.data.error).toBe("تراکنش پرداخت پیدا نشد");
  });

  test("success verify credits balance; double-verify → 404", async () => {
    const { cookie } = await registerUser(baseUrl());
    const dep = await api<{ authority: string }>(baseUrl(), "/api/v1/wallet/deposit", {
      method: "POST", cookie, json: { amount: 250000 },
    });
    const ok1 = await api<{ balance: number }>(baseUrl(), "/api/v1/wallet/deposit/verify", {
      method: "POST", cookie, json: { authority: dep.data.authority, result: "success" },
    });
    expect(ok1.status).toBe(200);
    expect(ok1.data.balance).toBe(250000);

    const ok2 = await api<{ error: string }>(baseUrl(), "/api/v1/wallet/deposit/verify", {
      method: "POST", cookie, json: { authority: dep.data.authority, result: "success" },
    });
    expect(ok2.status).toBe(404);
    expect(ok2.data.error).toBe("تراکنش پرداخت پیدا نشد");

    const w = await api<{ balance: number }>(baseUrl(), "/api/v1/wallet", { cookie });
    expect(w.data.balance).toBe(250000); // credited exactly once
  });

  test("fail verify marks txn FAILED and leaves balance untouched", async () => {
    const { cookie } = await registerUser(baseUrl());
    const dep = await api<{ authority: string }>(baseUrl(), "/api/v1/wallet/deposit", {
      method: "POST", cookie, json: { amount: 300000 },
    });
    const r = await api<{ balance: number }>(baseUrl(), "/api/v1/wallet/deposit/verify", {
      method: "POST", cookie, json: { authority: dep.data.authority, result: "fail" },
    });
    expect(r.status).toBe(200);
    expect(r.data.balance).toBe(0);
    const w = await api<{ transactions: Array<{ status: string }> }>(baseUrl(), "/api/v1/wallet", { cookie });
    expect(w.data.transactions.find((t) => t.status === "FAILED")).toBeTruthy();
  });
});

describe("Wallet — POST /withdraw", () => {
  test("non-integer amount → 400 «مبلغ نامعتبر است»", async () => {
    const { cookie } = await registerUser(baseUrl());
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/wallet/withdraw", {
      method: "POST", cookie, json: { amount: 1000.5 },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("مبلغ نامعتبر است");
  });

  test("below min → 400 «حداقل مبلغ برداشت ۵۰,۰۰۰ تومان است»", async () => {
    const { cookie } = await registerUser(baseUrl());
    await ensureWalletBalance(baseUrl(), cookie, 100000);
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/wallet/withdraw", {
      method: "POST", cookie, json: { amount: 20000 },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("حداقل مبلغ برداشت ۵۰,۰۰۰ تومان است");
  });

  test("above balance → 400 «موجودی کافی نیست»", async () => {
    const { cookie } = await registerUser(baseUrl());
    await ensureWalletBalance(baseUrl(), cookie, 100000);
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/wallet/withdraw", {
      method: "POST", cookie, json: { amount: 999000 },
    });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe("موجودی کافی نیست");
  });

  test("valid withdraw debits balance and writes a WITHDRAW txn", async () => {
    const { cookie } = await registerUser(baseUrl());
    await ensureWalletBalance(baseUrl(), cookie, 500000);
    const r = await api<{ balance: number }>(baseUrl(), "/api/v1/wallet/withdraw", {
      method: "POST", cookie, json: { amount: 150000 },
    });
    expect(r.status).toBe(200);
    expect(r.data.balance).toBe(350000);
    const w = await api<{ balance: number; transactions: Array<{ type: string; amount: number }> }>(
      baseUrl(), "/api/v1/wallet", { cookie }
    );
    expect(w.data.balance).toBe(350000);
    expect(w.data.transactions.some((t) => t.type === "WITHDRAW" && t.amount === -150000)).toBe(true);
  });

  test("unauthenticated withdraw → 401", async () => {
    const r = await api<{ error: string }>(baseUrl(), "/api/v1/wallet/withdraw", {
      method: "POST", json: { amount: 100000 },
    });
    expect(r.status).toBe(401);
  });
});
