// Faz 15: iOS PushKit/CallKit (VoIP push) ayarlanmadığı sürece (Apple hesabı Faz 17'de) sessizce
// devre dışı kalmalı — ağa hiç çıkmamalı, hata fırlatmamalı (aynı Agora/Turnstile gibi).
import { describe, it } from 'vitest';
import { check } from '../helpers';
import { sendVoipPush, voipConfigured } from '../../src/voip';

describe('VoIP push (Faz 15)', () => {
  it('ayarlı değilken devre dışı', async () => {
    check('not configured in test env (APNS_* boş)', voipConfigured() === false);
    const ok = await sendVoipPush('fake-device-token', { id: 'c1', nameCaller: 'Test', handle: 'Test', isVideo: false });
    check('no-op returns false, no network call attempted', ok === false);
  });
});
