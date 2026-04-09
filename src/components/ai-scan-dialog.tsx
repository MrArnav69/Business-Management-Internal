'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Upload, FileImage, CheckCircle2, AlertCircle, X, ScanLine, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import type { ScannedBillData, ScannedBillItem } from '@/lib/gemini'
import { formatNPR } from '@/lib/nepali-date'

interface AiScanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScanComplete: (data: ScannedBillData, imageDataUrl: string) => void
}

type ScanState = 'upload' | 'scanning' | 'preview' | 'error'

export function AiScanDialog({ open, onOpenChange, onScanComplete }: AiScanDialogProps) {
  const [state, setState] = useState<ScanState>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<ScannedBillData | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setState('upload')
    setFile(null)
    setPreview(null)
    setScanResult(null)
    setImageDataUrl(null)
    setErrorMsg('')
    setDragOver(false)
  }, [])

  const handleClose = useCallback((open: boolean) => {
    if (!open) reset()
    onOpenChange(open)
  }, [onOpenChange, reset])

  const handleFile = useCallback((f: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!validTypes.includes(f.type)) {
      toast.error('Please upload a JPG, PNG, WebP, or PDF file')
      return
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error('File must be under 20MB')
      return
    }
    setFile(f)
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f)
      setPreview(url)
    } else {
      setPreview(null) // PDFs don't get a preview thumbnail
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleScan = useCallback(async () => {
    if (!file) return
    setState('scanning')
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/scan-bill', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Scan failed')
      }

      setScanResult(json.data)
      setImageDataUrl(json.imageDataUrl)
      setState('preview')
    } catch (err: any) {
      console.error('Scan error:', err)
      setErrorMsg(err.message || 'Failed to scan bill')
      setState('error')
    }
  }, [file])

  const handleConfirm = useCallback(() => {
    if (scanResult && imageDataUrl) {
      onScanComplete(scanResult, imageDataUrl)
      handleClose(false)
    }
  }, [scanResult, imageDataUrl, onScanComplete, handleClose])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20">
              <ScanLine className="h-5 w-5 text-violet-600" />
            </div>
            AI Bill Scanner
            <Badge variant="outline" className="ml-2 text-[10px] bg-gradient-to-r from-violet-500/10 to-blue-500/10 border-violet-300 text-violet-700">
              <Sparkles className="h-3 w-3 mr-1" />
              BETA
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Upload a supplier bill photo or PDF. AI will extract all details and fill the form for you.
          </DialogDescription>
        </DialogHeader>

        {/* Upload State */}
        {state === 'upload' && (
          <div className="space-y-4">
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                dragOver
                  ? 'border-violet-500 bg-violet-50 scale-[1.02]'
                  : file
                  ? 'border-green-400 bg-green-50/50'
                  : 'border-muted-foreground/25 hover:border-violet-400 hover:bg-violet-50/30'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="hidden"
              />
              {file ? (
                <div className="space-y-3">
                  {preview ? (
                    <img src={preview} alt="Bill preview" className="mx-auto max-h-48 rounded-lg shadow-lg object-contain" />
                  ) : (
                    <FileImage className="mx-auto h-16 w-16 text-green-500" />
                  )}
                  <div>
                    <p className="font-bold text-green-700">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · Click to change</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center">
                    <Upload className="h-8 w-8 text-violet-500" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">Drop your bill here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Supports JPG, PNG, WebP, PDF · Max 20MB
                    </p>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button 
                onClick={handleScan} 
                disabled={!file}
                className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white shadow-lg"
              >
                <ScanLine className="mr-2 h-4 w-4" />
                Scan Bill
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Scanning State */}
        {state === 'scanning' && (
          <div className="py-16 flex flex-col items-center justify-center space-y-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 flex items-center justify-center animate-pulse">
                <ScanLine className="h-10 w-10 text-white" />
              </div>
              <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-violet-300 animate-ping opacity-20" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
                AI is reading your bill...
              </p>
              <p className="text-sm text-muted-foreground">
                Extracting supplier, items, rates, and totals
              </p>
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-violet-500 mt-4" />
            </div>
          </div>
        )}

        {/* Preview State */}
        {state === 'preview' && scanResult && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-green-50/50 border-green-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-bold text-green-800">Bill Scanned Successfully!</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Supplier:</span>
                  <span className="ml-2 font-medium">{scanResult.supplier_name || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Invoice #:</span>
                  <span className="ml-2 font-mono font-medium">{scanResult.invoice_no || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Date (BS):</span>
                  <span className="ml-2 font-medium">{scanResult.date_bs || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Date (AD):</span>
                  <span className="ml-2 font-medium">{scanResult.date_ad || '—'}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-bold">Extracted Items ({scanResult.items.length})</span>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Product</th>
                      <th className="text-center px-2 py-2 font-semibold">Qty</th>
                      <th className="text-right px-2 py-2 font-semibold">Rate</th>
                      <th className="text-right px-3 py-2 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanResult.items.map((item, i) => (
                      <tr key={i} className="border-t hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <p className="font-medium">{item.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Badge variant="outline" className="text-[9px] px-1 py-0">{item.category_prefix}</Badge>
                            <Badge variant="outline" className="text-[9px] px-1 py-0">{item.unit}</Badge>
                            {item.discount_percent > 0 && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-orange-100 text-orange-700">
                                -{item.discount_percent}%
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="text-center px-2 py-2 font-medium">{item.quantity}</td>
                        <td className="text-right px-2 py-2 font-mono text-xs">{formatNPR(item.buy_rate)}</td>
                        <td className="text-right px-3 py-2 font-bold">{formatNPR(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t bg-muted/30 px-4 py-3 space-y-1">
                {scanResult.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-green-700">
                    <span>Discount</span>
                    <span>-{formatNPR(scanResult.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-primary">{formatNPR(scanResult.total)}</span>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={reset}>
                <X className="mr-2 h-4 w-4" />
                Re-scan
              </Button>
              <Button 
                onClick={handleConfirm}
                className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white shadow-lg"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Fill Form & Review
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Error State */}
        {state === 'error' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-bold text-red-700">Scan Failed</p>
              <p className="text-sm text-muted-foreground max-w-[300px]">{errorMsg}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>Try Again</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
