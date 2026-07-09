type WebkitAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export type PortalHapticTone = 'light' | 'success' | 'warning' | 'pop';
export type PortalExamTone = 'success' | 'click' | 'warning' | 'fail' | 'transition';

let sharedAudioContext: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const AudioContextCtor =
    window.AudioContext || (window as WebkitAudioWindow).webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextCtor();
  }

  if (sharedAudioContext.state === 'suspended') {
    void sharedAudioContext.resume().catch(() => {});
  }

  return sharedAudioContext;
}

function runTone(
  configure: (
    context: AudioContext,
    oscillator: OscillatorNode,
    gainNode: GainNode,
  ) => number,
): void {
  try {
    const context = getSharedAudioContext();
    if (!context) {
      return;
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    const duration = configure(context, oscillator, gainNode);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  } catch {
    // Ignore browser autoplay restrictions.
  }
}

export function playPortalTap(
  frequency = 700,
  gainValue = 0.04,
  durationSeconds = 0.06,
): void {
  runTone((context, oscillator, gainNode) => {
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gainNode.gain.setValueAtTime(gainValue, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + Math.max(durationSeconds - 0.01, 0.02),
    );
    return durationSeconds;
  });
}

export function playPortalHaptic(type: PortalHapticTone): void {
  runTone((context, oscillator, gainNode) => {
    if (type === 'light') {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(650, context.currentTime);
      gainNode.gain.setValueAtTime(0.06, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.04);
      return 0.05;
    }

    if (type === 'success') {
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(523.25, context.currentTime);
      oscillator.frequency.setValueAtTime(659.25, context.currentTime + 0.08);
      oscillator.frequency.setValueAtTime(783.99, context.currentTime + 0.16);
      gainNode.gain.setValueAtTime(0.1, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
      return 0.4;
    }

    if (type === 'warning') {
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(180, context.currentTime);
      gainNode.gain.setValueAtTime(0.08, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.15);
      return 0.18;
    }

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(220, context.currentTime);
    gainNode.gain.setValueAtTime(0.15, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.06);
    return 0.08;
  });
}

export function playPortalExamTone(type: PortalExamTone): void {
  runTone((context, oscillator, gainNode) => {
    if (type === 'success') {
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(523.25, context.currentTime);
      oscillator.frequency.setValueAtTime(659.25, context.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(783.99, context.currentTime + 0.2);
      oscillator.frequency.setValueAtTime(1046.5, context.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.12, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.55);
      return 0.6;
    }

    if (type === 'click') {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(750, context.currentTime);
      gainNode.gain.setValueAtTime(0.05, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);
      return 0.1;
    }

    if (type === 'transition') {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(450, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(900, context.currentTime + 0.15);
      gainNode.gain.setValueAtTime(0.05, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
      return 0.2;
    }

    if (type === 'warning') {
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(200, context.currentTime);
      oscillator.frequency.linearRampToValueAtTime(130, context.currentTime + 0.22);
      gainNode.gain.setValueAtTime(0.1, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.24);
      return 0.28;
    }

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(280, context.currentTime);
    oscillator.frequency.setValueAtTime(200, context.currentTime + 0.12);
    gainNode.gain.setValueAtTime(0.12, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.4);
    return 0.45;
  });
}
