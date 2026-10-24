/**
 * MediFind Centralized Currency Formatting Utility
 * Standardizes currency formatting across the entire website using Intl.NumberFormat
 * Locale: en-IN, Currency: INR (Indian Rupee - ₹)
 */

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a numeric price into standard Indian Rupee format.
 * Examples:
 *   115    -> "₹115.00"
 *   115.5  -> "₹115.50"
 *   1500   -> "₹1,500.00"
 *   -50    -> "-₹50.00"
 */
export function formatINR(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) {
    return inrFormatter.format(0);
  }
  const numericAmount = typeof amount === "number" ? amount : Number(amount);
  if (isNaN(numericAmount) || !isFinite(numericAmount)) {
    return inrFormatter.format(0);
  }
  return inrFormatter.format(numericAmount);
}

/**
 * The standard Indian Rupee symbol (U+20B9: ₹)
 */
export const RUPEE_SYMBOL = "₹";
