import { PricingRule } from '../models/PricingRule';

/**
 * Determines if a given date string (YYYY-MM-DD) falls on a weekend.
 */
export const isWeekend = (dateStr: string): boolean => {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay();
  return day === 0 || day === 5 || day === 6; // Sunday = 0, Friday = 5, Saturday = 6
};

/**
 * Calculates the price for a given slot based on dynamic pricing rules.
 * Falls back to hardcoded defaults if no rules exist in DB.
 */
export const getSlotPrice = async (dateStr: string, hour: number, turfId: string): Promise<number> => {
  const weekend = isWeekend(dateStr);
  const dayType = weekend ? 'weekend' : 'weekday';

  // Try to find a matching active pricing rule
  const rules = await PricingRule.find({ dayType, isActive: true, turfId });

  if (rules.length > 0) {
    for (const rule of rules) {
      if (rule.startHour <= rule.endHour) {
        // Normal range (e.g., 6-18)
        if (hour >= rule.startHour && hour < rule.endHour) {
          return rule.price;
        }
      } else {
        // Wrapping range (e.g., 18-6 means 18-23 and 0-5)
        if (hour >= rule.startHour || hour < rule.endHour) {
          return rule.price;
        }
      }
    }
  }

  // Default pricing fallback if no DB rules match
  const isDaytime = hour >= 6 && hour < 18;

  if (turfId === 'A') {
    if (weekend) return isDaytime ? 900 : 1000;
    else return isDaytime ? 800 : 700;
  } else {
    // Turf B
    if (weekend) return isDaytime ? 900 : 1000;
    else return isDaytime ? 900 : 800;
  }
};

/**
 * Returns prices for all 24 hours of a given date and turf.
 */
export const getAllSlotPrices = async (dateStr: string, turfId: string): Promise<Map<number, number>> => {
  const weekend = isWeekend(dateStr);
  const dayType = weekend ? 'weekend' : 'weekday';

  // Fetch all active rules for this turf and dayType once
  const rules = await PricingRule.find({ dayType, isActive: true, turfId }).lean();
  
  const prices = new Map<number, number>();
  
  for (let hour = 0; hour < 24; hour++) {
    let matchedPrice: number | null = null;

    if (rules.length > 0) {
      for (const rule of rules) {
        if (rule.startHour <= rule.endHour) {
          if (hour >= rule.startHour && hour < rule.endHour) {
            matchedPrice = rule.price;
            break;
          }
        } else {
          if (hour >= rule.startHour || hour < rule.endHour) {
            matchedPrice = rule.price;
            break;
          }
        }
      }
    }

    if (matchedPrice !== null) {
      prices.set(hour, matchedPrice);
    } else {
      // Fallback
      const isDaytime = hour >= 6 && hour < 18;
      if (turfId === 'A') {
        prices.set(hour, weekend ? (isDaytime ? 900 : 1000) : (isDaytime ? 800 : 700));
      } else {
        prices.set(hour, weekend ? (isDaytime ? 900 : 1000) : (isDaytime ? 900 : 800));
      }
    }
  }
  
  return prices;
};
