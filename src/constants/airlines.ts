// src/constants/airlines.ts

interface Airline {
  code: string; // IATA code (e.g., "UA")
  name: string; // Full airline name (e.g., "United Airlines")
  country?: string;
}

// --------------------------------------
// Primary Mapping: Code -> Airline
// --------------------------------------

export const AIRLINES_BY_CODE: Record<string, Airline> = {
  // --- Major U.S. Airlines ---
  UA: { code: "UA", name: "United Airlines", country: "US" },
  DL: { code: "DL", name: "Delta Air Lines", country: "US" },
  AA: { code: "AA", name: "American Airlines", country: "US" },
  WN: { code: "WN", name: "Southwest Airlines", country: "US" },
  AS: { code: "AS", name: "Alaska Airlines", country: "US" },
  B6: { code: "B6", name: "JetBlue Airways", country: "US" },
  NK: { code: "NK", name: "Spirit Airlines", country: "US" },
  F9: { code: "F9", name: "Frontier Airlines", country: "US" },
  HA: { code: "HA", name: "Hawaiian Airlines", country: "US" },

  // --- Canada ---
  AC: { code: "AC", name: "Air Canada", country: "CA" },
  WS: { code: "WS", name: "WestJet", country: "CA" },

  // --- Europe ---
  BA: { code: "BA", name: "British Airways", country: "UK" },
  AF: { code: "AF", name: "Air France", country: "FR" },
  LH: { code: "LH", name: "Lufthansa", country: "DE" },
  KL: { code: "KL", name: "KLM Royal Dutch Airlines", country: "NL" },
  IB: { code: "IB", name: "Iberia", country: "ES" },
  LX: { code: "LX", name: "SWISS International Air Lines", country: "CH" },
  AZ: { code: "AZ", name: "ITA Airways", country: "IT" },
  EI: { code: "EI", name: "Aer Lingus", country: "IE" },
  SK: { code: "SK", name: "Scandinavian Airlines", country: "SE" },

  // --- Middle East ---
  EK: { code: "EK", name: "Emirates", country: "AE" },
  QR: { code: "QR", name: "Qatar Airways", country: "QA" },
  EY: { code: "EY", name: "Etihad Airways", country: "AE" },
  TK: { code: "TK", name: "Turkish Airlines", country: "TR" },

  // --- Asia-Pacific ---
  NH: { code: "NH", name: "All Nippon Airways (ANA)", country: "JP" },
  JL: { code: "JL", name: "Japan Airlines", country: "JP" },
  SQ: { code: "SQ", name: "Singapore Airlines", country: "SG" },
  CX: { code: "CX", name: "Cathay Pacific", country: "HK" },
  KE: { code: "KE", name: "Korean Air", country: "KR" },
  OZ: { code: "OZ", name: "Asiana Airlines", country: "KR" },
  QF: { code: "QF", name: "Qantas", country: "AU" },

  // --- Latin America ---
  LA: { code: "LA", name: "LATAM Airlines", country: "CL" },
  AV: { code: "AV", name: "Avianca", country: "CO" },
  CM: { code: "CM", name: "Copa Airlines", country: "PA" },

  // --- Budget / Regional International ---
  FR: { code: "FR", name: "Ryanair", country: "IE" },
  U2: { code: "U2", name: "easyJet", country: "UK" },
  VY: { code: "VY", name: "Vueling", country: "ES" },
  DY: { code: "DY", name: "Norwegian Air Shuttle", country: "NO" },
};

// --------------------------------------
// Reverse Mapping: Name -> Airline
// --------------------------------------

const AIRLINES_BY_NAME: Record<string, Airline> = Object.values(
  AIRLINES_BY_CODE
).reduce((acc, airline) => {
  acc[airline.name.toLowerCase()] = airline;
  return acc;
}, {} as Record<string, Airline>);

// --------------------------------------
// Utility Helpers
// --------------------------------------

/**
 * Lookup airline by IATA code.
 */
function getAirlineByCode(code: string): Airline | null {
  if (!code) return null;
  return AIRLINES_BY_CODE[code.trim().toUpperCase()] ?? null;
}

/**
 * Lookup airline by full name (case-insensitive).
 */
function getAirlineByName(name: string): Airline | null {
  if (!name) return null;
  return AIRLINES_BY_NAME[name.trim().toLowerCase()] ?? null;
}

/**
 * Lookup airline by first word of name match (case-insensitive).
 */
function getAirlineByPartialName(name: string): Airline | null {
  if (!name) return null;
  const normalizedInput = name
    .toLowerCase()
    .replace(/\s+air(lines)?$/, "")
    .trim();
  const firstInputWord = normalizedInput.split(/\s+/)[0];
  if (!firstInputWord) return null;

  // Match against the first word of each airline name (case-insensitive).
  // Examples handled:
  // - "KLM Royal" -> matches "KLM Royal Dutch Airlines"
  // - "Southwest air" -> matches "Southwest Airlines"
  // Minimum requirement: the first word must match exactly (so "Kor" or "Luft" won't match).
  const match = Object.values(AIRLINES_BY_CODE).find((airline) => {
    const firstWord = airline.name.toLowerCase().split(/\s+/)[0];
    // Require exact match of the first word (not a prefix).
    return (
      firstWord === firstInputWord && firstWord.length === firstInputWord.length
    );
  });

  return match ?? null;
}

/**
 * Best-effort resolver from either code or name.
 * Useful when parsing user input.
 *
 * Handles:
 * - IATA codes (e.g., "UA", "KL")
 * - Full names (e.g., "United Airlines", "KLM Royal Dutch Airlines")
 * - Partial names (e.g., "KLM" -> "KL", "Southwest" -> "WN")
 */
export function resolveAirline(input: string): Airline | null {
  if (!input) return null;

  const byCode = getAirlineByCode(input);
  if (byCode) return byCode;

  // Try exact name match first
  const byName = getAirlineByName(input);
  if (byName) return byName;

  // Try partial (first-word) name match
  const byPartialName = getAirlineByPartialName(input);
  if (byPartialName) return byPartialName;

  return null;
}

export function listAllAirlines(): Airline[] {
  return Object.values(AIRLINES_BY_CODE).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}
