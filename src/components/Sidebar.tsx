import { useImageStore } from '../store/imageStore';
import { getTranslation } from '../constants/translations';
import { Check, Upload, Settings, Download, Trash2 } from 'lucide-react';

interface SidebarProps {
  lang?: 'ja' | 'en';
  currentStep: number;
}

export const Sidebar = ({ lang = 'ja', currentStep }: SidebarProps) => {
  const t = (key: string) => getTranslation(key, lang);
  const files = useImageStore((state) => state.files);
  const processed = useImageStore((state) => state.processed);
  const clearFiles = useImageStore((state) => state.clearFiles);
  const unit = t('unitImages');

  const steps = [
    { num: 1, label: t('step1'), icon: Upload },
    { num: 2, label: t('step2'), icon: Settings },
    { num: 3, label: t('step3'), icon: Download },
  ];

  return (
    <aside className="space-y-6 animate-fade-in-up delay-200">
      {/* Step Indicator */}
      <section className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-bold text-[--color-navy] mb-4">{t('stepsTitle')}</h3>
        <div className="space-y-3 mb-5">
          {steps.map((step, idx) => {
            const isCompleted = step.num < currentStep;
            const isCurrent = step.num === currentStep;
            const IconComponent = step.icon;

            return (
              <div
                key={step.num}
                className={`flex items-center gap-3 p-2 rounded-xl transition-all ${
                  isCurrent ? 'bg-[--color-coral]/5' : ''
                }`}
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all ${
                    isCompleted
                      ? 'bg-[--color-sage] text-white shadow-md shadow-[--color-sage]/30'
                      : isCurrent
                        ? 'bg-[--color-coral] text-white shadow-md shadow-[--color-coral]/30'
                        : 'bg-[--color-sand] text-[--color-navy-light]'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <IconComponent className="w-4 h-4" />
                  )}
                </span>
                <span
                  className={`text-sm font-medium ${
                    isCompleted
                      ? 'text-[--color-sage]'
                      : isCurrent
                        ? 'text-[--color-coral]'
                        : 'text-[--color-navy-light]'
                  }`}
                >
                  {step.label}
                </span>
                {isCurrent && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-[--color-coral] animate-pulse-soft" />
                )}
              </div>
            );
          })}
        </div>

        <hr className="border-[--color-sand] mb-4" />

        <h3 className="text-sm font-bold text-[--color-navy]">{t('statusTitle')}</h3>
        <dl className="mt-3 space-y-3">
          <div className="flex items-center justify-between p-2 rounded-lg bg-[--color-cream-dark]/50">
            <dt className="text-sm text-[--color-navy-light]">{t('statusSelected')}</dt>
            <dd className="font-bold text-[--color-navy] text-lg">
              {files.length}
              <span className="text-sm font-normal text-[--color-navy-light] ml-0.5">{unit}</span>
            </dd>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-[--color-sage]/5">
            <dt className="text-sm text-[--color-navy-light]">{t('statusCompleted')}</dt>
            <dd className="font-bold text-[--color-sage] text-lg">
              {processed.length}
              <span className="text-sm font-normal text-[--color-sage]/70 ml-0.5">{unit}</span>
            </dd>
          </div>
        </dl>
        <button
          onClick={clearFiles}
          className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl border-2 border-[--color-sand] px-4 py-2.5 text-sm font-medium text-[--color-navy-light] transition-all hover:bg-[--color-sand] hover:text-[--color-navy]"
        >
          <Trash2 className="w-4 h-4" />
          {t('btnClear')}
        </button>
      </section>

      {/* Privacy */}
      <section className="rounded-2xl bg-gradient-to-br from-[--color-sage]/10 to-[--color-sage]/5 p-5 border border-[--color-sage]/20">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[--color-sage]/20">
            <svg
              className="w-5 h-5 text-[--color-sage]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-[--color-navy]">{t('privacyTitle')}</h3>
            <p className="mt-1.5 text-xs text-[--color-navy-light] leading-relaxed">
              {t('privacyDesc')}
            </p>
          </div>
        </div>
      </section>
    </aside>
  );
};
