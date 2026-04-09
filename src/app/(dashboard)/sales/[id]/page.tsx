'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { deleteCustomerBill } from '@/lib/bill-actions'
import type { CustomerBill, CustomerBillItem } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatNPR } from '@/lib/nepali-date'
import { VAT_RATE } from '@/lib/constants'
import { ArrowLeft, Loader2, Printer, Trash2, Edit, Download } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'next/navigation'
import * as htmlToImage from 'html-to-image'
import { jsPDF } from 'jspdf'
import { EstimatePrintTemplate } from '@/components/estimate-print-template'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export default function SaleBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [bill, setBill] = useState<CustomerBill | null>(null)
  const [items, setItems] = useState<(CustomerBillItem & { product_name?: string; product_code?: string })[]>([])
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [id, setId] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unwrap = async () => {
      const p = await params
      setId(p.id)
    }
    unwrap()
  }, [params])

  useEffect(() => {
    if (!id) return
    async function fetchData() {
      try {
        const [billRes, itemsRes] = await Promise.all([
          supabase.from('customer_bills').select('*, customers(*)').eq('id', id).single(),
          supabase.from('customer_bill_items').select('*, products(name, product_code)').eq('bill_id', id),
        ])

        if (billRes.error) throw billRes.error
        const billData = billRes.data as any
        setBill({
          ...billData,
          customer: billData.customers,
          items: [] // items will be set separately
        } as CustomerBill)
        setCustomer(billRes.data.customers)
        setItems(
          (itemsRes.data || []).map((item) => ({
            ...item,
            product_name: item.products?.name || '—',
            product_code: item.products?.product_code || '—',
          }))
        )
        
        // Auto-print if query param is set
        if (searchParams?.get('print') === 'estimate') {
          setTimeout(() => {
            window.print()
          }, 500)
        }
      } catch (error) {
        console.error('Error fetching sale bill:', error)
        toast.error('Failed to load sale bill details')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, searchParams])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!bill) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Sale bill not found</p>
        <Link href="/sales">
          <Button className="mt-4">Back to Sales</Button>
        </Link>
      </div>
    )
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await deleteCustomerBill(bill.id, bill.customer_id)
      if (res.error) throw new Error(res.error)
      toast.success('Sale deleted successfully')
      router.push('/sales')
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete sale')
      setIsDeleting(false)
    }
  }

  const subtotal = Number(bill.total_amount)
  const discountAmount = Number(bill.discount_amount || 0)
  const taxAmount = Number(bill.tax_amount || 0)
  const transportationAmount = Number(bill.transportation_amount || 0)
  const totalWithVat = Number(bill.total_with_vat)

  const handlePrint = async () => {
    if (!printRef.current || !bill) return
    
    try {
      const element = printRef.current
      const dataUrl = await htmlToImage.toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })
      
      const imgProps = pdf.getImageProperties(dataUrl)
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight)
      
      const pdfBlob = pdf.output('blob')
      const pdfUrl = URL.createObjectURL(pdfBlob)
      
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      document.body.appendChild(iframe)
      
      iframe.src = pdfUrl
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
          // We don't remove use revokeObjectURL immediately to ensure printing finishes
        }, 200)
      }
    } catch (error) {
      console.error('PDF Print failed:', error)
      toast.error('Failed to prepare PDF for printing')
    }
  }

  const handleDownload = async () => {
    if (!printRef.current || !bill) return
    
    setIsDownloading(true)
    const toastId = toast.loading('Generating PDF...')
    
    try {
      // Use html-to-image which handles modern CSS (lab, oklch) much better than html2canvas
      const element = printRef.current
      
      const dataUrl = await htmlToImage.toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })
      
      const imgProps = pdf.getImageProperties(dataUrl)
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight)
      
      const customerName = bill.customer?.name || (bill as any).customers?.name || 'Customer'
      const timestamp = new Date().toLocaleString().replace(/[\/:]/g, '-').replace(/,/g, '')
      const fileName = `${customerName}_BILL_${bill.bill_code}_${timestamp}.pdf`
      
      pdf.save(fileName)
      
      toast.success('PDF downloaded successfully', { id: toastId })
    } catch (error) {
      console.error('PDF generation split:', error)
      toast.error('Failed to generate PDF', { id: toastId })
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <>
    <div className="space-y-6 print:hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/sales">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{bill.bill_code}</h1>
            <p className="text-muted-foreground">
              {bill.date_bs} {bill.invoice_no ? `&middot; Ref: ${bill.invoice_no}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              bill.status === 'paid'
                ? 'default'
                : bill.status === 'partial'
                ? 'secondary'
                : 'destructive'
            }
            className="text-sm capitalize"
          >
            {bill.status}
          </Badge>
          <Button onClick={handlePrint} variant="outline" className="border-violet-300 text-violet-700 hover:bg-violet-50 font-bold" title="Print Estimate">
            <Printer className="h-4 w-4 mr-2" />
            Print Estimate
          </Button>
          <Button onClick={handleDownload} disabled={isDownloading} variant="outline" className="font-bold">
            {isDownloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Download Bill
          </Button>

          <Link href={`/sales/${bill.id}/edit`}>
            <Button variant="outline" size="icon" title="Edit Bill">
              <Edit className="h-4 w-4" />
            </Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-destructive bg-background text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50" disabled={isDeleting} title="Delete Sale">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will completely delete this sale and revert the stock back into your inventory. It will also reduce the customer's outstanding balance permanently.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                  Delete Sale
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-semibold text-lg">{customer?.name || '—'}</p>
            <p className="text-muted-foreground text-sm font-mono">{customer?.customer_code}</p>
            {customer?.phone && <p className="text-sm">{customer.phone}</p>}
            {customer?.address && <p className="text-sm text-muted-foreground">{customer.address}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">{formatNPR(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium">- {formatNPR(discountAmount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">VAT ({(VAT_RATE * 100).toFixed(0)}%)</span>
              <span>{formatNPR(taxAmount)}</span>
            </div>
            )}
            {transportationAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transportation</span>
                <span>{formatNPR(transportationAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t pt-2 text-primary text-xl">
              <span>Total</span>
              <span>{formatNPR(totalWithVat)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bill Items</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground italic">
              No items recorded for this bill (Quick Total entry).
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Sell Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell className="font-mono text-sm">{item.product_code}</TableCell>
                    <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                    <TableCell className="text-right font-medium">{formatNPR(item.sell_rate)}</TableCell>
                    <TableCell className="text-right font-bold">{formatNPR(item.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
    
    {/* Hidden template container for PDF generation & Printing */}
    <div className="print:block print:static print:h-auto" style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
      <div ref={printRef} className="print:static print:left-0 print:top-0">
        <EstimatePrintTemplate bill={{
          ...bill, 
          items, 
          customer: bill.customer || (bill as any).customers || customer
        } as any} />
      </div>
    </div>
    
    <style jsx global>{`
      @media print {
        .print\\:static {
          position: static !important;
          left: 0 !important;
          top: 0 !important;
        }
      }
    `}</style>
    </>
  )
}
