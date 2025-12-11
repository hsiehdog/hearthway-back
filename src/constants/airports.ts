// src/constants/airports.ts

export interface Airport {
  code: string; // IATA code: "SFO"
  name: string; // Full name: "San Francisco International Airport"
  city?: string;
  country?: string;
}

// --------------------------------------
// Primary Mapping: Code -> Airport
// --------------------------------------

export const AIRPORTS_BY_CODE: Record<string, Airport> = {
  // --- United States: Major Hubs ---
  ATL: {
    code: "ATL",
    name: "Hartsfield–Jackson Atlanta International Airport",
    city: "Atlanta",
    country: "US",
  },
  LAX: {
    code: "LAX",
    name: "Los Angeles International Airport",
    city: "Los Angeles",
    country: "US",
  },
  ORD: {
    code: "ORD",
    name: "O'Hare International Airport",
    city: "Chicago",
    country: "US",
  },
  DFW: {
    code: "DFW",
    name: "Dallas/Fort Worth International Airport",
    city: "Dallas–Fort Worth",
    country: "US",
  },
  DEN: {
    code: "DEN",
    name: "Denver International Airport",
    city: "Denver",
    country: "US",
  },
  JFK: {
    code: "JFK",
    name: "John F. Kennedy International Airport",
    city: "New York",
    country: "US",
  },
  EWR: {
    code: "EWR",
    name: "Newark Liberty International Airport",
    city: "Newark",
    country: "US",
  },
  SFO: {
    code: "SFO",
    name: "San Francisco International Airport",
    city: "San Francisco",
    country: "US",
  },
  SEA: {
    code: "SEA",
    name: "Seattle–Tacoma International Airport",
    city: "Seattle",
    country: "US",
  },
  LAS: {
    code: "LAS",
    name: "Harry Reid International Airport",
    city: "Las Vegas",
    country: "US",
  },
  BOS: {
    code: "BOS",
    name: "Logan International Airport",
    city: "Boston",
    country: "US",
  },
  IAH: {
    code: "IAH",
    name: "George Bush Intercontinental Airport",
    city: "Houston",
    country: "US",
  },
  MIA: {
    code: "MIA",
    name: "Miami International Airport",
    city: "Miami",
    country: "US",
  },
  SAN: {
    code: "SAN",
    name: "San Diego International Airport",
    city: "San Diego",
    country: "US",
  },
  DCA: {
    code: "DCA",
    name: "Ronald Reagan Washington National Airport",
    city: "Washington, D.C.",
    country: "US",
  },
  BWI: {
    code: "BWI",
    name: "Baltimore/Washington International Airport",
    city: "Baltimore",
    country: "US",
  },
  MSP: {
    code: "MSP",
    name: "Minneapolis–Saint Paul International Airport",
    city: "Minneapolis–Saint Paul",
    country: "US",
  },
  DTW: {
    code: "DTW",
    name: "Detroit Metropolitan Airport",
    city: "Detroit",
    country: "US",
  },
  PHL: {
    code: "PHL",
    name: "Philadelphia International Airport",
    city: "Philadelphia",
    country: "US",
  },
  CLT: {
    code: "CLT",
    name: "Charlotte Douglas International Airport",
    city: "Charlotte",
    country: "US",
  },
  PHX: {
    code: "PHX",
    name: "Phoenix Sky Harbor International Airport",
    city: "Phoenix",
    country: "US",
  },
  SLC: {
    code: "SLC",
    name: "Salt Lake City International Airport",
    city: "Salt Lake City",
    country: "US",
  },
  HNL: {
    code: "HNL",
    name: "Daniel K. Inouye International Airport",
    city: "Honolulu",
    country: "US",
  },

  // --- U.S. secondary airports people frequently fly to/from ---
  OAK: {
    code: "OAK",
    name: "Oakland International Airport",
    city: "Oakland",
    country: "US",
  },
  SJC: {
    code: "SJC",
    name: "San José Mineta International Airport",
    city: "San Jose",
    country: "US",
  },
  LGA: {
    code: "LGA",
    name: "LaGuardia Airport",
    city: "New York",
    country: "US",
  },
  FLL: {
    code: "FLL",
    name: "Fort Lauderdale–Hollywood International Airport",
    city: "Fort Lauderdale",
    country: "US",
  },
  TPA: {
    code: "TPA",
    name: "Tampa International Airport",
    city: "Tampa",
    country: "US",
  },
  MCO: {
    code: "MCO",
    name: "Orlando International Airport",
    city: "Orlando",
    country: "US",
  },
  AUS: {
    code: "AUS",
    name: "Austin–Bergstrom International Airport",
    city: "Austin",
    country: "US",
  },
  RDU: {
    code: "RDU",
    name: "Raleigh–Durham International Airport",
    city: "Raleigh–Durham",
    country: "US",
  },
  STL: {
    code: "STL",
    name: "St. Louis Lambert International Airport",
    city: "St. Louis",
    country: "US",
  },
  CMH: {
    code: "CMH",
    name: "John Glenn Columbus International Airport",
    city: "Columbus",
    country: "US",
  },

  // --- Canada ---
  YYZ: {
    code: "YYZ",
    name: "Toronto Pearson International Airport",
    city: "Toronto",
    country: "CA",
  },
  YVR: {
    code: "YVR",
    name: "Vancouver International Airport",
    city: "Vancouver",
    country: "CA",
  },
  YYC: {
    code: "YYC",
    name: "Calgary International Airport",
    city: "Calgary",
    country: "CA",
  },
  YUL: {
    code: "YUL",
    name: "Montréal–Trudeau International Airport",
    city: "Montreal",
    country: "CA",
  },

  // --- Europe: Major Hubs ---
  LHR: {
    code: "LHR",
    name: "London Heathrow Airport",
    city: "London",
    country: "UK",
  },
  LGW: {
    code: "LGW",
    name: "London Gatwick Airport",
    city: "London",
    country: "UK",
  },
  CDG: {
    code: "CDG",
    name: "Charles de Gaulle Airport",
    city: "Paris",
    country: "FR",
  },
  ORY: {
    code: "ORY",
    name: "Paris Orly Airport",
    city: "Paris",
    country: "FR",
  },
  FRA: {
    code: "FRA",
    name: "Frankfurt Airport",
    city: "Frankfurt",
    country: "DE",
  },
  MUC: { code: "MUC", name: "Munich Airport", city: "Munich", country: "DE" },
  AMS: {
    code: "AMS",
    name: "Amsterdam Schiphol Airport",
    city: "Amsterdam",
    country: "NL",
  },
  MAD: {
    code: "MAD",
    name: "Adolfo Suárez Madrid–Barajas Airport",
    city: "Madrid",
    country: "ES",
  },
  BCN: {
    code: "BCN",
    name: "Barcelona–El Prat Airport",
    city: "Barcelona",
    country: "ES",
  },
  FCO: {
    code: "FCO",
    name: "Rome Fiumicino Airport",
    city: "Rome",
    country: "IT",
  },
  ZRH: { code: "ZRH", name: "Zürich Airport", city: "Zürich", country: "CH" },
  CPH: {
    code: "CPH",
    name: "Copenhagen Airport",
    city: "Copenhagen",
    country: "DK",
  },

  // --- Asia / Pacific ---
  HND: {
    code: "HND",
    name: "Tokyo Haneda Airport",
    city: "Tokyo",
    country: "JP",
  },
  NRT: {
    code: "NRT",
    name: "Narita International Airport",
    city: "Tokyo",
    country: "JP",
  },
  ICN: {
    code: "ICN",
    name: "Incheon International Airport",
    city: "Seoul",
    country: "KR",
  },
  SIN: {
    code: "SIN",
    name: "Singapore Changi Airport",
    city: "Singapore",
    country: "SG",
  },
  BKK: {
    code: "BKK",
    name: "Suvarnabhumi Airport",
    city: "Bangkok",
    country: "TH",
  },
  SYD: {
    code: "SYD",
    name: "Sydney Kingsford Smith Airport",
    city: "Sydney",
    country: "AU",
  },
  MEL: {
    code: "MEL",
    name: "Melbourne Airport",
    city: "Melbourne",
    country: "AU",
  },

  // --- Mexico / Latin America ---
  MEX: {
    code: "MEX",
    name: "Mexico City International Airport",
    city: "Mexico City",
    country: "MX",
  },
  CUN: {
    code: "CUN",
    name: "Cancún International Airport",
    city: "Cancún",
    country: "MX",
  },
  SJD: {
    code: "SJD",
    name: "Los Cabos International Airport",
    city: "San José del Cabo",
    country: "MX",
  },
  GDL: {
    code: "GDL",
    name: "Guadalajara International Airport",
    city: "Guadalajara",
    country: "MX",
  },
  BOG: {
    code: "BOG",
    name: "El Dorado International Airport",
    city: "Bogotá",
    country: "CO",
  },
  GRU: {
    code: "GRU",
    name: "São Paulo/Guarulhos International Airport",
    city: "São Paulo",
    country: "BR",
  },
  EZE: {
    code: "EZE",
    name: "Ezeiza International Airport",
    city: "Buenos Aires",
    country: "AR",
  },
};

// --------------------------------------
// Reverse Mapping: Name -> Airport
// --------------------------------------

export const AIRPORTS_BY_NAME: Record<string, Airport> = Object.values(
  AIRPORTS_BY_CODE
).reduce((acc, airport) => {
  acc[airport.name.toLowerCase()] = airport;
  return acc;
}, {} as Record<string, Airport>);

// --------------------------------------
// Utility Helpers
// --------------------------------------

export function getAirportByCode(code: string): Airport | null {
  if (!code) return null;
  return AIRPORTS_BY_CODE[code.toUpperCase()] ?? null;
}

export function getAirportByName(name: string): Airport | null {
  if (!name) return null;
  return AIRPORTS_BY_NAME[name.trim().toLowerCase()] ?? null;
}

/** Best-effort resolver from either code or name */
export function resolveAirport(input: string): Airport | null {
  if (!input) return null;

  const byCode = getAirportByCode(input);
  if (byCode) return byCode;

  const normalized = input.trim().toLowerCase();
  return getAirportByName(normalized) ?? null;
}
