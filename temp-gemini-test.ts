import 'dotenv/config';
import { analyzeDispatchScreenshot } from './src/modules/ride/dispatchVisionService';

const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';

(async () => {
  try {
    const result = await analyzeDispatchScreenshot({
      imageBase64: sampleBase64,
      mimeType: 'image/png'
    });
    console.log('RESULT', result);
  } catch (error) {
    console.error('ERROR', error);
  }
})();
