/**
 * 入力・出力の画素予算（pixel budget）
 *
 * ブラウザ内で全処理を行うため、確保できるメモリが上限になる。
 * ここに集約した値を validation / store / Canvas 処理 / 設定 UI が共有し、
 * 「割り当てる前に拒否する」ための判定に使う。
 */

/** 1 バッチで扱える最大枚数 */
export const MAX_FILES = 50;

/** 1 ファイルあたりの最大サイズ（50 MiB） */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * 保持する圧縮 blob の合計上限（800 MiB）。
 * README が謳う 800MB のしきい値をここに接続する。
 */
export const MAX_BATCH_TOTAL_BYTES = 800 * 1024 * 1024;

/** 入力画像の 1 辺の最大長（8K = 8192px。長辺・短辺いずれも） */
export const MAX_INPUT_EDGE_PX = 8192;

/**
 * 入力画像の総画素数の上限（40MP）。
 * 原寸 RGBA でおよそ 160MB。8K UHD（7680×4320 = 33.2MP）は通る。
 */
export const MAX_INPUT_PIXELS = 40_000_000;

/** 出力（カスタムサイズ）の下限・上限 */
export const MIN_OUTPUT_PX = 100;
export const MAX_OUTPUT_PX = 4096;

/**
 * ヘッダ解析のために読み取る先頭バイト数（64 KiB）。
 * JPEG の SOF は EXIF(APP1) の後ろに来ることがあるのでこの程度を読む。
 */
export const HEADER_READ_BYTES = 64 * 1024;

/** バイト数を MB 表記にする（上限・実測の表示用） */
export const toMegabytes = (bytes: number): string => {
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10}MB`;
};

/**
 * 画素数を桁区切りの実数表記にする（上限・実測の表示用）。
 * MP に丸めると 40,006,400 と 40,000,000 がどちらも「40MP」になり
 * 「40MP です。上限は 40MP です」という矛盾した文になるため、実数で出す。
 * 区切りは UI 言語に依らず一定にしたいので 'en-US' 固定。
 */
export const formatPixels = (pixels: number): string => pixels.toLocaleString('en-US');

/** 出力サイズを MIN_OUTPUT_PX..MAX_OUTPUT_PX に収める */
export const clampOutputSize = (value: number): number => {
  if (!Number.isFinite(value)) return MIN_OUTPUT_PX;
  return Math.min(MAX_OUTPUT_PX, Math.max(MIN_OUTPUT_PX, Math.round(value)));
};
