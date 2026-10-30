import { useSyncExternalStore } from "react"
import { useI18n } from "../../i18n/I18nProvider.js"
import { getLoaderState, subscribeLoader } from "../../services/loader-store.js"
import { CoinLoader } from "./CoinLoader.js"

/** Loader global da app: montar uma vez, dentro do I18nProvider (ver main.tsx e dashboard/main.tsx). */
export function GlobalLoader() {
  const s = useSyncExternalStore(subscribeLoader, getLoaderState, getLoaderState)
  const { t } = useI18n()
  if (!s.visible) return null
  const title = s.title ?? t("common.states.loading").replace(/[….]+$/, "")
  return (
    <div className="gl-overlay" aria-busy="true">
      <CoinLoader title={title} {...(s.sub ? { subtitle: s.sub } : {})} />
    </div>
  )
}
