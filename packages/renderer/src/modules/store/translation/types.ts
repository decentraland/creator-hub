export type Locale = 'en' | 'es' | 'zh';

export interface TranslationKeys {
  [key: string]: string;
}

export interface Translation {
  [locale: string]: TranslationKeys | null;
}
