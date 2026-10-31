import { z } from "zod";

const money = z.number().int().positive().max(1_000_000_000_000);
const optMoney = z.number().int().positive().max(1_000_000_000_000).nullable();
const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const idSchema = z.uuid();
export const idemKeySchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

export const createDepositSchema = z.strictObject({ methodId: z.uuid(), amountMinor: money, note: text(0, 300).optional() });
export const createWithdrawalSchema = z.strictObject({ methodId: z.uuid(), amountMinor: money, destination: text(4, 200) });
export const subscribeSchema = z.strictObject({ amountMinor: money });
export const noteSchema = z.strictObject({ note: text(0, 500).optional() });
export const reasonSchema = z.strictObject({ note: text(3, 500) });

export const proofSchema = z.strictObject({
  txId: z.string().trim().regex(/^[A-Za-z0-9\-_/.]{4,120}$/, { error: "invalidTxId" }),
  mime: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  dataBase64: z.string().min(100).max(2_800_000),
});
export const paymentAccountSchema = z.strictObject({
  rail: z.enum(["PAYPAY", "KWIK", "EXPRESS"]),
  holder: text(2, 120),
  detail: text(3, 60),
});

export const methodSchema = z.strictObject({
  kind: z.enum(["DEPOSIT", "WITHDRAWAL"]),
  rail: z.enum(["PAYPAY", "KWIK", "EXPRESS", "REFERENCIA", "CRYPTO"]).nullable(),
  accountHolder: text(0, 120),
  accountNumber: text(0, 120),
  entity: text(0, 20),
  reference: text(0, 40),
  /** CRYPTO: moeda (USDT…) e rede (TRON TRC20…). */
  coin: z.string().trim().toUpperCase().max(12),
  network: text(0, 60),
  name: text(2, 80),
  instructions: text(0, 2000),
  minMinor: optMoney,
  maxMinor: optMoney,
  feeMinor: z.number().int().min(0).max(1_000_000_000_000).nullable(),
  feeNote: text(0, 300),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(-1000).max(1000),
}).superRefine((v, ctx) => {
  if (v.kind !== "DEPOSIT" || v.rail === null) return;
  if (v.rail === "CRYPTO") {
    if (!/^[A-Z0-9]{2,12}$/.test(v.coin)) ctx.addIssue({ code: "custom", path: ["coin"], message: "required" });
    if (v.network === "") ctx.addIssue({ code: "custom", path: ["network"], message: "required" });
    if (v.accountNumber === "") ctx.addIssue({ code: "custom", path: ["accountNumber"], message: "required" });
    return;
  }
  if (v.rail === "REFERENCIA") {
    if (v.entity === "") ctx.addIssue({ code: "custom", path: ["entity"], message: "required" });
    if (v.reference === "") ctx.addIssue({ code: "custom", path: ["reference"], message: "required" });
  } else if (v.accountNumber === "") {
    ctx.addIssue({ code: "custom", path: ["accountNumber"], message: "required" });
  }
});

const bps = (max = 10_000) => z.number().int().min(0).max(max);

export const planSchema = z
  .strictObject({
    name: text(2, 80),
    description: text(0, 4000),
    minMinor: optMoney,
    maxMinor: optMoney,
    capacityMinor: optMoney,
    termDays: z.number().int().positive().max(36500).nullable(),
    riskLabel: text(0, 80),
    status: z.enum(["DRAFT", "COMING_SOON", "OPEN", "CLOSED"]),
    sortOrder: z.number().int().min(-1000).max(1000),
    howItWorks: text(0, 6000),
    riskDetails: text(0, 4000),
    rateMode: z.enum(["FIXED", "MARKET"]),
    marketSymbol: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9.=^_-]{1,24}$/)
      .nullable(),
    marketLabel: text(0, 60),
    baseRateBps: bps(),
    minRateBps: bps(),
    maxRateBps: bps(),
    sensitivityBpsPerPct: bps(),
    payoutIntervalDays: z.number().int().min(1).max(90),
    inviteBoostX100: z.number().int().min(100).max(1000),
    autoActivate: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.minRateBps > v.baseRateBps || v.baseRateBps > v.maxRateBps) ctx.addIssue({ code: "custom", path: ["maxRateBps"], message: "rateOrder" });
    if (v.rateMode === "MARKET" && !v.marketSymbol) ctx.addIssue({ code: "custom", path: ["marketSymbol"], message: "required" });
  });

export const planImageSchema = z.strictObject({
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  dataBase64: z.string().min(100).max(2_800_000),
});

export const agreementSchema = z.strictObject({
  code: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/),
  title: text(2, 120),
  body: text(1, 60000),
});

export const verificationSchema = z.strictObject({
  docType: z.enum(["ID_CARD", "PASSPORT", "RESIDENCE_PERMIT"]),
  issuingCountry: z.string().regex(/^[A-Z]{2}$/),
  files: z
    .array(
      z.strictObject({
        kind: z.enum(["FRONT", "BACK", "SELFIE"]),
        mime: z.enum(["image/jpeg", "image/png", "application/pdf"]),
        dataBase64: z.string().min(8).max(2_800_000),
      }),
    )
    .min(2)
    .max(3),
});

export const ticketSchema = z.strictObject({
  subject: text(3, 120),
  category: z.enum(["ACCOUNT", "DEPOSIT", "WITHDRAWAL", "VERIFICATION", "OTHER"]),
  message: text(1, 4000),
});
export const messageSchema = z.strictObject({ message: text(1, 4000) });
export const userStatusSchema = z.strictObject({ status: z.enum(["ACTIVE", "LIMITED", "SUSPENDED"]) });

export const referralSettingsSchema = z.strictObject({
  enabled: z.boolean(),
  commissionMinor: z.number().int().min(0).max(1_000_000_000_000),
  minFundedToUnlock: z.number().int().min(1).max(100_000),
  minDepositMinor: z.number().int().min(0).max(1_000_000_000_000),
  maxSameIp: z.number().int().min(1).max(100),
});

export const referralLevelsSchema = z
  .strictObject({
    levels: z
      .array(z.strictObject({ level: z.number().int().min(1).max(20), name: text(2, 40), minFunded: z.number().int().min(1).max(100_000), yieldBonusBps: z.number().int().min(0).max(10_000) }))
      .min(1)
      .max(10),
  })
  .superRefine((v, ctx) => {
    for (let i = 1; i < v.levels.length; i++) {
      const a = v.levels[i - 1]!;
      const b = v.levels[i]!;
      // Níveis em ordem crescente: mais convidados nunca dão menos bónus.
      if (b.level <= a.level || b.minFunded <= a.minFunded || b.yieldBonusBps < a.yieldBonusBps) ctx.addIssue({ code: "custom", path: ["levels", i], message: "invalidOrder" });
    }
  });
