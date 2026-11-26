/**
 * Origin-aware popup motion (menus, selects, tooltips): scale + opacity from
 * the trigger, 150ms in and 110ms out. Needs `data-starting-style` and
 * `data-ending-style` from ui-sdk.
 */
export const popupMotionClass =
  'origin-(--transform-origin) transition-[opacity,scale] duration-(--duration-popup-in) ease-out data-starting-style:scale-(--scale-popup) data-starting-style:opacity-0 data-ending-style:scale-(--scale-popup) data-ending-style:opacity-0 data-ending-style:duration-(--duration-popup-out)'
