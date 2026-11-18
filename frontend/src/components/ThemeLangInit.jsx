import { useEffect } from 'react';
import useUIStore from '../store/uiStore';

export default function ThemeLangInit() {
  const theme = useUIStore((s) => s.theme);
  const lang = useUIStore((s) => s.lang);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    root.lang = lang === 'bn' ? 'bn' : 'en';
  }, [theme, lang]);

  return null;
}
