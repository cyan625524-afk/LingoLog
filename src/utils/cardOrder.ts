import { FlashCard } from '../types';

/**
 * Generates a mapping of card ID to its 1-based chronological index (正序, oldest to newest)
 * based on the card's `createdAt` timestamp.
 * 
 * The 1st card added in time is No.001.
 * The 96th card added in time is No.096.
 */
export function getCardChronologicalMap(cards: FlashCard[]): Map<string, number> {
  if (!cards || cards.length === 0) {
    return new Map();
  }

  // Sort ascending: oldest createdAt first (earliest added = 1, latest added = N)
  const sorted = [...cards].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    // Stable tie-breaker if timestamps are identical
    return (a.id || '').localeCompare(b.id || '');
  });

  const map = new Map<string, number>();
  sorted.forEach((card, index) => {
    map.set(card.id, index + 1);
  });

  return map;
}

/**
 * Formats a 1-based chronological number into standard telegram serial string:
 * e.g., 1 -> "No.001", 96 -> "No.096", 97 -> "No.097", 1024 -> "No.1024"
 */
export function formatCardNumber(order: number | undefined | null, fallback = 1): string {
  const num = typeof order === 'number' && !isNaN(order) && order > 0 ? order : fallback;
  return `No.${String(num).padStart(3, '0')}`;
}

/**
 * Calculates the drafting serial number for the study drafting sheet.
 * e.g., if 96 cards already exist and currently drafting a new one, returns "No.097".
 */
export function getDraftCardNumber(existingCardsCount: number, isSaved = false): string {
  const count = Math.max(0, existingCardsCount);
  const order = isSaved ? Math.max(1, count) : count + 1;
  return formatCardNumber(order);
}
