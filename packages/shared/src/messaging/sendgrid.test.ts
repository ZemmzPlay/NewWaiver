import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSendGridChannel } from './sendgrid.js';

const message = {
  to: 'guardian@example.com',
  subject: 'Your Carnival code is 482 109',
  html: '<p>hi</p>',
  text: 'hi',
  reference: 'notif-123',
};

function mockFetchOnce(response: Partial<Response> & { ok: boolean; status: number }) {
  const fetchMock = vi.fn().mockResolvedValue({
    text: async () => '',
    headers: new Headers(),
    ...response,
  } as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createSendGridChannel', () => {
  it('sends to the v3 mail/send endpoint with the API key, the message, and a correlation reference', async () => {
    const fetchMock = mockFetchOnce({
      ok: true, status: 202, headers: new Headers({ 'x-message-id': 'sg-msg-1' }),
    });
    const channel = createSendGridChannel({ apiKey: 'sg-key', from: 'Carnival <no-reply@thecarnival.ae>' });

    const result = await channel.send(message);

    expect(result).toEqual({ ok: true, providerMessageId: 'sg-msg-1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.sendgrid.com/v3/mail/send');
    expect(init.headers.Authorization).toBe('Bearer sg-key');
    const body = JSON.parse(init.body);
    expect(body.personalizations).toEqual([{ to: [{ email: message.to }] }]);
    expect(body.from).toEqual({ email: 'no-reply@thecarnival.ae', name: 'Carnival' });
    expect(body.custom_args).toEqual({ reference: 'notif-123' });
    expect(body.content).toEqual([
      { type: 'text/plain', value: message.text },
      { type: 'text/html', value: message.html },
    ]);
  });

  it('falls back to "unknown" providerMessageId when SendGrid omits the header', async () => {
    mockFetchOnce({ ok: true, status: 202, headers: new Headers() });
    const channel = createSendGridChannel({ apiKey: 'sg-key', from: 'no-reply@thecarnival.ae' });

    const result = await channel.send(message);

    expect(result).toEqual({ ok: true, providerMessageId: 'unknown' });
  });

  it('parses a bare email with no display name', async () => {
    const fetchMock = mockFetchOnce({ ok: true, status: 202, headers: new Headers({ 'x-message-id': 'x' }) });
    const channel = createSendGridChannel({ apiKey: 'sg-key', from: 'no-reply@thecarnival.ae' });

    await channel.send(message);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.from).toEqual({ email: 'no-reply@thecarnival.ae' });
  });

  it('treats a 429 as retryable', async () => {
    mockFetchOnce({ ok: false, status: 429, text: async () => 'rate limited' });
    const channel = createSendGridChannel({ apiKey: 'sg-key', from: 'no-reply@thecarnival.ae' });

    const result = await channel.send(message);

    expect(result).toEqual({ ok: false, error: 'HTTP 429: rate limited', retryable: true });
  });

  it('treats a 5xx as retryable', async () => {
    mockFetchOnce({ ok: false, status: 503, text: async () => 'down' });
    const channel = createSendGridChannel({ apiKey: 'sg-key', from: 'no-reply@thecarnival.ae' });

    const result = await channel.send(message);

    expect(result.ok).toBe(false);
    expect((result as { retryable: boolean }).retryable).toBe(true);
  });

  it('treats a 4xx other than 429 as non-retryable — a bad address, not a bad moment', async () => {
    mockFetchOnce({ ok: false, status: 400, text: async () => 'invalid to address' });
    const channel = createSendGridChannel({ apiKey: 'sg-key', from: 'no-reply@thecarnival.ae' });

    const result = await channel.send(message);

    expect(result).toEqual({ ok: false, error: 'HTTP 400: invalid to address', retryable: false });
  });

  it('treats a network failure as retryable rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch failed')));
    const channel = createSendGridChannel({ apiKey: 'sg-key', from: 'no-reply@thecarnival.ae' });

    const result = await channel.send(message);

    expect(result).toEqual({ ok: false, error: 'fetch failed', retryable: true });
  });

  it('reports its name as "sendgrid"', () => {
    const channel = createSendGridChannel({ apiKey: 'sg-key', from: 'no-reply@thecarnival.ae' });
    expect(channel.name).toBe('sendgrid');
  });
});
