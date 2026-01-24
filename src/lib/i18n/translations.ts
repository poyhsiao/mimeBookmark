export const translations = {
  'zh-CN': {
    recommendations: {
      title: '为你推荐',
      visitLink: '访问链接',
      dismissAria: (title: string) => `关闭推荐"${title}"`,
    },
  },
  en: {
    recommendations: {
      title: 'Recommended for you',
      visitLink: 'Visit link',
      dismissAria: (title: string) => `Dismiss recommendation "${title}"`,
    },
  },
} as const;

export type Locale = keyof typeof translations;
export type TranslationKey = keyof typeof translations['zh-CN'];
