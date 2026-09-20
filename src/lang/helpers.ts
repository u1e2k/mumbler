import en from './locale/en';
import ja from './locale/ja';

const localeMap: { [k: string]: Partial<typeof en> } = {
  en,
  ja,
};

// Obsidianの言語設定を取得 (デフォルトは 'en')
const lang = window.localStorage.getItem('language') || 'en';
const currentLocale = localeMap[lang] || en;

/**
 * 現在のObsidian言語設定に応じた翻訳テキストを返します。
 * 翻訳が見つからない場合は英語（en.ts）へフォールバックします。
 * @param key 辞書のキー
 * @param variables プレースホルダー置換用の変数（例: { filePath: 'foo.md' }）
 */
export function t(
  key: keyof typeof en,
  variables?: Record<string, string>
): string {
  let text =
    (currentLocale && (currentLocale as any)[key]) || en[key] || (key as string);

  if (variables) {
    for (const [varKey, varVal] of Object.entries(variables)) {
      text = text.replace(new RegExp(`\\{${varKey}\\}`, 'g'), varVal);
    }
  }

  return text;
}
