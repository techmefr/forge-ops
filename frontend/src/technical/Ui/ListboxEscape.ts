export function listboxIsOpen(active: Element | null): boolean {
  return active?.getAttribute('role') === 'combobox' && active.getAttribute('aria-expanded') === 'true'
}

export function keepDialogWhileListboxOpen(event: KeyboardEvent): void {
  if (listboxIsOpen(document.activeElement)) {
    event.preventDefault()
  }
}
