'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { Supplier, SupplierBill } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNPR, getCurrentBsDate, getCurrentTime } from '@/lib/nepali-date'
import { Loader2, FileDown, Table as TableIcon } from 'lucide-react'
import { toast } from 'sonner'

const BUSINESS_NAME = 'Nav Durga Electronics and Iron Stores'
const BUSINESS_ADDRESS = 'Bandipur-2, Siraha, Nepal'

function formatBalanceWithSuffix(balance: number): string {
  const suffix = balance >= 0 ? 'Cr' : 'Dr'
  const absBalance = Math.abs(balance)
  return `${absBalance.toLocaleString('en-IN')} ${suffix}`
}

export default function SupplierLedgerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <SupplierLedgerContent />
    </Suspense>
  )
}

function SupplierLedgerContent() {
  const searchParams = useSearchParams()
  const initialSupplierId = searchParams.get('supplier_id') || ''
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [bills, setBills] = useState<SupplierBill[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState(initialSupplierId)
  const [loading, setLoading] = useState(true)

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId)

  const fetchSuppliers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('status', 'active')
        .order('name', { ascending: true })
      if (error) throw error
      setSuppliers((data as any[]) || [])
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      toast.error('Failed to load suppliers')
    }
  }, [])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  useEffect(() => {
    if (!selectedSupplierId) {
      setBills([])
      setPayments([])
      return
    }
    async function fetchData() {
      setLoading(true)
      try {
        const [billsRes, paymentsRes] = await Promise.all([
          supabase.from('supplier_bills').select('*').eq('supplier_id', selectedSupplierId).order('date_ad', { ascending: true }),
          supabase.from('supplier_payments').select('*').eq('supplier_id', selectedSupplierId).order('date_ad', { ascending: true })
        ])

        if (billsRes.error) throw billsRes.error
        if (paymentsRes.error) throw paymentsRes.error

        setBills(billsRes.data || [])
        setPayments(paymentsRes.data || [])
      } catch (error) {
        console.error('Error fetching ledger data:', error)
        toast.error('Failed to load transactions')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [selectedSupplierId])

  const openingBalance = Number(selectedSupplier?.opening_balance || 0)

  // For supplier: Purchase (bill) = Credit (increases what we owe), Payment = Debit (decreases what we owe)
  const transactions = [
    ...bills.map(b => ({
      id: b.id,
      date_ad: b.date_ad,
      date_bs: b.date_bs,
      type: 'purchase',
      debit: 0,
      credit: Number(b.total_with_vat || 0),
    })),
    ...payments.map(p => ({
      id: p.id,
      date_ad: p.date_ad,
      date_bs: p.date_bs,
      type: 'payment',
      debit: Number(p.amount || 0),
      credit: 0,
    }))
  ].sort((a, b) => new Date(a.date_ad).getTime() - new Date(b.date_ad).getTime())

  // Running balance: positive = we owe (Credit), negative = advance (Debit)
  let currentRunning = openingBalance
  const ledgerItems = transactions.map(t => {
    currentRunning = currentRunning + t.credit - t.debit
    return { ...t, balance: currentRunning }
  })

  const totalCredit = bills.reduce((sum, b) => sum + Number(b.total_with_vat || 0), 0)
  const totalDebit = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const finalBalance = openingBalance + totalCredit - totalDebit

  const downloadPdf = () => {
    if (!selectedSupplier) return
    const doc = new jsPDF()

    // Business Header
    doc.setFont('times', 'bold')
    doc.setFontSize(18)
    doc.text(BUSINESS_NAME, 105, 20, { align: 'center' })

    doc.setFont('times', 'normal')
    doc.setFontSize(10)
    doc.text(BUSINESS_ADDRESS, 105, 28, { align: 'center' })

    // Horizontal line
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.line(14, 34, 196, 34)

    // Report title
    doc.setFontSize(14)
    doc.setTextColor(60)
    doc.text('Supplier Ledger Report', 14, 45)
    doc.setFontSize(10)
    doc.text(`Generated: ${getCurrentBsDate()}`, 14, 52)

    // Supplier Info
    doc.setTextColor(0)
    doc.setFontSize(12)
    doc.text(`Supplier: ${selectedSupplier.name}`, 14, 64)
    doc.setFontSize(10)
    doc.text(`Code: ${selectedSupplier.supplier_code}`, 14, 71)
    if (selectedSupplier.phone) doc.text(`Phone: ${selectedSupplier.phone}`, 14, 77)

    // Summary
    doc.setDrawColor(180)
    doc.line(14, 85, 196, 85)
    doc.setFontSize(10)
    doc.text('Summary', 14, 93)
    doc.text(`Opening Balance: NPR ${openingBalance.toLocaleString('en-IN')}`, 14, 101)
    doc.text(`Total Credit (Purchases): NPR ${totalCredit.toLocaleString('en-IN')}`, 14, 107)
    doc.text(`Total Debit (Payments): NPR ${totalDebit.toLocaleString('en-IN')}`, 14, 113)
    doc.setFont(undefined, 'bold')
    doc.text(`Closing Balance: ${formatBalanceWithSuffix(finalBalance)}`, 14, 121)
    doc.setFont(undefined, 'normal')

    // Table - Order: Date(BS), Type, Debit, Credit, Balance
    const tableData = [
      ['Date (BS)', 'Type', 'Debit', 'Credit', 'Balance'],
      [selectedSupplier.opening_balance_date_bs || '—', 'OPENING', '—', '—', formatBalanceWithSuffix(openingBalance)],
      ...ledgerItems.map(item => [
        item.date_bs,
        item.type.toUpperCase(),
        item.debit > 0 ? item.debit.toLocaleString('en-IN') : '—',
        item.credit > 0 ? item.credit.toLocaleString('en-IN') : '—',
        formatBalanceWithSuffix(item.balance)
      ])
    ]

    autoTable(doc, {
      startY: 129,
      head: [tableData[0]],
      body: tableData.slice(1),
      theme: 'plain',
      headStyles: {
        fillColor: [80, 80, 80],
        textColor: 255,
        font: 'times',
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 9,
        font: 'times'
      },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' }
      },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    })

    const timestamp = `${getCurrentBsDate().replace(/\//g, '-')}_${getCurrentTime().replace(/:/g, '-')}`
    doc.save(`Supplier_Ledger_${selectedSupplier.name.replace(/\s+/g, '_')}_${timestamp}.pdf`)
  }

  const downloadExcel = () => {
    if (!selectedSupplier) return

    const infoData = [
      [BUSINESS_NAME],
      [BUSINESS_ADDRESS],
      [],
      ['Supplier Ledger Report'],
      [`Supplier: ${selectedSupplier.name} (${selectedSupplier.supplier_code})`],
      [`Generated on: ${getCurrentBsDate()} ${getCurrentTime()}`],
      [],
      ['SUMMARY'],
      ['Opening Balance', openingBalance],
      ['Total Credit (Purchases)', totalCredit],
      ['Total Debit (Payments)', totalDebit],
      ['Closing Balance', finalBalance],
      [],
      ['Date (BS)', 'Type', 'Debit', 'Credit', 'Balance']
    ]

    const transactionData = [
      [selectedSupplier.opening_balance_date_bs || '—', 'OPENING', 0, 0, openingBalance],
      ...ledgerItems.map(item => [
        item.date_bs,
        item.type.toUpperCase(),
        item.debit,
        item.credit,
        item.balance
      ])
    ]

    const ws = XLSX.utils.aoa_to_sheet([...infoData, ...transactionData])

    ws['!cols'] = [
      { wch: 14 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 }
    ]

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = ws[XLSX.utils.encode_cell({ c: C, r: R })]
        if (cell && cell.t === 'n') cell.z = '#,##0.00'
      }
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger')
    const timestamp = `${getCurrentBsDate().replace(/\//g, '-')}_${getCurrentTime().replace(/:/g, '-')}`
    XLSX.writeFile(wb, `Supplier_Ledger_${selectedSupplier.name.replace(/\s+/g, '_')}_${timestamp}.xlsx`)
  }

  return (
    <div className="space-y-6" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
      {/* Business Header */}
      <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
        <h1 className="text-2xl font-bold tracking-wide">{BUSINESS_NAME}</h1>
        <p className="text-sm text-gray-600 mt-1">{BUSINESS_ADDRESS}</p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Supplier Ledger</h2>
          <p className="text-gray-600 text-sm">Transaction history and balance</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select a supplier" />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} ({s.supplier_code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedSupplierId ? (
        <Card className="bg-gray-50 border-dashed">
          <CardContent className="py-20 text-center text-gray-500">
            Select a supplier above to generate the ledger report
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-gray-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Opening Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{formatNPR(openingBalance)}</p>
                {selectedSupplier?.opening_balance_date_bs && (
                  <p className="text-xs text-gray-500 mt-1">As of {selectedSupplier.opening_balance_date_bs}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Credit (Purchases)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold text-gray-800">{formatNPR(totalCredit)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Debit (Payments)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold text-gray-800">{formatNPR(totalDebit)}</p>
              </CardContent>
            </Card>
            <Card className={finalBalance > 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-800">Closing Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-gray-800">
                  {formatBalanceWithSuffix(finalBalance)}
                </p>
                <p className="text-xs font-medium uppercase mt-1 text-gray-600">
                  {finalBalance > 0 ? 'Payable' : 'Advance'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-gray-800">Transaction Ledger</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={downloadExcel} className="hidden sm:flex">
                  <TableIcon className="mr-2 h-4 w-4" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={downloadPdf}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100 hover:bg-gray-100">
                    <TableHead className="font-semibold text-gray-800">Date (BS)</TableHead>
                    <TableHead className="font-semibold text-gray-800">Type</TableHead>
                    <TableHead className="text-right font-semibold text-gray-800">Debit</TableHead>
                    <TableHead className="text-right font-semibold text-gray-800">Credit</TableHead>
                    <TableHead className="text-right font-semibold text-gray-800">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-gray-50 italic">
                    <TableCell>Opening Balance</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right font-bold">{formatBalanceWithSuffix(openingBalance)}</TableCell>
                  </TableRow>
                  {ledgerItems.map((item) => (
                    <TableRow key={`${item.type}-${item.id}`}>
                      <TableCell className="whitespace-nowrap">{item.date_bs}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize border-gray-400 text-gray-700">
                          {item.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.debit > 0 ? formatNPR(item.debit) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.credit > 0 ? formatNPR(item.credit) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-bold text-gray-800">
                        {formatBalanceWithSuffix(item.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}