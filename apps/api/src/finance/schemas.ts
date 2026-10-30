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
  txId: z.string().trim().regex(/^[A-Za-z0-9\-_/.]{4,60}$/, { error: "invalidTxId" }),
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
  rail: z.enum(["PAYPAY", "KWIK", "EXPRESS", "REFERENCIA"]).nullable(),
  accountHolder: text(0, 120),
  accountNumber: text(0, 60),
  entity: text(0, 20),
  reference: text(0, 40),
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
  if (v.rail === "REFERENCIA") {
    if (v.entity === "") ctx.addIssue({ code: "custom", path: ["entity"], message: "required" });
    if (v.reference === "") ctx.addIssue({ code: "custom", path: ["reference"], message: "required" });
  } else if (v.accountNumber === "") {
    ctx.addIssue({ code: "custom", path: ["accountNumber"], message: "required" });
  }
});

export const planSchema = z.strictObject({
  name: text(2, 80),
  description: text(0, 4000),
  minMinor: optMoney,
  maxMinor: optMoney,
  capacityMinor: optMoney,
  termDays: z.number().int().positive().max(36500).nullable(),
  riskLabel: text(0, 80),
  status: z.enum(["DRAFT", "COMING_SOON", "OPEN", "CLOSED"]),
  sortOrder: z.number().int().min(-1000).max(1000),
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
