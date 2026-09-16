// Text-to-Speech & Speech Recognition Helper

let currentAudio: HTMLAudioElement | null = null;

function fallbackSpeechSynthesis(cleanText: string, rate: number = 0.95): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'en-US';
      utterance.rate = rate;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const englishVoice =
        voices.find(
          (v) =>
            (v.lang === 'en-US' || v.lang.startsWith('en')) &&
            (v.name.includes('Natural') ||
              v.name.includes('Google') ||
              v.name.includes('Samantha') ||
              v.name.includes('Daniel') ||
              v.name.includes('Jenny') ||
              v.name.includes('Guy'))
        ) || voices.find((v) => v.lang.startsWith('en'));

      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
    } catch {
      resolve();
    }
  });
}

export function speakEnglishText(text: string, rate: number = 0.95): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    // Stop previous audio playback
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch {}
      currentAudio = null;
    }

    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    // Clean text of markdown asterisks or special characters
    const cleanText = text.replace(/[*_~`]/g, '').trim();
    if (!cleanText) {
      resolve();
      return;
    }

    // Check if desktop browser has high-fidelity Natural voice
    const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    const hasNaturalVoice = voices.some(
      (v) => v.name.includes('Natural') || v.name.includes('Online')
    );

    // If on mobile or no desktop Natural neural voice is installed, use high-fidelity native audio stream
    const isMobile =
      typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    if ((isMobile || !hasNaturalVoice) && cleanText.length <= 300) {
      try {
        // High-definition American English native audio stream (type=2: American, type=1: British)
        const audioUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanText)}&type=2`;
        const audio = new Audio(audioUrl);
        currentAudio = audio;

        audio.onended = () => {
          currentAudio = null;
          resolve();
        };

        audio.onerror = () => {
          currentAudio = null;
          fallbackSpeechSynthesis(cleanText, rate).then(resolve);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            currentAudio = null;
            fallbackSpeechSynthesis(cleanText, rate).then(resolve);
          });
        }
        return;
      } catch {
        // fallback if Audio construction fails
      }
    }

    // Fallback or desktop Edge with Natural voice
    fallbackSpeechSynthesis(cleanText, rate).then(resolve);
  });
}

// Browser notification helper
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function showBrowserNotification(title: string, body: string) {
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    new Notification(title, {
      body,
      icon: '/icon.svg',
    });
  }
}

export const sendLocalNotification = showBrowserNotification;
