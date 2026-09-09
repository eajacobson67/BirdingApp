/**
 * Contract tests for the iNaturalist thumbnail lookup. This one is deliberately
 * fail-soft — a missing thumbnail must never break the feed or the map — so the
 * tests pin that behaviour rather than expecting throws.
 */
import { fetchBirdThumbnails } from '../../lib/birdImages';

const OK = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

const taxon = (square: string | null, medium?: string) => ({
  results: [{ default_photo: { square_url: square, medium_url: medium } }],
});

beforeEach(() => {
  global.fetch = jest.fn() as unknown as typeof fetch;
});

describe('fetchBirdThumbnails', () => {
  test('returns a name to url map', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(OK(taxon('https://inat/sq.jpg')));
    const out = await fetchBirdThumbnails(['Cedar Waxwing']);
    expect(out).toEqual({ 'Cedar Waxwing': 'https://inat/sq.jpg' });
  });

  test('falls back to medium_url when square_url is absent', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(OK(taxon(null, 'https://inat/med.jpg')));
    const out = await fetchBirdThumbnails(['Blue Jay']);
    expect(out['Blue Jay']).toBe('https://inat/med.jpg');
  });

  test('deduplicates names before fetching', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(OK(taxon('https://inat/sq.jpg')));
    await fetchBirdThumbnails(['Blue Jay', 'Blue Jay', 'Blue Jay']);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('url-encodes species names containing spaces and punctuation', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(OK(taxon('https://inat/sq.jpg')));
    await fetchBirdThumbnails(["Bachman's Warbler"]);
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('Bachman');
    expect(url).not.toMatch(/ /);
  });

  test('an empty list makes no requests', async () => {
    const out = await fetchBirdThumbnails([]);
    expect(out).toEqual({});
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('a network failure yields no entry rather than rejecting', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));
    await expect(fetchBirdThumbnails(['Cedar Waxwing'])).resolves.toEqual({});
  });

  test('a malformed response yields no entry rather than rejecting', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(OK({ unexpected: true }));
    await expect(fetchBirdThumbnails(['Cedar Waxwing'])).resolves.toEqual({});
  });

  test('an empty results array yields no entry', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(OK({ results: [] }));
    await expect(fetchBirdThumbnails(['Cedar Waxwing'])).resolves.toEqual({});
  });

  test('a photo object with no usable url yields no entry', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(OK({ results: [{ default_photo: {} }] }));
    await expect(fetchBirdThumbnails(['Cedar Waxwing'])).resolves.toEqual({});
  });

  test('one bird failing does not lose the others', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(OK(taxon('https://inat/a.jpg')))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(OK(taxon('https://inat/c.jpg')));

    const out = await fetchBirdThumbnails(['A', 'B', 'C']);
    expect(Object.keys(out).sort()).toEqual(['A', 'C']);
  });
});
