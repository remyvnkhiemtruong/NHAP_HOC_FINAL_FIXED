import jsQR from 'jsqr';
import Tesseract from 'tesseract.js';
import { parseCccdQr, ParsedQrData } from './qrParser';

export interface ScanResult {
  qr: {
    rawPayload: string;
    parsed: ParsedQrData;
    success: boolean;
    decoder: { name: string; version: string };
  };
  ocr: { rawText: string; engine: string };
}

export async function processCccdImage(file: File): Promise<ScanResult> {
  const imageUrl = URL.createObjectURL(file);
  let rawPayload = '';
  let ocrText = '';
  let parsed: ParsedQrData = {};

  try {
    // 1. Quét QR Code
    const img = new Image();
    img.src = imageUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(img, 0, 0, img.width, img.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = ['dontInvert', 'onlyInvert', 'attemptBoth']
        .map((inversionAttempts) => jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: inversionAttempts as 'dontInvert' | 'onlyInvert' | 'attemptBoth',
        }))
        .find(Boolean);

      if (code) {
        rawPayload = code.data;
        parsed = parseCccdQr(rawPayload);
      }
    }

    // 2. OCR bằng Tesseract (sử dụng worker để không block main thread)
    // Cần tải gói ngôn ngữ 'vie'. Mặc định tải từ network.
    const worker = await Tesseract.createWorker('vie');
    const ret = await worker.recognize(imageUrl);
    ocrText = ret.data.text;
    await worker.terminate();

  } catch (error) {
    console.error('Lỗi khi xử lý ảnh CCCD:', error);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }

  return {
    qr: {
      rawPayload,
      parsed,
      success: Boolean(rawPayload),
      decoder: { name: 'jsQR', version: '1.4.0' },
    },
    ocr: { rawText: ocrText, engine: 'tesseract.js@7' },
  };
}
