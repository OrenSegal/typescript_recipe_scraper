// supabase/functions/_shared/utils/timeUtils.ts

/*
 * Parses ISO 8601 duration strings, textual descriptions, or numbers into total minutes.
 * @param durationInput The duration string or number.
 * @returns The total duration in minutes, or null if parsing fails.
 */
export function parseDurationToMinutes(
  durationInput: string | number | null | undefined,
): number | null {
    if (durationInput === null || typeof durationInput === 'undefined') return null;
    if (typeof durationInput === 'number') return durationInput > 0 ? Math.round(durationInput) : null;

    const durationStr = String(durationInput).trim();
    if (!durationStr) return null;

    // ISO 8601 Duration Parsing (e.g., PT1H30M)
    const isoMatch = durationStr.match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
    if (isoMatch) {
        const [, years, months, weeks, days, hours, minutes] = isoMatch.map(v => parseInt(v || '0', 10));
        let totalMinutes = 0;
        totalMinutes += (years || 0) * 525600; // approximation
        totalMinutes += (months || 0) * 43800;  // approximation
        totalMinutes += (weeks || 0) * 10080;
        totalMinutes += (days || 0) * 1440;
        totalMinutes += (hours || 0) * 60;
        totalMinutes += minutes || 0;
        return totalMinutes > 0 ? totalMinutes : null;
    }

    // Textual Duration Parsing (e.g., "1 hour 30 minutes")
    let totalFromText = 0;
    const hourMatch = durationStr.match(/(\d+)\s*(?:hours?|hr\b)/i);
    const minMatch = durationStr.match(/(\d+)\s*(?:minutes?|min\b)/i);
    if (hourMatch) totalFromText += parseInt(hourMatch[1] || '0', 10) * 60;
    if (minMatch) totalFromText += parseInt(minMatch[1] || '0', 10);
    if (totalFromText > 0) return totalFromText;

    // Fallback for just a number in a string
    const justNumber = parseInt(durationStr, 10);
    if (!isNaN(justNumber) && justNumber > 0) return justNumber;

    return null;
}