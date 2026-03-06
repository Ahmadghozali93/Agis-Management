import * as XLSX from 'xlsx'

/**
 * Helper to strip BOM and quotes from a string
 */
function cleanString(str) {
    if (!str) return ''
    let cleaned = String(str).trim()
    if (cleaned.charCodeAt(0) === 0xFEFF) {
        cleaned = cleaned.slice(1)
    }
    return cleaned
}

/**
 * Finds the header index by checking for known TikTok headers
 */
function findHeaderRowIndex(rows) {
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
        const row = rows[r] || []
        const hasOrder = row.some(cell => {
            const val = String(cell).toLowerCase()
            return val.includes('order id') || val.includes('order/adjustment id')
        })
        if (hasOrder) return r
    }
    return 0 // Fallback to first row
}

/**
 * Parse Excel ArrayBuffer into array of objects
 */
export function parseXLSX(buffer) {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]

    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 })
    if (rawData.length < 2) return []

    const headerIdx = findHeaderRowIndex(rawData)
    const headers = (rawData[headerIdx] || []).map(cleanString)

    // Check if the row after header is a dummy row (TikTok Sales often has this)
    // A dummy row usually lacks the core data like order ID or has weird strings.
    let dataIdx = headerIdx + 1
    if (dataIdx < rawData.length) {
        const checkRow = rawData[dataIdx] || []
        // In TikTok Sales, row 2 is usually entirely empty except for maybe the first few cells, 
        // or just contains metadata. If it doesn't look like real data, skip it.
        // We'll peek at the "Quantity" or "Order Status" column or just see if the first cell is not a standard ID length.
        // As a safeguard, TikTok user specifically wanted to skip the row immediately after the header in Sales exports.
        // Generally, the dummy row has the text "Quantity" repeated or is entirely empty.
        // For Keuangan, data usually starts right away on the next row.
        const firstCell = String(checkRow[0] || '').trim()
        if (firstCell === '' || firstCell.toLowerCase().includes('total')) {
            // It might be a dummy row
            dataIdx++
        } else if (headers.includes('Seller SKU') && checkRow.length > 0 && !String(checkRow[headers.indexOf('Order ID')]).match(/^\d+$/)) {
            // If it's a sales CSV and the Order ID isn't numeric, it's likely a dummy row
            dataIdx++
        }
    }

    const dataLines = rawData.slice(dataIdx)

    return dataLines.map(row => {
        const obj = {}
        headers.forEach((h, idx) => {
            if (h) obj[h] = row[idx] !== undefined ? row[idx] : ''
        })
        return obj
    }).filter(obj => Object.keys(obj).length > 0)
}

/**
 * Parse CSV text into array of objects
 */
export function parseCSV(text) {
    const lines = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < text.length; i++) {
        const char = text[i]
        if (char === '"') {
            if (inQuotes && text[i + 1] === '"') {
                current += '"'
                i++
            } else {
                inQuotes = !inQuotes
            }
        } else if ((char === '\n' || (char === '\r' && text[i + 1] === '\n')) && !inQuotes) {
            if (current.trim()) lines.push(current)
            current = ''
            if (char === '\r') i++
        } else {
            current += char
        }
    }
    if (current.trim()) lines.push(current)

    if (lines.length < 2) return []

    // Helper: Find delimiter and split row to find headers
    const findDelimiterAndSplit = (line) => {
        const delimiter = line.includes('\t') ? '\t' : ','
        return { delimiter, row: splitRow(line, delimiter) }
    }

    let headerIdx = 0
    let headers = []
    let delimiter = ','

    for (let r = 0; r < Math.min(lines.length, 10); r++) {
        const res = findDelimiterAndSplit(lines[r])
        const hasOrder = res.row.some(cell => {
            const val = String(cell).toLowerCase()
            return val.includes('order id') || val.includes('order/adjustment id')
        })
        if (hasOrder) {
            headerIdx = r
            headers = res.row.map(cleanString)
            delimiter = res.delimiter
            break
        }
    }

    // Default if not found
    if (headers.length === 0) {
        const res = findDelimiterAndSplit(lines[0])
        headers = res.row.map(cleanString)
        delimiter = res.delimiter
    }

    let dataIdx = headerIdx + 1
    if (dataIdx < lines.length) {
        const nextRow = splitRow(lines[dataIdx], delimiter)
        if (headers.includes('Seller SKU')) {
            // This is a Sales Export logic. TikTok puts a dummy metadata row here.
            dataIdx++
        }
    }

    const dataLines = lines.slice(dataIdx)
    const results = []
    for (let i = 0; i < dataLines.length; i++) {
        const values = splitRow(dataLines[i], delimiter)
        const obj = {}
        headers.forEach((h, idx) => {
            if (h) obj[h.trim()] = (values[idx] || '').trim()
        })
        results.push(obj)
    }
    return results
}

function splitRow(line, delimiter) {
    const result = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"'
                i++
            } else {
                inQuotes = !inQuotes
            }
        } else if (char === delimiter && !inQuotes) {
            result.push(current)
            current = ''
        } else {
            current += char
        }
    }
    result.push(current)
    return result
}

/**
 * Map TikTok CSV row to tiktok_sales database format
 * Matches product name from DB by SKU if available
 */
