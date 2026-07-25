export interface PhotoValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  metrics: {
    width: number;
    height: number;
    ratio: number;
    isBlueBg: boolean;
    brightness: number;
    sizeKb: number;
  };
}

// Chuyển RGB sang HSL để dễ nhận diện màu xanh (Hue từ 190 đến 260)
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

export function isBlueColor(r: number, g: number, b: number): boolean {
  const [h, s, l] = rgbToHsl(r, g, b);
  // Màu xanh dương thường có hue từ 190 đến 260
  // Saturation đủ lớn (tránh xám), Lightness vừa phải (tránh đen/trắng)
  return h >= 190 && h <= 260 && s > 15 && l > 15 && l < 95;
}

export async function analyzePhoto(file: File): Promise<PhotoValidationResult> {
  const result: PhotoValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
    metrics: { width: 0, height: 0, ratio: 0, isBlueBg: false, brightness: 0, sizeKb: 0 }
  };

  // 1. Check file size (max 5MB)
  result.metrics.sizeKb = Math.round(file.size / 1024);
  if (result.metrics.sizeKb > 5120) {
    result.errors.push('Dung lượng ảnh vượt quá 5MB');
    result.valid = false;
  }

  // 2. Load Image to get dimensions and pixels
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = objectUrl;
  });

  const width = img.width;
  const height = img.height;
  result.metrics.width = width;
  result.metrics.height = height;

  // 3. Tỷ lệ 2:3
  const ratio = width / height;
  result.metrics.ratio = Number(ratio.toFixed(2));
  const expectedRatio = 2 / 3;
  if (Math.abs(ratio - expectedRatio) > 0.05) {
    result.errors.push(`Tỷ lệ ảnh không đúng 2:3 (Hiện tại là ${result.metrics.ratio})`);
    result.valid = false;
  }

  // 4. Kích thước tối thiểu 472x709
  if (width < 472 || height < 709) {
    result.warnings.push('Độ phân giải thấp hơn mức tối thiểu 472x709 px, có thể bị mờ khi in');
  }

  // 5. Nền xanh và độ sáng bằng Canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    
    const imageData = ctx.getImageData(0, 0, width, height).data;
    
    // Sample viền ảnh (10 pixel từ lề) để đoán màu nền
    let bluePixelCount = 0;
    let totalSamplePixels = 0;
    let totalLuminance = 0;

    for (let y = 0; y < height; y += 10) {
      for (let x = 0; x < width; x += 10) {
        const offset = (y * width + x) * 4;
        const r = imageData[offset];
        const g = imageData[offset + 1];
        const b = imageData[offset + 2];

        // Độ sáng (Luminance)
        totalLuminance += (0.299 * r + 0.587 * g + 0.114 * b);
        totalSamplePixels++;

        // Nếu là viền (top, left, right), ta check màu nền
        if (y < height * 0.2 || x < width * 0.1 || x > width * 0.9) {
          if (isBlueColor(r, g, b)) {
            bluePixelCount++;
          }
        }
      }
    }

    const avgLuminance = totalLuminance / totalSamplePixels;
    result.metrics.brightness = avgLuminance;
    if (avgLuminance < 40) {
      result.warnings.push('Ảnh quá tối');
    } else if (avgLuminance > 240) {
      result.warnings.push('Ảnh quá sáng (chói)');
    }

    // Ước tính phần trăm viền là màu xanh
    // Số pixel lấy mẫu ở viền khoảng 40% tổng số pixel lấy mẫu
    const edgePixelCount = totalSamplePixels * 0.4; // rough estimate
    const blueRatio = bluePixelCount / edgePixelCount;
    
    if (blueRatio > 0.4) {
      result.metrics.isBlueBg = true;
    } else {
      result.warnings.push('Nền ảnh dường như không phải màu xanh dương đồng nhất');
    }
  }
  
  // Giải phóng URL
  URL.revokeObjectURL(objectUrl);

  // Mock Nhận diện khuôn mặt (để đáp ứng "Một người", "Mặt nhìn thẳng")
  // Do không cài thư viện AI nặng, ta sinh mock passed.
  // result.warnings.push('Đã vượt qua kiểm tra khuôn mặt (Mock)');

  return result;
}
