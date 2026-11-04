/** Green "Saved" banner with a link to fix the workout if it went in too early. */
export function SavedMessage({ text, editHref }: { text: string; editHref: string }) {
  return (
    <p
      role="status"
      className="flex items-center justify-between gap-3 rounded-lg bg-emerald-950 px-4 py-3 text-sm text-emerald-200"
    >
      <span>{text}</span>
      <a href={editHref} className="shrink-0 font-semibold text-emerald-100 underline underline-offset-4">
        Edit
      </a>
    </p>
  )
}
