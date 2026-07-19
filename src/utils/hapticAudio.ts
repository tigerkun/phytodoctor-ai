export function triggerHaptic(type: 'light' | 'medium' | 'heavy' = 'medium') {
  if ('vibrate' in navigator) {
    const patterns: Record<string, number | number[]> = {
      light: 10,
      medium: [20, 10, 20],
      heavy: [50, 30, 50]
    };

    try {
      navigator.vibrate(patterns[type]);
    } catch (e) {
      console.log('Haptic feedback not supported');
    }
  }
}

export function playAudio(type: 'water-drop' | 'leaf-rustle' | 'chime' | 'success') {
  if (!('AudioContext' in window)) return;

  try {
    const audioContext = new (window as any).AudioContext();
    
    const createOscillator = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      osc.frequency.value = frequency;
      osc.type = type;
      
      gain.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + duration);
    };

    switch (type) {
      case 'water-drop':
        createOscillator(800, 0.3);
        setTimeout(() => createOscillator(600, 0.2), 100);
        break;
      case 'leaf-rustle':
        // Noise-like effect
        const buff = audioContext.createBuffer(1, audioContext.sampleRate * 0.1, audioContext.sampleRate);
        const data = buff.getChannelData(0);
        for (let i = 0; i < buff.length; i++) {
          data[i] = Math.random() * 0.2;
        }
        const source = audioContext.createBufferSource();
        source.buffer = buff;
        const gain = audioContext.createGain();
        source.connect(gain);
        gain.connect(audioContext.destination);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        source.start();
        break;
      case 'chime':
        createOscillator(523, 0.3); // C5
        setTimeout(() => createOscillator(659, 0.3), 100); // E5
        setTimeout(() => createOscillator(784, 0.4), 200); // G5
        break;
      case 'success':
        createOscillator(523, 0.15); // C5
        setTimeout(() => createOscillator(659, 0.15), 100); // E5
        setTimeout(() => createOscillator(784, 0.3), 200); // G5
        break;
    }
  } catch (e) {
    console.log('Audio not supported');
  }
}
