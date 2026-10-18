'use client';
// "Listen" for a /topics stop's 30-second script, in the script's own voice; hidden without speechSynthesis.
import { useSpeech } from './use-speech';

export function TopicSay({ text, lang, label }: { text: string; lang: 'zh' | 'en'; label: string }) {
  const { canSpeak, say } = useSpeech(lang);
  if (!canSpeak) return null;
  return (
    <button type="button" className="topics-say-play" onClick={() => say(text)}>
      <span aria-hidden="true">▶</span> {label}
    </button>
  );
}
