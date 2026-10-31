import { describe, expect, it } from 'vitest';
import { FRESH_OPENING_MS, OpeningClock, REOPENING_AWAY_MS } from '../src/core/pwa/updatePolicy';

describe('OpeningClock', () => {
  it('autorise le rechargement juste après une ouverture, puis plus du tout', () => {
    const clock = new OpeningClock(1_000);
    expect(clock.isFresh(1_000 + FRESH_OPENING_MS - 1)).toBe(true);
    expect(clock.isFresh(1_000 + FRESH_OPENING_MS)).toBe(false);
  });

  it('ne compte pas une courte absence comme une ouverture', () => {
    const clock = new OpeningClock(0);
    const later = FRESH_OPENING_MS * 2;
    clock.hidden(later);
    expect(clock.visible(later + REOPENING_AWAY_MS - 1)).toBe(false);
    expect(clock.isFresh(later + REOPENING_AWAY_MS)).toBe(false);
  });

  it('compte un retour après une longue absence comme une ouverture', () => {
    const clock = new OpeningClock(0);
    clock.hidden(100);
    const back = 100 + REOPENING_AWAY_MS;
    expect(clock.visible(back)).toBe(true);
    expect(clock.isFresh(back + 1)).toBe(true);
    expect(clock.isFresh(back + FRESH_OPENING_MS)).toBe(false);
  });

  it("garde le début de l'absence si l'événement « masqué » se répète", () => {
    const clock = new OpeningClock(0);
    clock.hidden(100);
    clock.hidden(REOPENING_AWAY_MS);
    expect(clock.visible(100 + REOPENING_AWAY_MS)).toBe(true);
  });

  it('ignore un retour sans absence connue', () => {
    expect(new OpeningClock(0).visible(REOPENING_AWAY_MS * 2)).toBe(false);
  });
});
