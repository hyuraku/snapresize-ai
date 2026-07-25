import { createLucideIcon } from 'lucide-react';

/**
 * Locally vendored GitHub mark.
 *
 * Lucide removed every trademarked brand icon (`Github`, `Slack`, `Figma`, ...)
 * in v1.0.0, so `import { Github } from 'lucide-react'` no longer resolves.
 * See https://github.com/lucide-icons/lucide/releases/tag/1.0.1
 *
 * The path data below is Lucide's own `github` icon as shipped in
 * lucide-react 0.561.0 (ISC License, Copyright (c) Lucide Icons and
 * Contributors), kept verbatim so the rendered mark is pixel-identical to
 * what the app used before the upgrade.
 *
 * `createLucideIcon` is a stable public export in both 0.561.0 and 1.21.0
 * with an identical `(iconName, iconNode)` signature, so this component works
 * on either version.
 */
export const GithubIcon = createLucideIcon('github', [
  [
    'path',
    {
      d: 'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4',
      key: 'tonef',
    },
  ],
  ['path', { d: 'M9 18c-4.51 2-5-2-7-2', key: '9comsn' }],
]);
