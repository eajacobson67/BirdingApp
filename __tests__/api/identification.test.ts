/**
 * Contract tests for the two identification services. These pin the response
 * shape the app depends on, so a breaking change upstream fails here instead of
 * silently producing "Unknown" birds or crashing the log flow.
 */
import { identifyFromAudio, identifyFromLocalUri } from '../../lib/birdnet';
import { identifyFromImage } from '../../lib/birdvision';

const getIdToken = jest.fn();
jest.mock('../../lib/firebase', () => ({
  db: {},
  storage: {},
  auth: { get currentUser() { return (global as any).__mockUser; } },
}));

const OK = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

beforeEach(() => {
  getIdToken.mockReset().mockResolvedValue('fake-token');
  (global as any).__mockUser = { getIdToken };
  global.fetch = jest.fn() as unknown as typeof fetch;
});

afterEach(() => {
  delete (global as any).__mockUser;
});

describe('identifyFromAudio', () => {
  test('maps a well-formed response to results', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      OK({
        results: [
          { common_name: 'Cedar Waxwing', scientific_name: 'Bombycilla cedrorum', confidence: 0.91 },
          { common_name: 'Blue Jay', scientific_name: 'Cyanocitta cristata', confidence: 0.44 },
        ],
      }),
    );

    const out = await identifyFromAudio('https://x/a.m4a', 40, -74, '2026-01-01');
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      commonName: 'Cedar Waxwing',
      scientificName: 'Bombycilla cedrorum',
      confidence: 0.91,
    });
  });

  test('sends the auth token and the expected payload', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(OK({ results: [] }));
    await identifyFromAudio('https://x/a.m4a', 40.5, -74.5, '2026-03-04');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer fake-token');
    const body = JSON.parse(init.body);
    // The API takes `lon`, while the app speaks `lng` everywhere else.
    expect(body).toMatchObject({ url: 'https://x/a.m4a', lat: 40.5, lon: -74.5, date: '2026-03-04' });
  });

  test('an empty results array is valid and yields no identifications', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(OK({ results: [] }));
    await expect(identifyFromAudio('https://x/a.m4a', 40, -74, '2026-01-01')).resolves.toEqual([]);
  });

  test('missing fields fall back rather than producing undefined', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(OK({ results: [{}] }));
    const out = await identifyFromAudio('https://x/a.m4a', 40, -74, '2026-01-01');
    expect(out[0]).toEqual({ commonName: 'Unknown', scientificName: '', confidence: 0 });
  });

  test('throws a descriptive error on a non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'service unavailable',
      json: async () => ({}),
    });
    await expect(identifyFromAudio('https://x/a.m4a', 40, -74, '2026-01-01')).rejects.toThrow(
      /BirdNET 503/,
    );
  });

  /**
   * REGRESSION: the endpoint returning an error object instead of {results:[...]}
   * used to throw "Cannot read properties of undefined (reading 'map')", which
   * says nothing about what actually broke.
   */
  test('a response missing the results array fails legibly', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(OK({ error: 'model unavailable' }));
    await expect(identifyFromAudio('https://x/a.m4a', 40, -74, '2026-01-01')).rejects.toThrow(
      /unexpected response shape/,
    );
  });

  test('results being an object rather than an array fails legibly', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(OK({ results: { a: 1 } }));
    await expect(identifyFromAudio('https://x/a.m4a', 40, -74, '2026-01-01')).rejects.toThrow(
      /unexpected response shape/,
    );
  });

  test('requires authentication before calling the API', async () => {
    (global as any).__mockUser = undefined;
    await expect(identifyFromAudio('https://x/a.m4a', 40, -74, '2026-01-01')).rejects.toThrow(
      'Not authenticated',
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('propagates a network failure', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network request failed'));
    await expect(identifyFromAudio('https://x/a.m4a', 40, -74, '2026-01-01')).rejects.toThrow(
      /Network request failed/,
    );
  });
});

describe('identifyFromLocalUri', () => {
  test('uploads multipart form data with the expected fields', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(OK({ results: [] }));
    await identifyFromLocalUri('file:///tmp/a.m4a', 12, 34, '2026-05-06');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers.Authorization).toBe('Bearer fake-token');
    // Content-Type must be left unset so the runtime adds the multipart boundary.
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  test('fails legibly on a malformed response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(OK({}));
    await expect(identifyFromLocalUri('file:///tmp/a.m4a', 12, 34, '2026-05-06')).rejects.toThrow(
      /unexpected response shape/,
    );
  });
});

describe('identifyFromImage', () => {
  test('maps a well-formed response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      OK({ results: [{ common_name: 'American Robin', scientific_name: 'Turdus migratorius', confidence: 0.8 }] }),
    );
    const out = await identifyFromImage('file:///tmp/p.jpg', 1, 2, '2026-01-01');
    expect(out[0].commonName).toBe('American Robin');
  });

  test('throws a descriptive error on a non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
      json: async () => ({}),
    });
    await expect(identifyFromImage('file:///tmp/p.jpg', 1, 2, '2026-01-01')).rejects.toThrow(
      /BirdVision 500/,
    );
  });

  test('fails legibly on a malformed response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(OK({ predictions: [] }));
    await expect(identifyFromImage('file:///tmp/p.jpg', 1, 2, '2026-01-01')).rejects.toThrow(
      /unexpected response shape/,
    );
  });

  test('requires authentication', async () => {
    (global as any).__mockUser = undefined;
    await expect(identifyFromImage('file:///tmp/p.jpg', 1, 2, '2026-01-01')).rejects.toThrow(
      'Not authenticated',
    );
  });
});
