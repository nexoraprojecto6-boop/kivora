import { useEffect } from "react";

/** Move o foco para o primeiro campo com erro, na ordem do formulário. */
export function useFocusFirstError(errors: Record<string, string>, order: readonly string[], idPrefix: string): void {
  useEffect(() => {
    const first = order.find((field) => field in errors);
    if (first) document.getElementById(`${idPrefix}-${first}`)?.focus();
  }, [errors, order, idPrefix]);
}
