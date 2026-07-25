import { rgbToHsl, isBlueColor } from '../lib/photo/validator';

describe('Photo 4x6 Validator - Color Logic', () => {
  it('converts RGB to HSL correctly', () => {
    // Red
    const [h1, s1, l1] = rgbToHsl(255, 0, 0);
    expect(h1).toBe(0);
    expect(s1).toBe(100);
    expect(l1).toBe(50);

    // Blue
    const [h2, s2, l2] = rgbToHsl(0, 0, 255);
    expect(h2).toBe(240);
    expect(s2).toBe(100);
    expect(l2).toBe(50);
  });

  it('identifies blue color for background', () => {
    // Pure blue
    expect(isBlueColor(0, 0, 255)).toBe(true);
    // Light blue
    expect(isBlueColor(135, 206, 235)).toBe(true);
    // Dark blue
    expect(isBlueColor(0, 0, 139)).toBe(true);
    
    // Red
    expect(isBlueColor(255, 0, 0)).toBe(false);
    // White
    expect(isBlueColor(255, 255, 255)).toBe(false);
    // Black
    expect(isBlueColor(0, 0, 0)).toBe(false);
    // Gray
    expect(isBlueColor(128, 128, 128)).toBe(false);
  });
});
