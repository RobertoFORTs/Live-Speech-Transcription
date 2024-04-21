import mic from 'mic';

export class MicrophoneHandler {
  constructor(options) {
    this.options = options;
  }

  getMicInstance() {
    const micInstance = mic({
      rate: this.options.rate,
      channels: this.options.channels,
      debug: this.options.debug,
      exitOnSilence: this.options.exitOnSilence,
    });
    return micInstance;
  }
  handleAudioStream(ws) {
    const micInstance = this.getMicInstance();
    const micInputStream = micInstance.getAudioStream();
    micInputStream.on('data', (audioChunk) => {
      const chunkSize = 4096; 
      const rawData = audioChunk;
      for (let i = 0; i < rawData.length; i += chunkSize) {
        const end = Math.min(i + chunkSize, rawData.length);
        const chunk = rawData.slice(i, end);
        ws.send(chunk, { binary: true }); 
      }
    });
    micInstance.start();
  
    micInputStream.on('error', function (err) {
      console.error('Error in Input Stream:', err);
    });
  
    micInputStream.on('startComplete', function () {
      console.log('Started listening to Microphone.');
    });
  
    micInputStream.on('silence', function () {
      console.log('Got SIGNAL silence');
    });
  }
}