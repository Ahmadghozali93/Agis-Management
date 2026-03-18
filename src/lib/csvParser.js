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
        const hasIdentifier = row.some(cell => {
            const val = String(cell).toLowerCase()
            return val.includes('order id') || 
                   val.includes('order/adjustment id') || 
                   val.includes('tracking id') || 
                   val.includes('resi') || 
                   val.includes('stt number') ||
                   val.includes('waybill')
        })
        if (hasIdentifier) return r
    }
    return 0 // Fallback to first row
}

/**
 * Parse Excel ArrayBuffer into array of objects
 */
export function parseXLSX(buffer) {
    const workbook = XLSX.read(buffer, { type: 'array', cellText: true, cellDates: true })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]

    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' })
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
            if (h) {
                let val = row[idx]
                // Force long numeric IDs to string to prevent scientific notation/loss of precision
                if (typeof val === 'number' && (h.toLowerCase().includes('id') || val > 1000000000000)) {
                    val = String(val)
                }
                obj[h] = val !== undefined ? val : ''
            }
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
        const hasIdentifier = res.row.some(cell => {
            const val = String(cell).toLowerCase()
            return val.includes('order id') || 
                   val.includes('order/adjustment id') ||
                   val.includes('tracking id') ||
                   val.includes('resi') ||
                   val.includes('stt number') ||
                   val.includes('waybill')
        })
        if (hasIdentifier) {
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
    const sellerSku = (row['Seller SKU'] || '').trim()
    const matchedProduct = productMap[sellerSku.toLowerCase()]

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
        if (val === undefined || val === null || val === '') return 0
        if (typeof val === 'number') return val

        let str = String(val).replace(/Rp\s?|[\s%]/gi, '').trim()
        if (!str) return 0

        // Count dots and commas
        const dots = (str.match(/\./g) || []).length
        const commas = (str.match(/,/g) || []).length

        // If both present, identify thousands vs decimal
        if (dots > 0 && commas > 0) {
            if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
                // ID format: 1.234,56
                str = str.replace(/\./g, '').replace(',', '.')
            } else {
                // US format: 1,234.56
                str = str.replace(/,/g, '')
            }
        }
        // If only commas and more than one, or followed by 3 digits (1,000)
        else if (commas > 0 && (commas > 1 || /,\d{3}($|\D)/.test(str))) {
            str = str.replace(/,/g, '')
        }
        // If only dots and more than one, or followed by 3 digits (1.000)
        else if (dots > 0 && (dots > 1 || /\.\d{3}($|\D)/.test(str))) {
            str = str.replace(/\./g, '')
        }
        // If only one comma and it looks like a decimal (123,45)
        else if (commas === 1 && /,\d{2}$/.test(str)) {
            str = str.replace(',', '.')
        }
        // Fallback: just remove commas for standard parseFloat behavior
        else {
            str = str.replace(/,/g, '')
        }

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
        order_id: String(getVal(['Order/adjustment ID', 'Order ID', 'ID pesanan', 'ID penyesuaian/pesanan', 'Order/Adjustment ID'])).trim(),
        store: getVal(['Store', 'Toko']),
        settlement_date: parseDate(getVal(['Creation date', 'Order settled time', 'Created Time', 'Waktu penyelesaian pesanan', 'Tanggal pembuatan'])),
        pencairan: parseNum(getVal(['Total estimated settlement amount', 'Total settlement amount', 'Settlement amount', 'Settlement Amount', 'Jumlah penyelesaian', 'Estimasi jumlah penyelesaian'])),
        harga_jual: parseNum(getVal(['Total Revenue', 'Pendapatan total', 'Harga Jual'])),
        platform_fee: parseNum(getVal(['Total Fees', 'Biaya total', 'Platform Fee', 'Potongan Platform']))
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

/**
 * Maps Mengantar export rows to the DB model
 * Actual file headers: Expedition, Order ID, Tracking ID, STT Number, Customer Name, Customer Phone Number,
 * Customer Address, Province, Subdistrict, City, ZIP Code, Weight, COD, Product Value, Product ID, 
 * Goods Description, Quantity, Diskon Persentase, Diskon Nominal, Harga Barang Setelah Diskon, COGS, 
 * Sender Name, Sender Phone Number, Create Date, Last Update, Last Status, Shipping Fee,
 * Shipping Discount, COD Fee (Inc VAT), Shipping Fee Without Discount,
 * Estimated Pricing, Origin Code, Destination Code
 */
