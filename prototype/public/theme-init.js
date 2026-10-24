try {
  const preference = localStorage.getItem('castiel-theme') || 'system';
  document.documentElement.dataset.theme = preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
} catch {}
