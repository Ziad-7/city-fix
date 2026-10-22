import type { NewReportInput } from '@/domain/types';
import { sweepOrphanedFiles } from '@/services/persistFile';
import { useOutbox } from '../useOutbox';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  deleteAsync: jest.fn(async () => undefined),
  readDirectoryAsync: jest.fn(async () => ['keep.jpg', 'orphan.jpg']),
  makeDirectoryAsync: jest.fn(async () => undefined),
  copyAsync: jest.fn(async () => undefined),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockFs = require('expo-file-system/legacy') as { deleteAsync: jest.Mock };

const base: NewReportInput = {
  categoryId: 'pothole',
  description: 'حفرة',
  photoUris: ['file:///docs/outbox/a.jpg', 'file:///cache/other.jpg'],
  voiceNoteUri: 'file:///docs/outbox/v.m4a',
  location: { lat: 30, lng: 31, address: 'x' },
  anonymous: false,
  blurFaces: true,
};
const flush = () => new Promise((r) => setTimeout(r, 50));

describe('outbox file cleanup', () => {
  beforeEach(() => {
    mockFs.deleteAsync.mockClear();
    useOutbox.setState({ items: [], notice: null });
  });

  it('removing a queued report deletes its outbox copies only', async () => {
    const item = useOutbox.getState().enqueue('u', base);
    useOutbox.getState().remove(item.id);
    await flush();
    const deleted = mockFs.deleteAsync.mock.calls.map((c) => (c as unknown[])[0]);
    expect(deleted).toEqual(['file:///docs/outbox/a.jpg', 'file:///docs/outbox/v.m4a']);
  });

  it('deletes a copy once the upload replaced it with a server path', async () => {
    const item = useOutbox.getState().enqueue('u', base);
    useOutbox.getState().update(item.id, { input: { ...base, photoUris: ['reports/a.jpg', 'file:///cache/other.jpg'] } });
    await flush();
    expect(mockFs.deleteAsync.mock.calls.map((c) => (c as unknown[])[0])).toEqual(['file:///docs/outbox/a.jpg']);
  });

  it('the startup sweep deletes unreferenced files', async () => {
    await sweepOrphanedFiles(['file:///docs/outbox/keep.jpg']);
    expect(mockFs.deleteAsync.mock.calls.map((c) => (c as unknown[])[0])).toEqual(['file:///docs/outbox/orphan.jpg']);
  });
});
