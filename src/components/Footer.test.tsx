import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';

describe('Footer - license disclosure', () => {
  it('renders the code/model license split and a link to the model card (JA)', () => {
    render(<Footer lang="ja" />);

    const license = screen.getByTestId('footerLicense');
    expect(license).toHaveTextContent('MIT License');
    expect(license).toHaveTextContent('RMBG-1.4');
    expect(license).toHaveTextContent('非商用');
    expect(license).toHaveTextContent('BRIA との契約が必要');

    const link = screen.getByRole('link', { name: 'RMBG-1.4' });
    expect(link).toHaveAttribute('href', 'https://huggingface.co/briaai/RMBG-1.4');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the code/model license split and a link to the model card (EN)', () => {
    render(<Footer lang="en" />);

    const license = screen.getByTestId('footerLicense');
    expect(license).toHaveTextContent('MIT License');
    expect(license).toHaveTextContent('RMBG-1.4');
    expect(license).toHaveTextContent('non-commercial');
    expect(license).toHaveTextContent('agreement with BRIA');

    const link = screen.getByRole('link', { name: 'RMBG-1.4' });
    expect(link).toHaveAttribute('href', 'https://huggingface.co/briaai/RMBG-1.4');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('still renders the GitHub link', () => {
    render(<Footer lang="en" />);
    const githubLink = screen.getByRole('link', { name: /GitHub/ });
    expect(githubLink).toHaveAttribute('href', 'https://github.com/hyuraku/snapresize-ai');
  });
});
