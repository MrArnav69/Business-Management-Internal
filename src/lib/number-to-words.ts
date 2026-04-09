const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

export function numberToWords(num: number | string): string {
  if (num === 0 || num === '0') return 'Zero'
  
  let n = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(n)) return ''

  // Format to 2 decimal places max
  n = Math.round(n * 100) / 100
  
  const str = n.toFixed(2)
  const parts = str.split('.')
  const wholeStr = parts[0]
  let decStr = parts[1] || '00'

  if (decStr === '00') decStr = ''

  let whole = parseInt(wholeStr, 10)
  if (whole === 0) return 'Zero'

  let words = ''

  if (whole >= 10000000) {
    words += convertBelowThousand(Math.floor(whole / 10000000)) + ' Crore '
    whole %= 10000000
  }
  
  if (whole >= 100000) {
    words += convertBelowThousand(Math.floor(whole / 100000)) + ' Lakh '
    whole %= 100000
  }

  if (whole >= 1000) {
    words += convertBelowThousand(Math.floor(whole / 1000)) + ' Thousand '
    whole %= 1000
  }

  if (whole > 0) {
    words += convertBelowThousand(whole)
  }

  words = words.trim() + ' Rupees'

  if (decStr) {
    const dec = parseInt(decStr, 10)
    if (dec > 0) {
      words += ' and ' + convertBelowThousand(dec) + ' Paisa'
    }
  }

  return words + ' Only'
}

function convertBelowThousand(n: number): string {
  let str = ''

  if (n > 99) {
    str += ones[Math.floor(n / 100)] + ' Hundred '
    n %= 100
  }

  if (n > 19) {
    str += tens[Math.floor(n / 10)] + ' '
    n %= 10
  }

  if (n > 0) {
    str += ones[Math.floor(n)] + ' '
  }

  return str.trim()
}
