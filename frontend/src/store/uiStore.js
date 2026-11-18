import { create } from 'zustand';

const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem('madina-ui') || '{}');
  } catch {
    return {};
  }
})();

const useUIStore = create((set, get) => ({
  theme: saved.theme || 'dark',
  lang: saved.lang || 'bn',
  setTheme: (theme) => {
    set({ theme });
    localStorage.setItem('madina-ui', JSON.stringify({ ...get(), theme }));
  },
  toggleTheme: () => {
    const theme = get().theme === 'dark' ? 'light' : 'dark';
    set({ theme });
    localStorage.setItem('madina-ui', JSON.stringify({ ...get(), theme }));
  },
  setLang: (lang) => {
    set({ lang });
    localStorage.setItem('madina-ui', JSON.stringify({ ...get(), lang }));
  },
  toggleLang: () => {
    const lang = get().lang === 'bn' ? 'en' : 'bn';
    set({ lang });
    localStorage.setItem('madina-ui', JSON.stringify({ ...get(), lang }));
  },
}));

export default useUIStore;
