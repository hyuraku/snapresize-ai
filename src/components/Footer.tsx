import { Github } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="mt-12 pt-8 border-t border-[--color-sand]">
      <div className="flex justify-center">
        <a
          href="https://github.com/hyuraku/snapresize-ai"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-[--color-navy-light] hover:text-[--color-coral] transition-colors"
        >
          <Github className="w-4 h-4" />
          GitHub
        </a>
      </div>
    </footer>
  );
};
