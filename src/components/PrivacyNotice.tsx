import { Shield, Lock, Server, Cookie, Database, Trash2, X } from 'lucide-react';
import { getTranslation } from '../constants/translations';

interface PrivacyNoticeProps {
  lang?: 'ja' | 'en';
  variant?: 'full' | 'compact';
  onDismiss?: () => void;
}

export const PrivacyNotice = ({ lang = 'ja', variant = 'full', onDismiss }: PrivacyNoticeProps) => {
  const t = (key: string) => getTranslation(key, lang);

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-[--color-sage]/10 border border-[--color-sage]/30 px-3 py-2 text-xs">
        <Shield className="h-4 w-4 text-[--color-sage]" />
        <span className="text-[--color-navy]">{t('privacyCompact')}</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[--color-sage]/10 via-[--color-sage]/5 to-transparent border border-[--color-sage]/20 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[--color-sage]/20">
            <Shield className="h-5 w-5 text-[--color-sage]" />
          </div>
          <div>
            <h3 className="font-bold text-[--color-navy]">{t('privacyFullTitle')}</h3>
            <p className="text-sm text-[--color-navy-light]">{t('privacyFullSubtitle')}</p>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[--color-navy-light] hover:bg-[--color-sand] hover:text-[--color-navy] transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-white/50">
          <Lock className="h-5 w-5 text-[--color-sage] flex-shrink-0" />
          <div>
            <span className="font-semibold text-sm text-[--color-navy]">{t('privacyLocal')}</span>
            <p className="text-xs text-[--color-navy-light] mt-0.5">{t('privacyLocalDesc')}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-xl bg-white/50">
          <Server className="h-5 w-5 text-[--color-sage] flex-shrink-0" />
          <div>
            <span className="font-semibold text-sm text-[--color-navy]">
              {t('privacyNoUpload')}
            </span>
            <p className="text-xs text-[--color-navy-light] mt-0.5">{t('privacyNoUploadDesc')}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-xl bg-white/50">
          <Cookie className="h-5 w-5 text-[--color-sage] flex-shrink-0" />
          <div>
            <span className="font-semibold text-sm text-[--color-navy]">
              {t('privacyNoTracking')}
            </span>
            <p className="text-xs text-[--color-navy-light] mt-0.5">{t('privacyNoTrackingDesc')}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-xl bg-white/50">
          <Database className="h-5 w-5 text-[--color-sage] flex-shrink-0" />
          <div>
            <span className="font-semibold text-sm text-[--color-navy]">
              {t('privacyModelCache')}
            </span>
            <p className="text-xs text-[--color-navy-light] mt-0.5">{t('privacyModelCacheDesc')}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-xl bg-white/50">
          <Trash2 className="h-5 w-5 text-[--color-sage] flex-shrink-0" />
          <div>
            <span className="font-semibold text-sm text-[--color-navy]">
              {t('privacyDeletable')}
            </span>
            <p className="text-xs text-[--color-navy-light] mt-0.5">{t('privacyDeletableDesc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyNotice;
