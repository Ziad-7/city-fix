// Stand-in for `expo-image-manipulator` (aliased in tsconfig.json and vitest.config.ts), which the shared
// apps/mobile/src/services/media.ts loads lazily. Browsers have no manipulator: `manipulate` throws, and
// `compressImage` then keeps the original file (its documented fallback).
export const SaveFormat = { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' } as const;

type Rendered = { width: number; height: number; uri: string; saveAsync: (o: { compress: number; format: string }) => Promise<{ uri: string }> };

type Context = { renderAsync: () => Promise<Rendered>; resize: (size: { width?: number; height?: number }) => Context };

export const ImageManipulator = {
  manipulate(_uri: string): Context {
    throw new Error('expo-image-manipulator is not available in the browser');
  },
};
