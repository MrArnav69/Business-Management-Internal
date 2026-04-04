export const CATEGORIES = [
  { name: 'Electrical', prefix: 'ELE' },
  { name: 'Plumbing', prefix: 'PLB' },
  { name: 'Paints & Finishes', prefix: 'PNT' },
  { name: 'Cement & Concrete', prefix: 'CMT' },
  { name: 'Steel & TMT', prefix: 'STL' },
  { name: 'Roofing / CGI Sheets', prefix: 'RFG' },
  { name: 'Plywood & Boards', prefix: 'PLY' },
  { name: 'Tiles & Flooring', prefix: 'TIL' },
  { name: 'Glass', prefix: 'GLS' },
  { name: 'Hardware & Fittings', prefix: 'HDW' },
  { name: 'Appliances', prefix: 'APL' },
  { name: 'Tools', prefix: 'TOL' },
  { name: 'Sanitary', prefix: 'SAN' },
  { name: 'Welding & Fabrication', prefix: 'WLD' },
  { name: 'Safety & Security', prefix: 'SAF' },
] as const

export const UNITS = [
  { name: 'Pieces', abbreviation: 'pcs' },
  { name: 'Meters', abbreviation: 'm' },
  { name: 'Feet', abbreviation: 'ft' },
  { name: 'Square Feet', abbreviation: 'sqft' },
  { name: 'Liters', abbreviation: 'L' },
  { name: 'Kilograms', abbreviation: 'kg' },
  { name: 'Bag', abbreviation: 'bag' },
  { name: 'Set', abbreviation: 'set' },
  { name: 'Box', abbreviation: 'box' },
  { name: 'Roll', abbreviation: 'roll' },
] as const

export const VAT_RATE = 0.13

export const COUNTRIES = [
  { name: 'Nepal', code: 'NP', dialCode: '+977' },
  { name: 'India', code: 'IN', dialCode: '+91' },
  { name: 'China', code: 'CN', dialCode: '+86' },
  { name: 'Bangladesh', code: 'BD', dialCode: '+880' },
  { name: 'Pakistan', code: 'PK', dialCode: '+92' },
  { name: 'Sri Lanka', code: 'LK', dialCode: '+94' },
  { name: 'Bhutan', code: 'BT', dialCode: '+975' },
  { name: 'United States', code: 'US', dialCode: '+1' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44' },
  { name: 'Australia', code: 'AU', dialCode: '+61' },
] as const
