// Web Audio API Typewriter, Telegraph & Morse Synthesizer

class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.6;
  private morseEnabled: boolean = false;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setConfig(enabled: boolean, volume: number, morseEnabled: boolean = false) {
    this.enabled = enabled;
    this.volume = Math.max(0, Math.min(1, volume));
    this.morseEnabled = morseEnabled;
  }

  // Typewriter / Teleprinter Mechanical Key Click
  public playKeyClick() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      // White noise buffer burst
      const bufferSize = this.ctx.sampleRate * 0.035; // 35ms
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      // Bandpass filter for vintage cast-iron clack
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1350 + Math.random() * 350, now);
      filter.Q.setValueAtTime(3.8, now);

      // Low frequency mechanical relay thud
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160 + Math.random() * 40, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.03);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.volume * 0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      noise.connect(filter);
      filter.connect(gain);
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
      osc.start(now);
      noise.stop(now + 0.04);
      osc.stop(now + 0.04);
    } catch (e) {}
  }

  // Vintage Carriage Return Bell & Teleprinter Solenoid Ding
  public playCarriageReturn() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(2489, now); // High telegraph bell D#7

      gain.gain.setValueAtTime(this.volume * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.9);
    } catch (e) {}
  }

  // Telegram Paper Feed / Card Swish
  public playCardFlip() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.06;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(750, now);
      filter.frequency.exponentialRampToValueAtTime(280, now + 0.06);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.volume * 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.06);
    } catch (e) {}
  }

  // Telegraph Transmit & Received Dispatch Chord
  public playSuccess() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C Telegraph chime
      notes.forEach((freq, idx) => {
        const now = this.ctx!.currentTime + idx * 0.06;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(this.volume * 0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now);
        osc.stop(now + 0.4);
      });
    } catch (e) {}
  }

  // Vintage Morse Code Sidetone Burst (750Hz CW tone)
  public playMorseSidetone(pattern: 'dot' | 'dash' | 'ack' = 'dot') {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const freq = 750; // Classic 750Hz CW tone

      if (pattern === 'dot') {
        this.playTone(freq, now, 0.05);
      } else if (pattern === 'dash') {
        this.playTone(freq, now, 0.14);
      } else {
        // Quick 3-tone ACK (dit-dah-dit)
        this.playTone(freq, now, 0.04);
        this.playTone(freq, now + 0.07, 0.1);
        this.playTone(freq, now + 0.2, 0.04);
      }
    } catch (e) {}
  }

  private playTone(freq: number, startTime: number, duration: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(this.volume * 0.28, startTime + 0.005);
    gain.gain.setValueAtTime(this.volume * 0.28, startTime + duration - 0.005);
    gain.gain.linearRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }
}

export const sound = new SoundManager();
