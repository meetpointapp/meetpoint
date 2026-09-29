import { describe, expect, it } from 'vitest';
import { ALL_MILESTONES, TRACK_MILESTONES, TRACKS, tierIndexOf, trackOf, tracksState, MILESTONE_REWARD } from '../../src/achievements';

describe('Sosyal cesaret yolculuğu — kademe hesaplama (Faz 17)', () => {
  it('her iz tam olarak 3 kademe taşır (bronz/gümüş/altın)', () => {
    for (const t of TRACKS) expect(TRACK_MILESTONES[t]).toHaveLength(3);
  });

  it('9 kademenin hepsinin benzersiz bir ödülü var', () => {
    expect(ALL_MILESTONES).toHaveLength(9);
    const rewards = ALL_MILESTONES.map((m) => MILESTONE_REWARD[m]);
    expect(new Set(rewards).size).toBe(9);
  });

  it('trackOf ve tierIndexOf doğru izi/sırayı döner', () => {
    expect(trackOf('first_message')).toBe('iletisim');
    expect(tierIndexOf('first_message')).toBe(1); // bronz
    expect(tierIndexOf('week_long_chat')).toBe(2); // gümüş
    expect(tierIndexOf('first_icebreaker')).toBe(3); // altın
    expect(trackOf('first_match')).toBe('baglanti');
    expect(trackOf('vibe_done')).toBe('kimlik');
  });

  it('tracksState: hiçbir kademe yoksa hepsi 0, sırayla tamamlanınca tier artar', () => {
    const empty = tracksState([]);
    expect(empty.iletisim.tier).toBe(0);
    expect(empty.iletisim.milestones.every((m) => !m.done)).toBe(true);

    const s = tracksState(['first_message', 'first_match']);
    expect(s.iletisim.tier).toBe(1);
    expect(s.iletisim.milestones[0]).toEqual({ id: 'first_message', done: true });
    expect(s.iletisim.milestones[1]).toEqual({ id: 'week_long_chat', done: false });
    expect(s.baglanti.tier).toBe(1);
    expect(s.kimlik.tier).toBe(0);
  });

  it('tracksState: bir izin tamamı bitince tier 3 (altın)', () => {
    const s = tracksState(['profile_complete', 'verified', 'vibe_done']);
    expect(s.kimlik.tier).toBe(3);
    expect(s.kimlik.milestones.every((m) => m.done)).toBe(true);
  });
});
