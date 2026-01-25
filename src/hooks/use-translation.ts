'use client';

import { translations, Locale } from '@/lib/i18n/translations';

// 默认使用中文简体
const DEFAULT_LOCALE: Locale = 'zh-CN';

export function useTranslation(locale: Locale = DEFAULT_LOCALE) {
  const t = translations[locale];

  return { t, locale };
}
