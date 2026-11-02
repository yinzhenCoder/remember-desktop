window.icon = (name) => {
  const paths = {
    water:
      '<path d="M5 5h12l-1.3 14H6.3L5 5Z"/><path d="M17 7h1a3 3 0 0 1 0 6h-1.5M6 12c3-2 6 2 10 0M8 2v1M12 2v1"/>',
    stand:
      '<rect x="7" y="3" width="10" height="9" rx="3"/><path d="M5 10v6h14v-6M12 16v4M7 21l5-1 5 1M3 10h4M17 10h4"/>',
    clock:
      '<rect x="5" y="4" width="14" height="17" rx="3"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="m8 13 3 3 5-6"/>',
    custom: '<path d="M6 9a6 6 0 0 1 12 0c0 6 3 6 3 8H3c0-2 3-2 3-8ZM9 21h6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    history: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/>',
    settings:
      '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  };
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (paths[name] || paths.custom) +
    "</svg>"
  );
};
