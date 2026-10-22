import type { NewReportInput } from '@/domain/types';
import { ApiError } from '../api/http';
import { classifyFailure, fitWithin, needsUpload, prepareReportInput, prepareTriagePhoto, voiceContentType } from '../media';

describe('fitWithin', () => {
  it('keeps small images as they are', () => {
    expect(fitWithin(1200, 800)).toBeNull();
    expect(fitWithin(1600, 1600)).toBeNull();
  });
  it('scales by the long side and keeps the aspect ratio', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(3200, 3200)).toEqual({ width: 1600, height: 1600 });
  });
  it('ignores bad sizes', () => {
    expect(fitWithin(0, 100)).toBeNull();
    expect(fitWithin(NaN, 100)).toBeNull();
  });
});

describe('needsUpload', () => {
  it('uploads device-local files only', () => {
    expect(needsUpload('file:///data/user/0/cache/a.jpg')).toBe(true);
    expect(needsUpload('blob:http://localhost/1234')).toBe(true);
    expect(needsUpload('content://media/1')).toBe(true);
    expect(needsUpload('reports/2026/a.jpg')).toBe(false);
    expect(needsUpload('https://cdn.example.com/a.jpg')).toBe(false);
    expect(needsUpload(undefined)).toBe(false);
    expect(needsUpload('')).toBe(false);
  });
});

describe('voiceContentType', () => {
  it('maps extensions', () => {
    expect(voiceContentType('file:///a.m4a')).toBe('audio/mp4');
    expect(voiceContentType('file:///a.3gp')).toBe('audio/3gpp');
    expect(voiceContentType('blob:x/y')).toBe('audio/mp4');
    expect(voiceContentType('file:///a.webm')).toBe('audio/webm');
  });
});

describe('classifyFailure', () => {
  it('retries connectivity and server trouble, drops validation errors', () => {
    expect(classifyFailure(new ApiError(0, 'x'))).toBe('retry');
    expect(classifyFailure(new ApiError(503, 'x'))).toBe('retry');
    expect(classifyFailure(new ApiError(429, 'x'))).toBe('retry');
    expect(classifyFailure(new ApiError(422, 'x'))).toBe('drop');
    expect(classifyFailure(new ApiError(404, 'x'))).toBe('drop');
    expect(classifyFailure(new ApiError(401, 'x'))).toBe('auth');
    expect(classifyFailure(new TypeError('Network request failed'))).toBe('retry');
    expect(classifyFailure(new Error('boom'))).toBe('drop');
  });
});

describe('prepareReportInput', () => {
  const base: NewReportInput = {
    categoryId: 'pothole',
    description: 'حفرة كبيرة',
    photoUris: [],
    location: { lat: 30, lng: 31, address: 'x' },
    anonymous: false,
    blurFaces: true,
  };

  it('uploads local photos and the voice note, leaves paths alone', async () => {
    const upload = jest.fn(async (uri: string, kind: string) => `${kind}/${uri.split('/').pop()}`);
    const out = await prepareReportInput(
      { ...base, photoUris: ['file:///cache/a.jpg', 'already/uploaded.jpg'], voiceNoteUri: 'file:///cache/v.m4a' },
      upload,
    );
    expect(out.photoUris).toEqual(['report_photo/a.jpg', 'already/uploaded.jpg']);
    expect(out.voiceNoteUri).toBe('voice_note/v.m4a');
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenCalledWith(expect.any(String), 'report_photo', 'image/jpeg');
    expect(upload).toHaveBeenCalledWith('file:///cache/v.m4a', 'voice_note', 'audio/mp4');
  });

  it('does not upload twice when called again on a prepared input', async () => {
    const upload = jest.fn(async () => 'p/1.jpg');
    const once = await prepareReportInput({ ...base, photoUris: ['file:///a.jpg'] }, upload);
    await prepareReportInput(once, upload);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('propagates upload failures', async () => {
    const upload = jest.fn().mockRejectedValue(new ApiError(0, 'net'));
    await expect(prepareReportInput({ ...base, photoUris: ['file:///a.jpg'] }, upload)).rejects.toMatchObject({ status: 0 });
  });
});

describe('prepareTriagePhoto', () => {
  it('does not upload a photo without explicit consent', async () => {
    const upload = jest.fn(async () => 'reports/photo.jpg');
    await expect(prepareTriagePhoto('file:///cache/photo.jpg', false, upload)).resolves.toEqual({ photoConsent: false });
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads a local photo before analysis when consent is given', async () => {
    const upload = jest.fn(async () => 'reports/photo.jpg');
    await expect(prepareTriagePhoto('file:///cache/photo.jpg', true, upload)).resolves.toEqual({
      photoUri: 'reports/photo.jpg',
      photoConsent: true,
    });
    expect(upload).toHaveBeenCalledWith(expect.any(String), 'report_photo', 'image/jpeg');
  });

  it('passes through an uploaded storage path only when consent is given', async () => {
    const upload = jest.fn(async () => 'unused');
    await expect(prepareTriagePhoto('reports/photo.jpg', true, upload)).resolves.toEqual({
      photoUri: 'reports/photo.jpg',
      photoConsent: true,
    });
    expect(upload).not.toHaveBeenCalled();
  });
});
