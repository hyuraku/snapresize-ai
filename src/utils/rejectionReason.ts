import { getTranslation } from '../constants/translations';
import type { Language, RejectionReason } from '../types';

/**
 * 構造化された拒否理由（翻訳キー＋パラメータ）を表示用の文字列にする。
 * 文言側は `{name}` のプレースホルダを持ち、ここで実測値・上限値に置き換える。
 */
export const formatRejectionReason = (reason: RejectionReason, lang?: Language): string => {
  const template = getTranslation(reason.key, lang);
  if (!reason.params) return template;

  return Object.entries(reason.params).reduce(
    (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
    template
  );
};
