import { useState } from "react"
import { Check, Copy, Share2, UserPlus } from "lucide-react"
import { useAuth } from "../features/auth/AuthContext.js"
import { useI18n } from "../i18n/I18nProvider.js"
import "./invite.css"

/*
 * Cartão "Convidar amigos e ganhar bónus ou comissões".
 * O link usa o identificador do utilizador como código de convite (?ref=). O registo ler o ?ref= e a
 * atribuição de comissões são feitos no servidor (passo seguinte). Aqui não se mostram valores inventados.
 */
const TEXT: Record<string, { title: string; body: string; copy: string; copied: string; share: string; label: string; shareText: string }> = {
  pt: {
    title: "Convide amigos e ganhe",
    body: "Partilhe o seu link. Quando um amigo se registar e investir, pode receber bónus ou comissões, conforme as regras em vigor.",
    copy: "Copiar link", copied: "Link copiado", share: "Partilhar", label: "O seu link de convite",
    shareText: "Junte-se à KIVORA:",
  },
  en: {
    title: "Invite friends and earn",
    body: "Share your link. When a friend signs up and invests, you may earn a bonus or commissions, according to the current rules.",
    copy: "Copy link", copied: "Link copied", share: "Share", label: "Your invite link",
    shareText: "Join KIVORA:",
  },
  es: {
    title: "Invita a amigos y gana",
    body: "Comparte tu enlace. Cuando un amigo se registre e invierta, puedes recibir bonos o comisiones, según las reglas vigentes.",
    copy: "Copiar enlace", copied: "Enlace copiado", share: "Compartir", label: "Tu enlace de invitación",
    shareText: "Únete a KIVORA:",
  },
  fr: {
    title: "Invitez vos amis et gagnez",
    body: "Partagez votre lien. Lorsqu’un ami s’inscrit et investit, vous pouvez recevoir un bonus ou des commissions, selon les règles en vigueur.",
    copy: "Copier le lien", copied: "Lien copié", share: "Partager", label: "Votre lien d’invitation",
    shareText: "Rejoignez KIVORA :",
  },
}

export function InviteCard() {
  const { language } = useI18n()
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  const txt = TEXT[language] ?? TEXT["pt"]!
  const code = String((user as unknown as { id?: string } | null)?.id ?? "")
  if (!code) return null
  const link = `${window.location.origin}/register?ref=${encodeURIComponent(code)}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // sem permissão para a área de transferência: o utilizador pode copiar o campo à mão
    }
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "KIVORA", text: txt.shareText, url: link })
        return
      } catch {
        return
      }
    }
    await copy()
  }

  return (
    <section className="invite-card" aria-label={txt.title}>
      <div className="invite-head">
        <span className="invite-icon" aria-hidden="true"><UserPlus size={20} /></span>
        <h3>{txt.title}</h3>
      </div>
      <p>{txt.body}</p>
      <input className="invite-link" readOnly value={link} aria-label={txt.label} onFocus={(e) => e.currentTarget.select()} />
      <div className="invite-actions">
        <button type="button" className="secondary-button" onClick={() => void copy()}>
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? txt.copied : txt.copy}
        </button>
        <button type="button" className="primary-button" onClick={() => void share()}>
          <Share2 size={16} /> {txt.share}
        </button>
      </div>
    </section>
  )
}
