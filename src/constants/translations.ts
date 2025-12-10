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
    dropZoneFormats: 'JPG / PNG / WebP（最大50枚・各50MBまで）',
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
    bgRemovalNote: '※ 初回は177MBのモデルをダウンロードします',
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
    privacyDesc: 'すべての処理はお使いのブラウザ内で完結。画像がサーバーに送信されることはありません。',
    // Footer
    footerCopyright: 'SnapResize AI - オープンソースソフトウェア（MIT License）',
    footerTerms: '利用規約',
    footerPrivacy: 'プライバシーポリシー',
    // Alert
    alertInvalidFile: '対応していない形式か、ファイルサイズが大きすぎます。\nJPG/PNG/WebP形式で50MB以下のファイルを選択してください。',
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
    wasmWarningDesc: 'WebGPU非対応のため、処理が最大100倍遅くなる可能性があります。最適なパフォーマンスには以下のブラウザを推奨します：',
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
    dropZoneFormats: 'JPG / PNG / WebP (up to 50 files, 50MB each)',
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
    bgRemovalNote: '※ First use requires 177MB model download',
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
    footerCopyright: 'SnapResize AI - Open Source Software (MIT License)',
    footerTerms: 'Terms',
    footerPrivacy: 'Privacy Policy',
    // Alert
    alertInvalidFile: 'Unsupported format or file too large.\nPlease select JPG/PNG/WebP files under 50MB.',
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
    wasmWarningDesc: 'WebGPU not supported. Processing may be up to 100x slower. For optimal performance, use one of these browsers:',
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
