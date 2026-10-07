import { SITE } from '../config.ts';

const formatter = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: SITE.timeZone, ...options });

/** French date and time formats, all in the site's display timezone. */
export const format = {
  /** 5 octobre 2026 */
  dayLong: formatter({ day: 'numeric', month: 'long', year: 'numeric' }),
  /** 5 oct. 2026 */
  dayShort: formatter({ day: 'numeric', month: 'short', year: 'numeric' }),
  /** 5 octobre */
  dayMonth: formatter({ day: 'numeric', month: 'long' }),
  /** 5 oct., 13:20 */
  stamp: formatter({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
  /** 13:20 */
  hour: formatter({ hour: '2-digit', minute: '2-digit' }),
  /** octobre 2026 */
  monthYear: formatter({ month: 'long', year: 'numeric' }),
};

const numericDay = formatter({ year: 'numeric', month: '2-digit', day: '2-digit' });

/** The calendar day of a date, in display time, as a UTC timestamp (fr-FR prints dd/mm/yyyy). */
const calendarDay = (date: Date): number => Date.parse(numericDay.format(date).split('/').reverse().join('-'));

/** Whole calendar days from `earlier` to `later`. 0 means the same day, whatever the hour. */
export const daysBetween = (later: Date, earlier: Date): number =>
  Math.round((calendarDay(later) - calendarDay(earlier)) / 864e5);

export const hoursSince = (now: Date, iso: string): number => (now.getTime() - new Date(iso).getTime()) / 36e5;

export const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** The next scheduled scrape after `now`. */
export function nextRunAfter(now: Date): Date {
  for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
    for (const time of SITE.runTimesUtc) {
      const [hour, minute] = time.split(':').map(Number) as [number, number];
      const run = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, hour, minute));
      if (run > now) return run;
    }
  }
  throw new Error('no scheduled run found'); // unreachable: two days always contain a run
}
