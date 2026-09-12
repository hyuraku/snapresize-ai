import type { Language, Translations } from '../types';

const translations: Record<Language, Translations> = {
  ja: {
    // Header
    headerSubtitle: '画像リサイズ・背景除去・透かし追加をブラウザだけで',
    badgeOpenSource: 'OSS',
    badgeFree: '完全無料',
    badgePrivacy: 'データ送信なし',
    // Status
    statusUpload: '画像をアップロードしてください',
    statusSubtitle: 'SNS用に最適化された画像を作成できます',
    statusProcessing: '画像を処理しています...',
    statusCreatingZip: 'ZIPファイルを作成中...',
    statusDownloaded: '枚の画像をダウンロードしました！',
    statusFailed: 'ダウンロードに失敗しました。もう一度お試しください。',
    // Buttons
    btnStart: '処理を開始',
    btnProcessing: '処理中...',
    btnSelectFiles: 'ファイルを選択',
    btnClear: 'すべてクリア',
    btnDownload: 'DL',
    btnDownloadAll: '一括ダウンロード',
    btnRedownload: '再度ダウンロード',
    // Drop zone
    dropZoneTitle: '画像をドラッグ＆ドロップ',
    dropZoneSubtitle: 'たった3ステップで完成！',
    dropZoneFormats: 'JPG / PNG / WebP（最大50枚・各50MB・8192px / 40MPまで）',
    // Model loading
    modelLoading: 'AIモデルを読み込み中...',
    modelInit: 'ニューラルネットワークを初期化中...',
    modelOptimize: 'WebGPUを最適化中...',
    modelReady: 'AI準備完了！',
    modelError: 'モデルの読み込みに失敗しました',
    modelFallback: 'WebGPU非対応のためWASMモードで動作します（処理が遅くなります）',
    // Settings
    settingsTitle: '出力設定',
    settingsHint: '設定を確認',
    presetLabel: 'SNSプリセット',
    bgRemovalLabel: '背景除去',
    bgRemovalToggle: 'AIで背景を除去する',
    bgRemovalNote: '※ 初回は{size}のモデルをダウンロードします',
    watermarkLabel: '透かし',
    watermarkToggle: '透かしを追加する',
    watermarkWith: '透かしあり',
    placeholderWatermark: '透かしテキストを入力',
    posBottomRight: '右下',
    posBottomLeft: '左下',
    posCenter: '中央',
    posTopRight: '右上',
    posTopLeft: '左上',
    qualityLabel: '画質',
    qualityLight: '軽量',
    qualityHigh: '高画質',
    customSizeClampedNote:
      '※ 出力サイズは{min}〜{max}pxの範囲に収めました。これより大きい画像はメモリ不足で失敗するため作成できません。',
    // Steps
    stepsTitle: 'かんたん3ステップ',
    step1: '画像を選択',
    step2: '設定を確認',
    step3: 'ダウンロード',
    // Processing status
    statusTitle: '処理状況',
    statusSelected: '選択中',
    statusCompleted: '処理完了',
    unitImages: '枚',
    // Queue
    queueTitle: '画像一覧',
    queueEmpty: '画像を追加してください',
    // File status
    filePending: '待機中',
    fileProcessing: '処理中...',
    fileCompleted: '完了',
    fileFailed: 'エラー',
    // Privacy
    privacyTitle: 'プライバシー保護',
    privacyDesc:
      'すべての処理はお使いのブラウザ内で完結。画像がサーバーに送信されることはありません。',
    // Footer
    footerCopyright:
      'コードは MIT License。背景除去モデル RMBG-1.4 は別条件（非商用。商用利用は BRIA との契約が必要）',
    // Rejected files (上限・理由・対処を必ず含める)
    rejectedTitle: '追加できなかった画像があります',
    rejectedDismiss: '閉じる',
    rejectTooManyFiles: '一度に追加できるのは{max}枚までです。枚数を減らしてから追加してください。',
    rejectFileTooLarge:
      'ファイルサイズが{size}です。1枚あたりの上限は{max}です。画質を下げるか縮小して、ファイルサイズを下げてから追加してください。',
    rejectUnsupportedFormat:
      '対応していない形式です。JPG / PNG / WebP のいずれかで保存し直してから追加してください。',
    rejectFormatMismatch:
      'ファイルの中身が拡張子と一致しません（検出: {detected}）。JPG / PNG / WebP のいずれかで保存し直してから追加してください。',
    rejectEdgeTooLarge:
      '画像サイズが{width}×{height}pxです。1辺の上限は{max}pxです。縮小してから再度追加してください。',
    rejectTooManyPixels:
      '総画素数が{pixels}画素（{width}×{height}px）です。上限は{max}画素です。縮小してから再度追加してください。',
    rejectBatchTooLarge:
      '選択中の画像の合計が上限{max}を超えます。枚数を減らすか、ファイルサイズを下げてから追加してください。',
    errorDecodeFailed:
      '画像を読み込めませんでした。ファイルが壊れている可能性があります。保存し直すか、別の画像で試してください。',
    // Selection messages
    imagesSelected: '枚の画像を選択中',
    imagesCompleted: '枚の処理が完了しました！',
    imagesFailed: '枚完了、',
    imagesFailed2: '枚失敗',
    // Status Indicator
    statusDetecting: 'ブラウザ機能を検出中...',
    statusOptimal: '最適なパフォーマンス',
    statusSlower: '処理が遅くなります',
    statusHighMemory: 'メモリ使用量が高い',
    // WASM Warning
    wasmWarningTitle: 'パフォーマンス警告',
    wasmWarningDesc:
      'WebGPU非対応のため、処理が最大100倍遅くなる可能性があります。最適なパフォーマンスには以下のブラウザを推奨します：',
    // Privacy Notice (Full)
    privacyCompact: 'すべての処理はブラウザ内で完結',
    privacyFullTitle: 'あなたのプライバシーは保護されています',
    privacyFullSubtitle: '完全ローカル処理でデータの安全を保証',
    privacyLocal: '完全ローカル処理',
    privacyLocalDesc: 'すべての画像処理はあなたのブラウザ内で実行',
    privacyNoUpload: 'サーバーへの送信なし',
    privacyNoUploadDesc: '画像がインターネットを通じて送信されることは一切ありません',
    privacyNoTracking: 'トラッキングなし',
    privacyNoTrackingDesc: 'Cookie、分析ツール、広告トラッカーは使用しません',
    privacyModelCache: 'AIモデルのみキャッシュ',
    privacyModelCacheDesc: '2回目以降の高速起動のためモデルのみローカルに保存',
    privacyModelNetwork: '初回のみ通信',
    privacyModelNetworkDesc:
      'モデルは初回のみHugging Faceから取得（通信あり）。取得後はキャッシュからオフラインでも動作し、画像は送信しません',
    privacyDeletable: 'いつでも削除可能',
    privacyDeletableDesc: 'ブラウザの設定からいつでもキャッシュを削除できます',
  },
  en: {
    // Header
    headerSubtitle: 'Resize, remove background & add watermarks in your browser',
    badgeOpenSource: 'Open Source',
    badgeFree: 'Free',
    badgePrivacy: 'No data upload',
    // Status
    statusUpload: 'Upload your images',
    statusSubtitle: 'Create optimized images for social media',
    statusProcessing: 'Processing images...',
    statusCreatingZip: 'Creating ZIP file...',
    statusDownloaded: ' images downloaded!',
    statusFailed: 'Download failed. Please try again.',
    // Buttons
    btnStart: 'Start Processing',
    btnProcessing: 'Processing...',
    btnSelectFiles: 'Select Files',
    btnClear: 'Clear All',
    btnDownload: 'DL',
    btnDownloadAll: 'Download All',
    btnRedownload: 'Download Again',
    // Drop zone
    dropZoneTitle: 'Drag & Drop Images',
    dropZoneSubtitle: 'Done in just 3 steps!',
    dropZoneFormats: 'JPG / PNG / WebP (up to 50 files, 50MB / 8192px / 40MP each)',
    // Model loading
    modelLoading: 'Loading AI model...',
    modelInit: 'Initializing neural network...',
    modelOptimize: 'Optimizing WebGPU...',
    modelReady: 'AI Ready!',
    modelError: 'Failed to load model',
    modelFallback: 'WebGPU not supported. Using WASM mode (slower processing)',
    // Settings
    settingsTitle: 'Output Settings',
    settingsHint: 'Check settings',
    presetLabel: 'SNS Presets',
    bgRemovalLabel: 'Background Removal',
    bgRemovalToggle: 'Remove background with AI',
    bgRemovalNote: '※ First use requires {size} model download',
    watermarkLabel: 'Watermark',
    watermarkToggle: 'Add watermark',
    watermarkWith: 'With watermark',
    placeholderWatermark: 'Enter watermark text',
    posBottomRight: 'Bottom Right',
    posBottomLeft: 'Bottom Left',
    posCenter: 'Center',
    posTopRight: 'Top Right',
    posTopLeft: 'Top Left',
    qualityLabel: 'Quality',
    qualityLight: 'Light',
    qualityHigh: 'High',
    customSizeClampedNote:
      '※ Output size was clamped to {min}-{max}px. Larger outputs are not created because they run out of memory.',
    // Steps
    stepsTitle: 'Easy 3 Steps',
    step1: 'Select images',
    step2: 'Check settings',
    step3: 'Download',
    // Processing status
    statusTitle: 'Status',
    statusSelected: 'Selected',
    statusCompleted: 'Completed',
    unitImages: '',
    // Queue
    queueTitle: 'Your Images',
    queueEmpty: 'Add images to get started',
    // File status
    filePending: 'Pending',
    fileProcessing: 'Processing...',
    fileCompleted: 'Done',
    fileFailed: 'Error',
    // Privacy
    privacyTitle: 'Privacy Protected',
    privacyDesc: 'All processing happens in your browser. No images are sent to any server.',
    // Footer
    footerCopyright:
      'Code: MIT License. Background removal model RMBG-1.4 is licensed separately (non-commercial; commercial use requires an agreement with BRIA)',
    // Rejected files (always state the limit and how to fix it)
    rejectedTitle: 'Some images could not be added',
    rejectedDismiss: 'Dismiss',
    rejectTooManyFiles: 'You can add up to {max} images at a time. Please add fewer images.',
    rejectFileTooLarge:
      'This file is {size}. The limit is {max} per file. Lower the quality or resize it to reduce the file size, then add it again.',
    rejectUnsupportedFormat:
      'Unsupported format. Please re-save the image as JPG / PNG / WebP and add it again.',
    rejectFormatMismatch:
      'File content does not match its extension (detected: {detected}). Please re-save the image as JPG / PNG / WebP and add it again.',
    rejectEdgeTooLarge:
      'This image is {width}x{height}px. The limit is {max}px per edge. Please resize it and add it again.',
    rejectTooManyPixels:
      'This image has {pixels} pixels ({width}x{height}px). The limit is {max} pixels. Please resize it and add it again.',
    rejectBatchTooLarge:
      'The selected images exceed the {max} total limit. Please add fewer images or reduce their file sizes.',
    errorDecodeFailed:
      'The image could not be loaded. The file may be corrupted. Please re-save it or try another image.',
    // Selection messages
    imagesSelected: ' images selected',
    imagesCompleted: ' images completed!',
    imagesFailed: ' completed, ',
    imagesFailed2: ' failed',
    // Status Indicator
    statusDetecting: 'Detecting browser capabilities...',
    statusOptimal: 'Optimal Performance',
    statusSlower: 'Slower Processing',
    statusHighMemory: 'High Memory Usage',
    // WASM Warning
    wasmWarningTitle: 'Performance Warning',
    wasmWarningDesc:
      'WebGPU not supported. Processing may be up to 100x slower. For optimal performance, use one of these browsers:',
    // Privacy Notice (Full)
    privacyCompact: 'All processing happens in your browser',
    privacyFullTitle: 'Your Privacy is Protected',
    privacyFullSubtitle: 'Fully local processing ensures your data stays safe',
    privacyLocal: 'Fully Local Processing',
    privacyLocalDesc: 'All image processing runs entirely in your browser',
    privacyNoUpload: 'No Server Uploads',
    privacyNoUploadDesc: 'Your images are never transmitted over the internet',
    privacyNoTracking: 'No Tracking',
    privacyNoTrackingDesc: 'No cookies, analytics, or ad trackers',
    privacyModelCache: 'Only AI Model Cached',
    privacyModelCacheDesc: 'Only the AI model is saved locally for faster startup',
    privacyModelNetwork: 'First Run Needs Network',
    privacyModelNetworkDesc:
      'The AI model is fetched from Hugging Face on first use (network required). After that it runs from cache, including offline. Images are never sent.',
    privacyDeletable: 'Deletable Anytime',
    privacyDeletableDesc: 'Clear cache anytime from your browser settings',
  },
};

// Detect current language
export const detectLanguage = (): Language => {
  return navigator.language.startsWith('ja') ? 'ja' : 'en';
};

// Get translation
export const getTranslation = (key: string, lang?: Language): string => {
  const currentLang = lang || detectLanguage();
  return translations[currentLang][key] || translations['en'][key] || key;
};

// Helper for translation hook
export const createTranslator = (lang: Language) => {
  return (key: string): string => getTranslation(key, lang);
};

export default translations;
