import React, { forwardRef } from 'react'
import type { CustomerBill } from '@/types'
import { formatNPR } from '@/lib/nepali-date'
import { numberToWords } from '@/lib/number-to-words'

interface EstimatePrintTemplateProps {
  bill: CustomerBill | null
}

export const EstimatePrintTemplate = forwardRef<HTMLDivElement, EstimatePrintTemplateProps>(
  ({ bill }, ref) => {
    if (!bill) return null

    const subtotal = bill.items?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0
    const totalDiscount = bill.discount_amount || 0
    const transportation = bill.transportation_amount || 0
    const grandTotal = subtotal - totalDiscount + transportation

    // To make the table look professional, we fill it to at least 15 rows
    const MIN_ROWS = 15
    const actualItems = bill.items || []

    return (
      <div ref={ref} className="bg-white p-[10mm] w-[210mm] min-h-[297mm] mx-auto text-black print:p-0 print:m-0" 
           style={{ fontFamily: '"Times New Roman", Times, serif', color: '#000' }}>
        <style type="text/css" media="all">
          {`
            @page { size: A4 portrait; margin: 10mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .bill-border { border: 1px solid #000; }
            .bill-table th, .bill-table td { border: 1px solid #000; padding: 4px 8px; }
            .label-underline { border-bottom: 1px solid #000; flex-grow: 1; min-height: 1.2em; margin-left: 4px; }
          `}
        </style>
        
        {/* Top Header Label */}
        <div className="text-left font-bold text-base mb-1">
          NDT 2081-82
        </div>

        {/* Centered Title */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold underline uppercase tracking-widest">Estimate</h1>
        </div>

        {/* Info Section */}
        <div className="flex justify-between items-start mb-4 text-[14px]">
          {/* Left Column */}
          <div className="w-[60%] space-y-3">
            <div className="flex items-end">
              <span className="font-bold whitespace-nowrap text-xs">Customer:</span>
              <div className="label-underline font-bold px-2">{bill.customer?.name || "–"}</div>
            </div>
            <div className="flex items-end">
              <span className="font-bold whitespace-nowrap text-xs">Address:</span>
              <div className="label-underline px-2">{bill.customer?.address || "–"}</div>
            </div>
            <div className="flex items-end">
              <span className="font-bold whitespace-nowrap text-xs">Payment Mode:</span>
              <div className="label-underline px-2">Cash / Credit / Cheque</div>
            </div>
          </div>

          {/* Right Column */}
          <div className="w-[35%] space-y-3">
            <div className="flex items-end justify-between">
              <span className="font-bold whitespace-nowrap text-xs">Estimate No.:</span>
              <div className="label-underline text-right px-2 font-bold">{bill.bill_code}</div>
            </div>
            <div className="flex items-end justify-between">
              <span className="font-bold whitespace-nowrap text-xs">Date (AD):</span>
              <div className="label-underline text-right px-2">{bill.date_ad}</div>
            </div>
            <div className="flex items-end justify-between">
              <span className="font-bold whitespace-nowrap text-xs">Date (BS):</span>
              <div className="label-underline text-right px-2">{bill.date_bs}</div>
            </div>
          </div>
        </div>

        {/* The Table */}
        <table className="w-full bill-table text-[14px] border-collapse bill-border mb-4">
          <thead>
            <tr style={{ backgroundColor: '#dbdbdb' }}>
              <th className="w-12 text-center">S.N.</th>
              <th className="text-left">Product</th>
              <th className="w-20 text-center">Qty</th>
              <th className="w-20 text-center">Unit</th>
              <th className="w-28 text-right">Rate</th>
              <th className="w-20 text-right">Disc</th>
              <th className="w-32 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {actualItems.map((item, index) => (
              <tr key={index} className="h-8">
                <td className="text-center">{index + 1}</td>
                <td className="font-bold">{item.product_name}</td>
                <td className="text-center">{item.quantity}</td>
                <td className="text-center">{item.unit}</td>
                <td className="text-right">{item.sell_rate.toLocaleString()}</td>
                <td className="text-right">{item.discount_percent ? item.discount_percent + '%' : '-'}</td>
                <td className="text-right font-bold">{item.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer Section */}
        <div className="flex justify-between items-start mt-2">
          <div className="w-[55%] space-y-4">
            <div className="flex items-start">
              <span className="font-bold whitespace-nowrap text-[10px] uppercase">In Words:</span>
              <div className="label-underline border-dashed italic capitalize px-2 font-bold py-0 text-[13px]">
                {numberToWords(grandTotal)}
              </div>
            </div>
            <div className="flex items-start">
              <span className="font-bold whitespace-nowrap text-[10px] uppercase">Remarks:</span>
              <div className="label-underline border-dashed h-6"></div>
            </div>
          </div>

          <div className="w-[35%] space-y-1 text-[13px]">
            <div className="flex justify-between">
              <span className="font-bold">Sub-Total:</span>
              <span className="font-bold border-b border-black min-w-[100px] text-right">{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Discount:</span>
              <span className="border-b border-black min-w-[100px] text-right">{totalDiscount > 0 ? totalDiscount.toLocaleString() : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-[11px]">Trans/Labour:</span>
              <span className="border-b border-black min-w-[100px] text-right">{transportation > 0 ? transportation.toLocaleString() : '-'}</span>
            </div>
            <div className="flex justify-between mt-2 pt-1 border-t border-black">
              <span className="text-base font-bold uppercase">Total:</span>
              <span className="text-base font-bold border-b-2 border-double border-black min-w-[120px] text-right">{grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Bottom Mid Signature */}
        <div className="mt-16 w-64 mx-auto text-center border-t border-black pt-1 font-bold text-[14px]">
          Prepared By
        </div>
      </div>
    )


  }
)

EstimatePrintTemplate.displayName = 'EstimatePrintTemplate'
