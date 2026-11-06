const P = (d: string, size = 14, extra = '') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`

export const icons = {
  sparkle: (s = 14) =>
    P('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"/>', s),
  plus: (s = 14) => P('<path d="M12 5v14M5 12h14"/>', s),
  present: (s = 14) => P('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/>', s),
  download: (s = 14) => P('<path d="M12 3v12M7 11l5 5 5-5M4 20h16"/>', s),
  undo: (s = 14) => P('<path d="M9 7L4 12l5 5"/><path d="M4 12h9a6 6 0 016 6"/>', s),
  redo: (s = 14) => P('<path d="M15 7l5 5-5 5"/><path d="M20 12h-9a6 6 0 00-6 6"/>', s),
  chevron: (s = 14) => P('<path d="M6 9l6 6 6-6"/>', s),
  chevronRight: (s = 14) => P('<path d="M9 6l6 6-6 6"/>', s),
  chevronLeft: (s = 14) => P('<path d="M15 6l-6 6 6 6"/>', s),
  x: (s = 14) => P('<path d="M6 6l12 12M18 6L6 18"/>', s),
  copy: (s = 14) => P('<rect x="9" y="9" width="11" height="11" rx="1.5"/><path d="M5 15V5a1 1 0 011-1h9"/>', s),
  trash: (s = 14) => P('<path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13h10l1-13"/>', s),
  grip: (s = 14) => P('<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>', s),
  grid: (s = 14) => P('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>', s),
  note: (s = 14) => P('<path d="M5 3h14v18l-7-4-7 4V3z"/>', s),
  layout: (s = 14) => P('<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M10 4v16"/>', s),
  palette: (s = 14) => P('<path d="M12 3a9 9 0 100 18h1.5a2.5 2.5 0 000-5H13a2 2 0 010-4h4a4 4 0 004-4c0-2.8-4-5-9-5z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/>', s),
  text: (s = 14) => P('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>', s),
  image: (s = 14) => P('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-5-5-7 7"/>', s),
  chart: (s = 14) => P('<path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/>', s),
  table: (s = 14) => P('<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 10h18M9 10v10M15 10v10"/>', s),
  quote: (s = 14) => P('<path d="M9 7H5v6h4c0 3-1.5 4-4 4M19 7h-4v6h4c0 3-1.5 4-4 4"/>', s),
  stat: (s = 14) => P('<path d="M5 19V9M12 19V5M19 19v-6"/>', s),
  list: (s = 14) => P('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', s),
  split: (s = 14) => P('<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M13 4v16"/>', s),
  timeline: (s = 14) => P('<path d="M3 12h18"/><circle cx="7" cy="12" r="2"/><circle cx="17" cy="12" r="2"/>', s),
  compare: (s = 14) => P('<path d="M12 3v18M7 8L3 12l4 4M17 8l4 4-4 4"/>', s),
  process: (s = 14) => P('<rect x="2" y="8" width="6" height="8" rx="1"/><rect x="9" y="8" width="6" height="8" rx="1"/><rect x="16" y="8" width="6" height="8" rx="1"/>', s),
  imageBig: (s = 14) => P('<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="11" r="1.5"/><path d="M22 15l-6-6-8 10"/>', s),
  closing: (s = 14) => P('<path d="M5 12h14M13 6l6 6-6 6"/>', s),
  section: (s = 14) => P('<path d="M4 7h16M4 12h10M4 17h13"/>', s),
  statement: (s = 14) => P('<path d="M4 6h16M4 12h16M4 18h9"/>', s),
  title: (s = 14) => P('<path d="M4 5h16M12 5v14M8 19h8"/>', s),
  command: (s = 14) => P('<path d="M8 4a3 3 0 013 3v10a3 3 0 11-3-3h8a3 3 0 11-3 3V7a3 3 0 113 3H8a3 3 0 01-3-3 3 3 0 013-3z"/>', s),
  check: (s = 14) => P('<path d="M5 12l5 5L20 7"/>', s),
  alert: (s = 14) => P('<path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/>', s),
  keyboard: (s = 14) => P('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>', s),
  sliders: (s = 14) => P('<path d="M4 8h10M18 8h2M4 16h6M14 16h6"/><circle cx="16" cy="8" r="2"/><circle cx="12" cy="16" r="2"/>', s),
  bolt: (s = 14) => P('<path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/>', s),
  menu: (s = 14) => P('<path d="M4 7h16M4 12h16M4 17h16"/>', s),
  arrowUpRight: (s = 14) => P('<path d="M7 17L17 7M9 7h8v8"/>', s),
  refresh: (s = 14) => P('<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 5v6h-6"/>', s),
  fullscreen: (s = 14) => P('<path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5"/>', s),
  clock: (s = 14) => P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', s),
  file: (s = 14) => P('<path d="M14 3H6a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8l-5-5z"/><path d="M14 3v5h5"/>', s),
  share: (s = 14) =>
    P('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.7l6.8-4M8.6 13.3l6.8 4"/>', s),
  link: (s = 14) =>
    P('<path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/>', s),
  mail: (s = 14) => P('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', s),
  users: (s = 14) =>
    P('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a4.5 4.5 0 015 4.5"/>', s),
}

export type IconName = keyof typeof icons

export function icon(name: IconName, size = 14): string {
  const fn = icons[name]
  return fn ? fn(size) : ''
}
