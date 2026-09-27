// Required-field "*" shown after a form label. Palette accent (#8b5e3c), not a
// new red — see CLAUDE.md color rules. aria-hidden: the input itself carries
// the requirement (validation message / `required`), the star is visual only.
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-primary">
      *
    </span>
  )
}
