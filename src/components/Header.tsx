import { ImagePlus, Github } from 'lucide-react';
import { getTranslation } from '../constants/translations';

interface HeaderProps {
  lang?: 'ja' | 'en';
}

export const Header = ({ lang = 'ja' }: HeaderProps) => {
  const t = (key: string) => getTranslation(key, lang);

  return (
    <header className="glass-card rounded-3xl p-6 sm:p-8 animate-fade-in-up">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[--color-coral] to-[--color-coral-dark] shadow-lg shadow-[--color-coral]/25 animate-float">
            <ImagePlus className="h-7 w-7 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[--color-navy] sm:text-3xl">
              SnapResize AI
            </h1>
            <p className="text-[--color-navy-light] text-sm mt-0.5">{t('headerSubtitle')}</p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://github.com/hyuraku/snapresize-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="tag tag-navy hover:bg-[--color-navy] hover:text-white transition-colors"
          >
            <Github className="w-3.5 h-3.5" />
            {t('badgeOpenSource')}
          </a>
          <span className="tag tag-coral">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            {t('badgeFree')}
          </span>
          <span className="tag tag-sage">
            <svg
              className="w-3.5 h-3.5"
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
            {t('badgePrivacy')}
          </span>
        </div>
      </div>
    </header>
  );
};
