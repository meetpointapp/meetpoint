// Faz 25: S3 uyumlu depolama sarmalayıcısı (gerçek bulut gerekmeden, sahte istemciyle)
import { describe, expect, it } from 'vitest';
import { S3Store } from '../../src/storage';

type Sent = { name: string; input: Record<string, unknown> };

function fakeClient(handler?: (cmd: Sent) => unknown) {
  const sent: Sent[] = [];
  const client = {
    send: async (cmd: { constructor: { name: string }; input: Record<string, unknown> }) => {
      const s = { name: cmd.constructor.name, input: cmd.input };
      sent.push(s);
      return handler ? handler(s) : {};
    },
  };
  return { client: client as never, sent };
}

describe('S3Store', () => {
  it('put: kova, anahtar ve içerik türünü gönderir', async () => {
    const { client, sent } = fakeClient();
    await new S3Store(client, 'kova').put('photos/abc-lg.webp', Buffer.from('x'));
    expect(sent[0].name).toBe('PutObjectCommand');
    expect(sent[0].input).toMatchObject({ Bucket: 'kova', Key: 'photos/abc-lg.webp', ContentType: 'image/webp' });
  });

  it('read: içeriği Buffer olarak döner, olmayan anahtar için null', async () => {
    const ok = fakeClient(() => ({ Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } }));
    expect(await new S3Store(ok.client, 'kova').read('a/b.webp')).toEqual(Buffer.from([1, 2, 3]));

    const missing = fakeClient(() => {
      throw Object.assign(new Error('yok'), { name: 'NoSuchKey' });
    });
    expect(await new S3Store(missing.client, 'kova').read('a/b.webp')).toBeNull();

    const broken = fakeClient(() => {
      throw Object.assign(new Error('erişim yok'), { name: 'AccessDenied', $metadata: { httpStatusCode: 403 } });
    });
    await expect(new S3Store(broken.client, 'kova').read('a/b.webp')).rejects.toThrow('erişim yok');
  });

  it('remove: siler; geçersiz anahtar (yol dışına çıkış) reddedilir', async () => {
    const { client, sent } = fakeClient();
    const store = new S3Store(client, 'kova');
    await store.remove('a/b.webp');
    expect(sent[0].name).toBe('DeleteObjectCommand');
    await expect(store.put('../etc/passwd', Buffer.from('x'))).rejects.toThrow('geçersiz dosya anahtarı');
    await expect(store.read('/mutlak')).rejects.toThrow('geçersiz dosya anahtarı');
  });
});
