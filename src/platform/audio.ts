export type SoundCue = "click" | "correct" | "wrong" | "complete";

const cueSettings: Record<SoundCue, { frequency: number; duration: number; type: OscillatorType; gain: number }> = {
  click: { frequency: 420, duration: 0.045, type: "sine", gain: 0.035 },
  correct: { frequency: 720, duration: 0.09, type: "triangle", gain: 0.055 },
  wrong: { frequency: 180, duration: 0.12, type: "sawtooth", gain: 0.035 },
  complete: { frequency: 880, duration: 0.16, type: "triangle", gain: 0.06 },
};

export class AudioService {
  private context: AudioContext | null = null;
  private enabled = true;
  private playLog: SoundCue[] = [];

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  getPlayLog(): SoundCue[] {
    return [...this.playLog];
  }

  play(cue: SoundCue): void {
    if (!this.enabled) {
      return;
    }
    const settings = cueSettings[cue];
    if (!settings) {
      throw new Error(`Unknown sound cue: ${cue}`);
    }
    this.playLog.push(cue);
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }
    this.context ??= new AudioContextCtor();
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = settings.type;
    oscillator.frequency.setValueAtTime(settings.frequency, now);
    gain.gain.setValueAtTime(settings.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + settings.duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + settings.duration);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

