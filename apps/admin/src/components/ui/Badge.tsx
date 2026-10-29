import { STATUS_LABEL, type Tone } from "../../lib/labels.js";

export function Badge({ status, text, tone }: { status?: string; text?: string; tone?: Tone }) {
  const known = status ? STATUS_LABEL[status] : undefined;
  const t = tone ?? known?.tone ?? "neutral";
  return <span className={`badge badge--${t}`}>{text ?? known?.text ?? status ?? "—"}</span>;
}
