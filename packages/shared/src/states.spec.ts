import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEPOSIT_TRANSITIONS,
  USER_ACCOUNT_TRANSITIONS,
  VERIFICATION_TRANSITIONS,
  WITHDRAWAL_TRANSITIONS,
  canTransition,
} from "./states.js";

test("verificação: fluxo normal e reenvio após rejeição", () => {
  assert.equal(canTransition(VERIFICATION_TRANSITIONS, "draft", "pending"), true);
  assert.equal(canTransition(VERIFICATION_TRANSITIONS, "pending", "in_review"), true);
  assert.equal(canTransition(VERIFICATION_TRANSITIONS, "in_review", "approved"), true);
  assert.equal(canTransition(VERIFICATION_TRANSITIONS, "rejected", "draft"), true);
});

test("verificação: não se salta a revisão nem se reverte uma aprovação", () => {
  assert.equal(canTransition(VERIFICATION_TRANSITIONS, "pending", "approved"), false);
  assert.equal(canTransition(VERIFICATION_TRANSITIONS, "approved", "draft"), false);
});

test("depósito: estados finais não têm saída", () => {
  for (const s of ["confirmed", "rejected", "expired", "cancelled"] as const) {
    assert.deepEqual(DEPOSIT_TRANSITIONS[s], []);
  }
  assert.equal(canTransition(DEPOSIT_TRANSITIONS, "created", "confirmed"), false);
  assert.equal(canTransition(DEPOSIT_TRANSITIONS, "pending", "confirmed"), true);
});

test("levantamento: aprovar para processamento não equivale a processado", () => {
  assert.equal(
    canTransition(WITHDRAWAL_TRANSITIONS, "in_review", "processed"),
    false,
  );
  assert.equal(
    canTransition(WITHDRAWAL_TRANSITIONS, "approved_for_processing", "processed"),
    true,
  );
  assert.equal(canTransition(WITHDRAWAL_TRANSITIONS, "requested", "processed"), false);
});

test("conta de utilizador: suspensa só volta a activa", () => {
  assert.deepEqual(USER_ACCOUNT_TRANSITIONS.suspended, ["active"]);
});

test("toda a transição aponta para um estado existente", () => {
  for (const table of [
    VERIFICATION_TRANSITIONS,
    DEPOSIT_TRANSITIONS,
    WITHDRAWAL_TRANSITIONS,
    USER_ACCOUNT_TRANSITIONS,
  ]) {
    const states = new Set(Object.keys(table));
    for (const targets of Object.values(table) as string[][]) {
      for (const t of targets) assert.ok(states.has(t), `estado desconhecido: ${t}`);
    }
  }
});
