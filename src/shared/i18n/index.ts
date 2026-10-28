import { usePreferences } from '@/shared/model';
import { en } from './en';
import { uk } from './uk';
export type MessageKey = keyof typeof en;
export function useTranslation() {
  const locale = usePreferences((s) => s.locale);
  const messages = locale === 'uk' ? uk : en;
  return { t: (key: MessageKey): string => messages[key], locale };
}
