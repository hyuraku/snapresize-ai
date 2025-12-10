import { useState, useEffect, useCallback } from 'react';
import {
  Header,
  Footer,
  FileUpload,
  FileList,
  ProcessingQueue,
  SettingsPanel,
  Sidebar,
  WASMWarningBanner,
  PrivacyNotice,
} from './components';
import { useImageStore } from './store/imageStore';
import { useImageProcessor, useDownload, useCapabilityDetection } from './hooks';
import { detectLanguage, getTranslation } from './constants/translations';
import { Download } from 'lucide-react';
import type { Language } from './types';

function App() {
  const [lang] = useState<Language>(detectLanguage);
  const t = useCallback((key: string) => getTranslation(key, lang), [lang]);

  const files = useImageStore((state) => state.files);
  const processed = useImageStore((state) => state.processed);
  const isProcessing = useImageStore((state) => state.isProcessing);

  const { processAll } = useImageProcessor();
  const { downloadAll, isDownloading } = useDownload();
  const { backend, isDetecting } = useCapabilityDetection();

  // Show download button after processing is complete
  const showDownloadButton = processed.length > 0 && !isProcessing;

  // Calculate current step
  const [currentStep, setCurrentStep] = useState(1);
  const [downloadCompleted, setDownloadCompleted] = useState(false);

  useEffect(() => {
    if (downloadCompleted) {
      setCurrentStep(4); // Step 3 completed after download
    } else if (processed.length > 0) {
      setCurrentStep(3);
    } else if (files.length > 0) {
      setCurrentStep(2);
    } else {
      setCurrentStep(1);
      setDownloadCompleted(false);
    }
  }, [files.length, processed.length, downloadCompleted]);

  // Auto download when processing is complete
  useEffect(() => {
    if (!isProcessing && processed.length > 0 && files.every((f) => f.status !== 'pending')) {
      const allCompleted = files.filter((f) => f.status === 'completed').length;
      if (allCompleted === processed.length && processed.length > 0 && !downloadCompleted) {
        // Start download after a short delay
        const timer = setTimeout(async () => {
          await downloadAll();
          setDownloadCompleted(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [isProcessing, processed.length, files, downloadAll, downloadCompleted]);

  const handleStart = async () => {
    if (files.length === 0 || isProcessing) return;
    await processAll();
  };

  // Status message
  const getStatusMessage = (): string => {
    if (isDownloading) {
      return t('statusCreatingZip');
    }
    if (isProcessing) {
      return t('statusProcessing');
    }
    if (processed.length > 0) {
      const failed = files.filter((f) => f.status === 'failed').length;
      if (failed > 0) {
        return `${processed.length}${t('imagesFailed')}${failed}${t('imagesFailed2')}`;
      }
      return `${processed.length}${t('imagesCompleted')}`;
    }
    if (files.length > 0) {
      return `${files.length}${t('imagesSelected')}`;
    }
    return t('statusUpload');
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <Header lang={lang} />

        {/* WASM Warning Banner */}
        {!isDetecting && backend === 'wasm' && (
          <div className="mt-4">
            <WASMWarningBanner lang={lang} />
          </div>
        )}

        {/* Hero Section: File Upload */}
        <section className="mt-6 animate-fade-in-up">
          <div className="glass-card rounded-3xl p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-2">
              <div>
                <p className="text-xl font-semibold text-[--color-navy]">{getStatusMessage()}</p>
                <p className="text-sm text-[--color-navy-light] mt-1">{t('statusSubtitle')}</p>
              </div>
              <div className="flex items-center gap-3">
                {showDownloadButton && (
                  <button
                    onClick={downloadAll}
                    disabled={isDownloading}
                    className="flex items-center gap-2 px-5 py-3 rounded-full bg-[--color-sage] text-white font-semibold shadow-lg shadow-[--color-sage]/30 hover:shadow-xl hover:shadow-[--color-sage]/40 hover:-translate-y-0.5 transition-all animate-pulse-soft"
                    aria-label={downloadCompleted ? t('btnRedownload') : t('btnDownloadAll')}
                  >
                    <Download className="w-5 h-5" />
                    <span>{downloadCompleted ? t('btnRedownload') : t('btnDownloadAll')}</span>
                  </button>
                )}
                <button
                  onClick={handleStart}
                  disabled={files.length === 0 || isProcessing}
                  className="btn-primary whitespace-nowrap"
                >
                  {isProcessing ? t('btnProcessing') : t('btnStart')}
                </button>
              </div>
            </div>
            <FileUpload lang={lang} />
            <FileList lang={lang} />
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Output Settings */}
          <article className="lg:col-span-2 animate-fade-in-up delay-100">
            <SettingsPanel lang={lang} />
          </article>

          <Sidebar lang={lang} currentStep={currentStep} />
        </section>

        <ProcessingQueue lang={lang} />

        {/* Privacy Notice - Placed above footer */}
        <div className="mt-8 animate-fade-in-up delay-300">
          <PrivacyNotice lang={lang} variant="compact" />
        </div>

        <Footer lang={lang} />
      </div>
    </div>
  );
}

export default App;
