import { NextRequest, NextResponse } from 'next/server'
import { extractBillData } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let imageBase64: string
    let mimeType: string

    if (file.type === 'application/pdf') {
      // For PDF files, send directly to Gemini (it supports PDF)
      imageBase64 = buffer.toString('base64')
      mimeType = 'application/pdf'
    } else {
      // For image files, send as-is
      imageBase64 = buffer.toString('base64')
      mimeType = file.type || 'image/jpeg'
    }

    // Also prepare a compressed version for storage
    // Store the original as base64 data URL for the client to use
    const imageDataUrl = `data:${mimeType};base64,${imageBase64}`

    const billData = await extractBillData(imageBase64, mimeType)

    return NextResponse.json({
      success: true,
      data: billData,
      imageDataUrl, // Send back for client-side preview and Supabase upload
    })
  } catch (error: any) {
    console.error('Scan bill error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to scan bill' },
      { status: 500 }
    )
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}