export function mapMengantarRow(row) {
    const parseNum = (val) => {
        if (val === undefined || val === null || val === '') return 0
        if (typeof val === 'number') return val
        let str = String(val).replace(/[^0-9.,-]/g, '').trim()
        if (!str) return 0
        // Handle ID format (1.234,56) vs US format (1,234.56)
        const dots = (str.match(/\./g) || []).length
        const commas = (str.match(/,/g) || []).length
        if (dots > 0 && commas > 0) {
            if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
                str = str.replace(/\./g, '').replace(',', '.')
            } else {
                str = str.replace(/,/g, '')
            }
        } else if (commas > 0 && (commas > 1 || /,\d{3}($|\D)/.test(str))) {
            str = str.replace(/,/g, '')
        } else if (dots > 0 && (dots > 1 || /\.\d{3}($|\D)/.test(str))) {
            str = str.replace(/\./g, '')
        } else if (commas === 1 && /,\d{2}$/.test(str)) {
            str = str.replace(',', '.')
        } else {
            str = str.replace(/,/g, '')
        }
        return parseFloat(str) || 0
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

    const getVal = (keyNames) => {
        const lowerRow = {}
        Object.keys(row).forEach(k => lowerRow[k.toLowerCase().trim()] = row[k])
        for (const kn of keyNames) {
            if (row[kn] !== undefined && row[kn] !== null && row[kn] !== '') return String(row[kn])
            const lower = kn.toLowerCase().trim()
            if (lowerRow[lower] !== undefined && lowerRow[lower] !== null && lowerRow[lower] !== '') return String(lowerRow[lower])
        }
        return ''
    }

    // Strip leading apostrophe added by Excel when forcing text format (e.g. 'MGT001234 → MGT001234)
    const cleanId = (val) => (val || '').replace(/^'+/, '').trim()

    return {
        expedition: getVal(['Expedition', 'expedition', 'Ekspedisi']),
        order_id: cleanId(getVal(['Order ID', 'order_id'])),
        tracking_id: cleanId(getVal(['Tracking ID', 'tracking_id', 'Resi', 'AWB'])),
        stt_number: cleanId(getVal(['STT Number', 'stt_number', 'No STT'])),
        customer_name: getVal(['Customer Name', 'customer_name', 'Nama Konsumen']),
        customer_phone: getVal(['Customer Phone Number', 'customer_phone']),
        customer_address: getVal(['Customer Address', 'customer_address']),
        province: getVal(['Province', 'province', 'Provinsi']),
        city: getVal(['City', 'city', 'Kota']),
        weight: parseNum(getVal(['Weight', 'weight', 'Berat'])),
        cod: parseNum(getVal(['COD', 'cod'])),
        product_value: parseNum(getVal(['Product Value', 'product_value'])),
        product_id: getVal(['Product ID', 'product_id']),
        goods_description: getVal(['Goods Description', 'goods_description', 'Produk', 'Product Name']),
        quantity: parseInt(getVal(['Quantity', 'quantity', 'Qty'])) || 0,
        diskon_persentase: parseNum(getVal(['Diskon Persentase', 'diskon_persentase', 'Diskon %'])),
        diskon_nominal: parseNum(getVal(['Diskon Nominal', 'diskon_nominal'])),
        harga_jual: parseNum(getVal(['Harga Barang Setelah Diskon', 'harga_setelah_diskon', 'Harga Jual', 'harga_jual'])), // Backwards compatible fallback to Harga Jual if missing
        harga_setelah_diskon: parseNum(getVal(['Harga Barang Setelah Diskon', 'harga_setelah_diskon'])),
        cogs: parseNum(getVal(['COGS', 'cogs', 'HPP'])),
        sender_name: getVal(['Sender Name', 'sender_name']),
        create_date: parseDate(getVal(['Create Date', 'create_date', 'Tanggal'])),
        last_update: parseDate(getVal(['Last Update', 'last_update'])),
        timestamp: new Date().toISOString(),
        last_status: 'Dikirim',
        last_pod_status: getVal(['Last POD Status', 'last_pod_status']),
        shipping_fee: parseNum(getVal(['Shipping Fee', 'shipping_fee', 'Ongkir'])),
        shipping_discount: parseNum(getVal(['Shipping Discount', 'shipping_discount'])),
        cod_fee: parseNum(getVal(['COD Fee (Inc VAT)', 'cod_fee', 'COD Fee'])),
        shipping_fee_without_discount: parseNum(getVal(['Shipping Fee Without Discount', 'shipping_fee_without_discount'])),
        estimated_pricing: parseNum(getVal(['Estimated Pricing', 'estimated_pricing'])),
        origin_code: getVal(['Origin Code', 'origin_code']),
        destination_code: getVal(['Destination Code', 'destination_code'])
    }
}

/**
 * Maps Mengantar Finance export rows to the DB model
 * Expected headers: Date, Description, Tracking ID, Courier, Customer Name, 
 * Customer Phone Number, Goods Description, Quantity, Sender Name, COD Value, 
 * Discounted Shipping Fee, Estimated Pricing, COD Fee (inc tax), Total
 */
export function mapMengantarFinanceRow(row) {
    const parseNum = (val) => {
        if (val === undefined || val === null || val === '') return 0
        if (typeof val === 'number') return val
        let str = String(val).replace(/[^0-9.,-]/g, '').trim()
        if (!str) return 0
        const dots = (str.match(/\./g) || []).length
        const commas = (str.match(/,/g) || []).length
        if (dots > 0 && commas > 0) {
            if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
                str = str.replace(/\./g, '').replace(',', '.')
            } else {
                str = str.replace(/,/g, '')
            }
        } else if (commas > 0 && (commas > 1 || /,\d{3}($|\D)/.test(str))) {
            str = str.replace(/,/g, '')
        } else if (dots > 0 && (dots > 1 || /\.\d{3}($|\D)/.test(str))) {
            str = str.replace(/\./g, '')
        } else if (commas === 1 && /,\d{2}$/.test(str)) {
            str = str.replace(',', '.')
        } else {
            str = str.replace(/,/g, '')
        }
        return parseFloat(str) || 0
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

    const getVal = (keyNames) => {
        const lowerRow = {}
        Object.keys(row).forEach(k => lowerRow[k.toLowerCase().trim()] = row[k])
        for (const kn of keyNames) {
            if (row[kn] !== undefined && row[kn] !== null && row[kn] !== '') return String(row[kn])
            const lower = kn.toLowerCase().trim()
            if (lowerRow[lower] !== undefined && lowerRow[lower] !== null && lowerRow[lower] !== '') return String(lowerRow[lower])
        }
        return ''
    }

    // Strip leading apostrophe added by Excel (e.g. 'MGT001234 → MGT001234)
    const cleanId = (val) => (val || '').replace(/^'+/, '').trim()

    return {
        date: parseDate(getVal(['Date', 'date', 'Tanggal'])),
        description: getVal(['Description', 'description', 'Deskripsi']),
        tracking_id: cleanId(getVal(['Tracking ID', 'tracking_id', 'Resi'])),
        courier: getVal(['Courier', 'courier', 'Kurir', 'Ekspedisi']),
        customer_name: getVal(['Customer Name', 'customer_name', 'Nama Konsumen']),
        customer_phone: getVal(['Customer Phone Number', 'customer_phone']),
        goods_description: getVal(['Goods Description', 'goods_description', 'Produk']),
        quantity: parseInt(getVal(['Quantity', 'quantity', 'Qty'])) || 0,
        sender_name: getVal(['Sender Name', 'sender_name', 'Pengirim']),
        cod_value: parseNum(getVal(['COD Value', 'cod_value', 'COD'])),
        discounted_shipping_fee: parseNum(getVal(['Discounted Shipping Fee', 'discounted_shipping_fee'])),
        estimated_pricing: parseNum(getVal(['Estimated Pricing', 'estimated_pricing'])),
        cod_fee: parseNum(getVal(['COD Fee (inc tax)', 'cod_fee', 'COD Fee'])),
        total: parseNum(getVal(['Total', 'total']))
    }
}
