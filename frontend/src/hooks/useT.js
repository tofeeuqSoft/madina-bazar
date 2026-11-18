import useUIStore from '../store/uiStore';
import { t as translate } from '../i18n/translations';

export default function useT() {
  const lang = useUIStore((s) => s.lang);
  return (key) => translate(lang, key);
}