export function mapTiktokRow(row, productMap = {}) {
    const sellerSku = row['Seller SKU'] || ''
    const matchedProduct = productMap[sellerSku]

    const parseNum = (val) => {
        if (!val) return 0
        return parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0
    }

    const parseDate = (val) => {
        if (!val) return null
        // TikTok format is usually DD/MM/YYYY HH:mm:ss or similar.
        // JS new Date() natively parses XX/YY/ZZZZ as MM/DD/YYYY, which is wrong for TikTok.

        // Match DD/MM/YYYY optionally followed by time
        const parts = String(val).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)/)
        if (parts) {
            // parts: 1=DD, 2=MM, 3=YYYY, 4=Time portion
            const day = parseInt(parts[1], 10)
            const month = parseInt(parts[2], 10) - 1 // JS months are 0-indexed
            const year = parseInt(parts[3], 10)

            // Reconstruct the date string in a format that JS parses safely (YYYY-MM-DD)
            const safeDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}${parts[4] || ''}`

            const d = new Date(safeDateStr)
            if (!isNaN(d.getTime())) return d.toISOString()
        }

        // Fallback
        const d = new Date(val)
        if (!isNaN(d.getTime())) return d.toISOString()
        return null
    }

    return {
        order_id: row['Order ID'] || '',
        order_status: row['Order Status'] || '',
        cancel_type: row['Cancelation/Return Type'] || '',
        seller_sku: sellerSku,
        product_name: matchedProduct || row['Product Name'] || '',
        variation: row['Variation'] || '',
        quantity: parseInt(row['Quantity']) || 0,
        sku_original_price: parseNum(row['SKU Unit Original Price']),
        sku_subtotal_before_discount: parseNum(row['SKU Subtotal Before Discount']),
        sku_platform_discount: parseNum(row['SKU Platform Discount']),
        sku_seller_discount: parseNum(row['SKU Seller Discount']),
        sku_subtotal_after_discount: parseNum(row['SKU Subtotal After Discount']),
        shipping_fee: parseNum(row['Shipping Fee After Discount']),
        order_amount: parseNum(row['Order Amount']),
        order_date: parseDate(row['Created Time']),
        paid_time: parseDate(row['Paid Time']),
        delivered_time: parseDate(row['Delivered Time']),
        tracking_id: row['Tracking ID'] || '',
        shipping_provider: row['Shipping Provider Name'] || '',
        buyer_username: row['Buyer Username'] || '',
        recipient: row['Recipient'] || '',
        phone: row['Phone #'] || '',
        payment_method: row['Payment Method'] || '',
        warehouse_name: row['Warehouse Name'] || '',
    }
}

/**
 * Maps TikTok Finance export rows to the DB model
 */
export function mapTiktokFinanceRow(row) {
    const parseNum = (val) => {
        if (!val) return 0
        const str = String(val).replace(/,/g, '') // remove commas if any
        const num = parseFloat(str)
        return isNaN(num) ? 0 : num
    }

    const parseDate = (val) => {
        if (!val) return null

        const parts = String(val).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)/)
        if (parts) {
            const day = parseInt(parts[1], 10)
            const month = parseInt(parts[2], 10) - 1
            const year = parseInt(parts[3], 10)
            const safeDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}${parts[4] || ''}`

            const d = new Date(safeDateStr)
            if (!isNaN(d.getTime())) return d.toISOString()
        }

        const d = new Date(val)
        if (!isNaN(d.getTime())) return d.toISOString()
        return null
    }

    // Helper to find key case-insensitively
    const getVal = (keyNames) => {
        const lowerRow = {}
        Object.keys(row).forEach(k => lowerRow[k.toLowerCase()] = row[k])
        for (const kn of keyNames) {
            if (row[kn] !== undefined && row[kn] !== null && row[kn] !== '') return row[kn]
            if (lowerRow[kn.toLowerCase()] !== undefined && lowerRow[kn.toLowerCase()] !== null && lowerRow[kn.toLowerCase()] !== '') return lowerRow[kn.toLowerCase()]
        }
        return ''
    }

    // Usually settlement amounts from TikTok are positive, 
    return {
        order_id: getVal(['Order/adjustment ID', 'Order ID']),
        store: getVal(['Store']),
        settlement_date: parseDate(getVal(['Creation date', 'Order settled time', 'Created Time'])),
        pencairan: parseNum(getVal(['Total estimated settlement amount', 'Total settlement amount'])),
        harga_jual: parseNum(getVal(['Total Revenue'])),
        platform_fee: parseNum(getVal(['Total Fees']))
    }
}

/**
 * Maps TikTok Failed COD / Return export rows to the DB model
 */
export function mapTiktokFailedCodRow(row) {
    const parseDate = (val) => {
        if (!val) return null
        const parts = String(val).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)/)
        if (parts) {
            const day = parseInt(parts[1], 10)
            const month = parseInt(parts[2], 10) - 1
            const year = parseInt(parts[3], 10)
            const safeDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}${parts[4] || ''}`
            const d = new Date(safeDateStr)
            if (!isNaN(d.getTime())) return d.toISOString()
        }
        const d = new Date(val)
        if (!isNaN(d.getTime())) return d.toISOString()
        return null
    }

    const getVal = (keyNames) => {
        const lowerRow = {}
        Object.keys(row).forEach(k => lowerRow[k.toLowerCase()] = row[k])
        for (const kn of keyNames) {
            if (row[kn] !== undefined && row[kn] !== null && row[kn] !== '') return String(row[kn])
            if (lowerRow[kn.toLowerCase()] !== undefined && lowerRow[kn.toLowerCase()] !== null && lowerRow[kn.toLowerCase()] !== '') return String(lowerRow[kn.toLowerCase()])
        }
        return ''
    }

    return {
        order_id: getVal(['Order ID', 'Order/adjustment ID']),
        tracking_id: getVal(['Tracking ID', 'Resi', 'Waybill']),
        return_reason: getVal(['Return reason', 'Alasan pengembalian', 'Reason']),
        return_time: parseDate(getVal(['Return time', 'Waktu pengembalian', 'Created Date'])),
    }
}
