// Small stroke icons of the buttons (15x15) and the layer each one belongs to.
export const IC: Record<string, string> = {
  before:
    '<svg viewBox="0 0 15 15"><circle cx="7.5" cy="7.5" r="5.6"/><path d="M7.5 1.9a5.6 5.6 0 000 11.2z" fill="currentColor"/></svg>',
  heat: '<svg viewBox="0 0 15 15"><path d="M5.5 9V3.2a2 2 0 014 0V9a3.2 3.2 0 11-4 0z"/><path d="M7.5 5.5v5"/></svg>',
  air: '<svg viewBox="0 0 15 15"><path d="M1.5 5h7a2 2 0 10-2-2"/><path d="M1.5 8h10a2 2 0 11-2 2"/><path d="M1.5 11h4"/></svg>',
  rain: '<svg viewBox="0 0 15 15"><path d="M4.2 9A2.7 2.7 0 014 3.6a3.6 3.6 0 017-.4A2.9 2.9 0 0111 9z"/><path d="M5 11l-.8 1.8M8 11l-.8 1.8M11 11l-.8 1.8"/></svg>',
  hoods:
    '<svg viewBox="0 0 15 15"><path d="M7.5 13.5s4-3.6 4-7a4 4 0 10-8 0c0 3.4 4 7 4 7z"/><circle cx="7.5" cy="6.5" r="1.4"/></svg>',
  towers: '<svg viewBox="0 0 15 15"><path d="M3 13.5V2.5h6v11M9 6.5h3v7M5 5h2M5 7.5h2M5 10h2"/></svg>',
  share: '<svg viewBox="0 0 15 15"><path d="M7.5 9.5v-8M4.8 4.2L7.5 1.5l2.7 2.7M3 7.5v5h9v-5"/></svg>',
};
export const LT: Record<string, string> = { heat: 'heat', air: 'airb', rain: 'rainb', hoods: 'hoods', towers: 'twr' };
