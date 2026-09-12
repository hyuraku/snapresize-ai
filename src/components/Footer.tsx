import { GithubIcon } from './icons/GithubIcon';
import { getTranslation } from '../constants/translations';
import type { Language } from '../types';

interface FooterProps {
  lang?: Language;
}

const MODEL_CARD_URL = 'https://huggingface.co/briaai/RMBG-1.4';

export const Footer = ({ lang = 'ja' }: FooterProps) => {
  const t = (key: string) => getTranslation(key, lang);
  const licenseText = t('footerCopyright');
  const [beforeModel, afterModel] = licenseText.split('RMBG-1.4');

  return (
    <footer className="mt-12 pt-8 border-t border-(--color-sand)">
      <div className="flex flex-col items-center gap-2">
        <a
          href="https://github.com/hyuraku/snapresize-ai"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-(--color-navy-light) hover:text-(--color-coral) transition-colors"
        >
          <GithubIcon className="w-4 h-4" />
          GitHub
        </a>
        <p
          data-testid="footerLicense"
          className="text-xs text-(--color-navy-light) text-center max-w-md"
        >
          {beforeModel}
          {afterModel !== undefined ? (
            <a
              href={MODEL_CARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-(--color-coral) transition-colors"
            >
              RMBG-1.4
            </a>
          ) : null}
          {afterModel}
        </p>
      </div>
    </footer>
  );
};
