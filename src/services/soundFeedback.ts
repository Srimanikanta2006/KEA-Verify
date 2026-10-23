/**
 * Real-time audio and haptic feedback service for KEA-Verify.
 *
 * Designed for noisy, high-throughput exam gate conditions where invigilators
 * cannot continuously stare at the smartphone screen.
 *
 * Uses the Web Audio API on web (synthesized frequencies — 100% offline,
 * 0 external asset loading latency) and web/device vibration patterns.
 */

class SoundFeedbackService {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.audioCtx) {
        const AudioContextClass =
          window.AudioContext ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume();
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  /**
   * Crisp high-pitch ascending chime (880Hz -> 1320Hz) indicating successful
   * candidate verification and gate clearance.
   */
  public playSuccess(): void {
    // 1. Audio tone
    try {
      const ctx = this.getAudioContext();
      if (ctx) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const now = ctx.currentTime;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now); // A5
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12); // E6

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.22);
      }
    } catch {
      // Audio is best-effort
    }

    // 2. Haptic feedback
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(60); // Clean 60ms pulse
      }
    } catch {
      // Haptics are best-effort
    }
  }

  /**
   * Low harsh double-buzz (220Hz -> 160Hz) indicating rejection,
   * centre mismatch, or passback duplicate attempt.
   */
  public playError(): void {
    // 1. Audio tone
    try {
      const ctx = this.getAudioContext();
      if (ctx) {
        const now = ctx.currentTime;

        // Buzz 1
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(220, now);
        osc1.frequency.setValueAtTime(160, now + 0.08);

        gain1.gain.setValueAtTime(0.22, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.14);

        // Buzz 2
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(220, now + 0.16);
        osc2.frequency.setValueAtTime(140, now + 0.24);

        gain2.gain.setValueAtTime(0.22, now + 0.16);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.16);
        osc2.stop(now + 0.32);
      }
    } catch {
      // Audio is best-effort
    }

    // 2. Haptic feedback (Double alert buzz: 100ms on, 60ms pause, 180ms on)
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([100, 60, 180]);
      }
    } catch {
      // Haptics are best-effort
    }
  }
}

export const soundFeedback = new SoundFeedbackService();
