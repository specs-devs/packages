/**
 * SPECS Inc. 2027
 * Helpers for presenting subscription offers. Turns pricing phases (free trials, introductory prices,
 * recurring prices) and their ISO 8601 billing periods ("P1M") into short English labels such as
 * "Free for 1 week, then $4.99 / month".
 */

type PeriodUnit = "Y" | "M" | "W" | "D";

const UNIT_ORDER: PeriodUnit[] = ["Y", "M", "W", "D"];

const UNIT_NAMES: Record<PeriodUnit, [string, string]> = {
  Y: ["year", "years"],
  M: ["month", "months"],
  W: ["week", "weeks"],
  D: ["day", "days"],
};

// Non-zero components of a date-only ISO 8601 duration such as "P1W", "P3M" or "P1Y6M", largest first;
// null for anything else.
function periodParts(period: string): [number, PeriodUnit][] | null {
  const match = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec((period || "").trim().toUpperCase());
  if (!match) {
    return null;
  }
  const parts: [number, PeriodUnit][] = [];
  UNIT_ORDER.forEach((unit, index) => {
    const value = Number(match[index + 1] || 0);
    if (value > 0) {
      parts.push([value, unit]);
    }
  });
  return parts.length > 0 ? parts : null;
}

function formatAmount(value: number, unit: PeriodUnit): string {
  return `${value} ${UNIT_NAMES[unit][value === 1 ? 0 : 1]}`;
}

// For use after a slash: "P1M" -> "month", "P3M" -> "3 months". Unparseable periods are returned as is.
function formatBillingPeriod(period: string): string {
  const parts = periodParts(period);
  if (!parts) {
    return period;
  }
  if (parts.length === 1 && parts[0][0] === 1) {
    return UNIT_NAMES[parts[0][1]][0];
  }
  return parts.map(([value, unit]) => formatAmount(value, unit)).join(" ");
}

// Total length of `cycles` billing periods: ("P1W", 1) -> "1 week", ("P1M", 3) -> "3 months".
function formatDuration(period: string, cycles: number): string {
  const parts = periodParts(period);
  if (!parts) {
    return cycles > 1 ? `${cycles} x ${period}` : period;
  }
  return parts.map(([value, unit]) => formatAmount(value * cycles, unit)).join(" ");
}

function isFreePhase(phase: Commerce.PricingPhase): boolean {
  return !!phase.price && phase.price.price === 0;
}

// "Free for 1 week", "$4.99 / month for 3 months", "$2.99 for 1 month", "$9.99 / month".
function describePricingPhase(phase: Commerce.PricingPhase): string {
  const price = phase.price ? phase.price.displayPrice : "";
  if (phase.recurrenceMode === Commerce.RecurrenceMode.InfiniteRecurring) {
    return `${price} / ${formatBillingPeriod(phase.billingPeriod)}`;
  }
  const cycles =
    phase.recurrenceMode === Commerce.RecurrenceMode.FiniteRecurring && phase.billingCycleCount > 1
      ? phase.billingCycleCount
      : 1;
  if (isFreePhase(phase)) {
    return `Free for ${formatDuration(phase.billingPeriod, cycles)}`;
  }
  if (cycles > 1) {
    return `${price} / ${formatBillingPeriod(phase.billingPeriod)} for ${formatDuration(phase.billingPeriod, cycles)}`;
  }
  return `${price} for ${formatDuration(phase.billingPeriod, 1)}`;
}

/**
 * Returns the free trial phase of an offer, if it has one.
 *
 * @param offer - A subscription offer from `getProductInfo(id).nativeProduct.subscriptionOfferDetails`
 * @returns The first free phase that does not recur forever, or null
 */
export function getFreeTrialPhase(offer: Commerce.SubscriptionOfferDetails): Commerce.PricingPhase | null {
  const phases = offer.pricingPhases || [];
  return (
    phases.find(
      (phase) => isFreePhase(phase) && phase.recurrenceMode !== Commerce.RecurrenceMode.InfiniteRecurring
    ) || null
  );
}

/**
 * Describes all pricing phases of an offer in the order they apply, for example
 * "Free for 1 week, then $4.99 / month" or "$4.99 / month for 3 months, then $9.99 / month". Prices
 * use the service's `displayPrice`; the rest of the label is English.
 *
 * @param offer - A subscription offer from `getProductInfo(id).nativeProduct.subscriptionOfferDetails`
 * @returns The description, or an empty string for an offer without pricing phases
 */
export function describeOffer(offer: Commerce.SubscriptionOfferDetails): string {
  return (offer.pricingPhases || []).map(describePricingPhase).join(", then ");
}
