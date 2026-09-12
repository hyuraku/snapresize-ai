import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrivacyNotice } from './PrivacyNotice';

describe('PrivacyNotice - model source and first-run network disclosure', () => {
  it('discloses the model source and first-run network requirement in compact mode (JA)', () => {
    render(<PrivacyNotice lang="ja" variant="compact" />);

    const note = screen.getByTestId('privacyModelNetwork');
    expect(note).toHaveTextContent('Hugging Face');
    expect(note).toHaveTextContent('初回のみ');
    expect(note).toHaveTextContent('通信あり');
    expect(note).toHaveTextContent('オフラインでも動作');
    expect(note).toHaveTextContent('送信しません');
  });

  it('discloses the model source and first-run network requirement in compact mode (EN)', () => {
    render(<PrivacyNotice lang="en" variant="compact" />);

    const note = screen.getByTestId('privacyModelNetwork');
    expect(note).toHaveTextContent('Hugging Face');
    expect(note).toHaveTextContent('first use');
    expect(note).toHaveTextContent('network required');
    expect(note).toHaveTextContent('including offline');
    expect(note).toHaveTextContent('never sent');
  });

  it('discloses the model source and first-run network requirement in full mode (JA)', () => {
    render(<PrivacyNotice lang="ja" variant="full" />);

    const note = screen.getByTestId('privacyModelNetwork');
    expect(note).toHaveTextContent('初回のみ通信');
    expect(note).toHaveTextContent('Hugging Face');
  });

  it('discloses the model source and first-run network requirement in full mode (EN)', () => {
    render(<PrivacyNotice lang="en" variant="full" />);

    const note = screen.getByTestId('privacyModelNetwork');
    expect(note).toHaveTextContent('First Run Needs Network');
    expect(note).toHaveTextContent('Hugging Face');
  });
});
