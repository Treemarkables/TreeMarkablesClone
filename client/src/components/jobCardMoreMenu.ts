/**
 * Desktop job-card "More" menu press.
 *
 * Radix DropdownMenu toggles on pointerdown. On this bottom-bar button that
 * press is the same one that has to open the menu, so two things swallow it:
 *
 * - The menu is modal. Opening it sets pointer-events:none on body before
 *   pointerup. The rest of the gesture no longer hits the trigger. When the
 *   menu has flipped up over the bar, pointerup lands on a menu item; Radix
 *   treats that as a selection and closes the menu in the same press. The
 *   click looks like it did nothing. It depends on timing and where the
 *   menu lands, so it is intermittent.
 * - Job-card fields save on blur, and address suggestions listen for
 *   document mousedown. That is the same pairing that made diary Reply need
 *   two presses. preventDefault on pointerdown suppresses that mousedown, but
 *   Radix only does it while also toggling — and once defaultPrevented is
 *   set, Radix skips its own toggle.
 *
 * Mouse and pen: cancel pointerdown so Radix does not toggle and the field
 * does not blur, then toggle on the click (the pointer is already up). If
 * the menu is already open, that pointerdown is an outside press and Radix
 * closes it; the click must not open it again.
 *
 * Touch: leave Radix's pointerdown toggle alone. preventDefault on a touch
 * pointerdown can swallow the tap, and the iPad uses this desktop card.
 */
export function moreMenuPress(
  pointerType: string,
  isOpen: boolean,
): { preventRadixToggle: boolean; toggleOnClick: boolean } {
  if (pointerType === "touch") {
    return { preventRadixToggle: false, toggleOnClick: false };
  }
  return { preventRadixToggle: true, toggleOnClick: !isOpen };
}
