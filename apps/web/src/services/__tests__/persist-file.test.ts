import { afterEach, describe, expect, it, vi } from 'vitest';
import { useOutbox } from '@/store/useOutbox';
import { MAX_QUEUED_DATA_URI_CHARS, persistLocalFile } from '../persistFile';

const stubBlob = (size: number) =>
  vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => new Blob([new Uint8Array(size)]) })));

describe('persistLocalFile (web)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useOutbox.setState({ items: [] });
  });

  it('turns a small blob photo into a data URI', async () => {
    stubBlob(1000);
    expect(await persistLocalFile('blob:http://x/1')).toMatch(/^data:/);
  });

  it('keeps the blob URL for a photo over the single-file cap and for server paths', async () => {
    stubBlob(500_000);
    expect(await persistLocalFile('blob:http://x/2')).toBe('blob:http://x/2');
    expect(await persistLocalFile('reports/a.jpg')).toBe('reports/a.jpg');
  });

  it('keeps the blob URL once the queue already holds too many data URIs', async () => {
    useOutbox.setState({
      items: [{ id: 'Q-1', userId: 'u', createdAt: '', attempts: 0, input: { photoUris: ['data:image/jpeg;base64,' + 'A'.repeat(MAX_QUEUED_DATA_URI_CHARS)] } } as never],
    });
    stubBlob(1000);
    expect(await persistLocalFile('blob:http://x/3')).toBe('blob:http://x/3');
  });
});
