/**
 * A steady riser is a 30-day signal, so once a card qualifies it stays on the
 * list for weeks even when its price stopped moving (Shelter from the Storm:
 * $347.00 from 11-16 on, listed every run). steadyRiserNews tells the page
 * which rows are news — new to the list, or the price moved since the last run
 * — and, for repeats, how long they've been listed and since when they're flat.
 *
 * "Runs" are the distinct as_of_dates the pipeline wrote, newest first, so a
 * night the pipeline skipped doesn't break a streak.
 */
import { describe, it, expect } from 'vitest';
import { steadyRiserNews } from './steady-riser-news';

const RUNS = ['2026-11-25', '2026-11-24', '2026-11-23', '2026-11-22'];
const row = (printingId: string, asOfDate: string, pAtSignal: number) => ({ printingId, asOfDate, pAtSignal });

describe('steadyRiserNews', () => {
  it('a card new to the list today is news', () => {
    const news = steadyRiserNews([row('a', '2026-11-25', 50)], RUNS);
    expect(news.get('a')).toEqual({ streakDays: 1, isNews: true, flatSince: null });
  });

  it('a repeat at the same price is not news: streak length and the date it went flat', () => {
    const news = steadyRiserNews([
      row('s', '2026-11-25', 347), row('s', '2026-11-24', 347), row('s', '2026-11-23', 347), row('s', '2026-11-22', 340),
    ], RUNS);
    expect(news.get('s')).toEqual({ streakDays: 4, isNews: false, flatSince: '2026-11-23' });
  });

  it('a repeat whose price moved 1% or more since the last run is news', () => {
    const news = steadyRiserNews([row('m', '2026-11-25', 60), row('m', '2026-11-24', 55)], RUNS);
    expect(news.get('m')).toEqual({ streakDays: 2, isNews: true, flatSince: null });
  });

  it('a move under 1% counts as flat', () => {
    const news = steadyRiserNews([row('t', '2026-11-25', 100.5), row('t', '2026-11-24', 100)], RUNS);
    expect(news.get('t')?.isNews).toBe(false);
  });

  it('dropping off for a run resets the streak, so coming back is news', () => {
    const news = steadyRiserNews([row('g', '2026-11-25', 20), row('g', '2026-11-23', 20)], RUNS);
    expect(news.get('g')).toEqual({ streakDays: 1, isNews: true, flatSince: null });
  });

  it('only reports cards on the newest run', () => {
    expect(steadyRiserNews([row('old', '2026-11-24', 10)], RUNS).has('old')).toBe(false);
  });
});
