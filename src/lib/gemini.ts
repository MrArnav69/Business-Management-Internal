import { GoogleGenAI } from '@google/genai'

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY!

export const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

// All available categories in the system for product classification
const CATEGORIES_INFO = `
Available product categories (pick the BEST match):
- Electrical (ELE): wires, cables, switches, MCBs, sockets, lights, fans, inverters
- Plumbing (PLB): pipes, fittings, taps, valves, tanks
- Paints & Finishes (PNT): paints, primers, varnishes, putty, brushes
- Cement & Concrete (CMT): cement, concrete, blocks, bricks
- Steel & TMT (STL): TMT bars, steel rods, angles, channels, binding wire
- Roofing / CGI Sheets (RFG): tin sheets, CGI sheets, ridges, screws
- Plywood & Boards (PLY): plywood, MDF, particle board, laminates
- Tiles & Flooring (TIL): tiles, marble, granite, adhesive
- Glass (GLS): glass sheets, mirrors, glass fittings
- Hardware & Fittings (HDW): locks, hinges, handles, nails, screws, bolts, tapes
- Appliances (APL): fans, heaters, water purifiers, kitchen appliances
- Tools (TOL): hand tools, power tools, measuring tools
- Sanitary (SAN): commodes, basins, bathroom fittings, shower
- Welding & Fabrication (WLD): welding rods, machines, grinding discs
- Safety & Security (SAF): helmets, gloves, safety shoes, CCTV
`

// Available units for product measurement
const UNITS_INFO = `
Available units (use the abbreviation):
- pcs (Pieces) - default if unclear
- m (Meters)
- ft (Feet)
- sqft (Square Feet)
- L (Liters)
- kg (Kilograms)
- bag (Bag)
- set (Set)
- box (Box)
- roll (Roll)
`

export const BILL_SCAN_PROMPT = `You are a data extraction AI for a Nepali hardware/electronics retail store called "Nav Durga Electronics and Iron Stores" (also known as "New Durga Electric/Electronics").

You are analyzing a SCANNED PURCHASE BILL (supplier invoice). Extract ALL data from this bill image.

IMPORTANT CONTEXT:
- This is a PURCHASE bill — we are BUYING from a supplier
- The supplier's name/company is in the HEADER of the bill (NOT our store name)
- Our store name may appear as the "Customer" or "Party" on the bill — IGNORE it
- Dates may be in Bikram Sambat (BS/Nepali calendar, e.g., 2082/06/28) or AD format
- Currency is Nepalese Rupees (NPR/Rs.)
- "Miti" means date in Nepali

${CATEGORIES_INFO}

${UNITS_INFO}

EXTRACTION RULES:
1. Extract the SUPPLIER name from the bill header/letterhead (NOT the customer/party name which is our store)
2. For the invoice number, look for "Invoice", "Bill No", "Estimate No", "SB-", "SV-" etc.
3. For dates: extract whatever is visible. If BS date (Nepali) is present, format as YYYY/MM/DD. If AD date is present, format as YYYY-MM-DD.
4. For each line item:
   - Extract the product name EXACTLY as written
   - Extract quantity as a number
   - Map the unit to one of the available units (PCS→pcs, DZN→pcs*12, MTR→m, etc.)
   - Extract the RATE (buy price per unit)
   - If there is a per-item discount %, extract it
   - Extract the net amount (total for that line)
5. For the category: classify each product into the BEST matching category from the list above
6. Extract subtotal, bill-level discount, transportation/labour costs, and grand total

Return ONLY valid JSON in this exact structure:

{
  "supplier_name": "string - supplier/company name from header",
  "invoice_no": "string - invoice/bill number",
  "date_bs": "string - Nepali date as YYYY/MM/DD or empty",
  "date_ad": "string - AD date as YYYY-MM-DD or empty",
  "items": [
    {
      "name": "string - product name as shown on bill",
      "quantity": number,
      "unit": "string - abbreviation from available units",
      "buy_rate": number,
      "discount_percent": number,
      "amount": number,
      "category_prefix": "string - 3-letter prefix from categories list"
    }
  ],
  "subtotal": number,
  "discount_amount": number,
  "transportation_amount": number,
  "total": number
}

If a value cannot be determined, use empty string for text and 0 for numbers.
Do NOT include any text outside the JSON. Return ONLY the JSON object.`

export interface ScannedBillData {
  supplier_name: string
  invoice_no: string
  date_bs: string
  date_ad: string
  items: ScannedBillItem[]
  subtotal: number
  discount_amount: number
  transportation_amount: number
  total: number
}

export interface ScannedBillItem {
  name: string
  quantity: number
  unit: string
  buy_rate: number
  discount_percent: number
  amount: number
  category_prefix: string
}

export async function extractBillData(imageBase64: string, mimeType: string): Promise<ScannedBillData> {
  const model = 'gemini-2.5-flash'

  const response = await genAI.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { text: BILL_SCAN_PROMPT },
          {
            inlineData: {
              mimeType: mimeType as any,
              data: imageBase64,
            },
          },
        ],
      },
    ],
  })

  const text = response.text || ''
  
  // Extract JSON from the response (handle markdown code blocks)
  let jsonStr = text
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim()
  } else {
    // Try to find raw JSON
    const braceMatch = text.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      jsonStr = braceMatch[0]
    }
  }

  try {
    const parsed = JSON.parse(jsonStr) as ScannedBillData
    return parsed
  } catch (e) {
    console.error('Failed to parse Gemini response:', text)
    throw new Error('Failed to parse bill data from AI response')
  }
}
