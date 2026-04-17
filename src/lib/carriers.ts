/**
 * Carrier detection utility
 * Detects US carriers based on tracking number patterns
 */

export interface CarrierInfo {
  carrier: string
  carrierCode: string
  trackingUrl: string
}

/**
 * Detect carrier from tracking number
 * Supports: USPS, UPS, FedEx, DHL
 */
export function detectCarrier(trackingNumber: string): CarrierInfo {
  if (!trackingNumber) {
    return {
      carrier: 'Unknown',
      carrierCode: 'unknown',
      trackingUrl: '#',
    }
  }

  const tn = trackingNumber.trim()

  // UPS: starts with "1Z"
  if (tn.startsWith('1Z')) {
    return {
      carrier: 'UPS',
      carrierCode: 'ups',
      trackingUrl: `https://www.ups.com/track?tracknum=${tn}`,
    }
  }

  // USPS: starts with 94, 92, 93, or 20-22 digits
  if (tn.startsWith('94') || tn.startsWith('92') || tn.startsWith('93')) {
    return {
      carrier: 'USPS',
      carrierCode: 'usps',
      trackingUrl: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tn}`,
    }
  }

  if (tn.length >= 20 && tn.length <= 22 && /^\d+$/.test(tn)) {
    return {
      carrier: 'USPS',
      carrierCode: 'usps',
      trackingUrl: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tn}`,
    }
  }

  // FedEx: 12-15 digits or starts with 7
  if (tn.startsWith('7') && /^\d{12,15}$/.test(tn)) {
    return {
      carrier: 'FedEx',
      carrierCode: 'fedex',
      trackingUrl: `https://tracking.fedex.com/en/tracking/search?q=${tn}`,
    }
  }

  if (/^\d{12,15}$/.test(tn)) {
    // Could be FedEx or other - FedEx is common
    return {
      carrier: 'FedEx',
      carrierCode: 'fedex',
      trackingUrl: `https://tracking.fedex.com/en/tracking/search?q=${tn}`,
    }
  }

  // DHL: usually 10-digit number or specific pattern
  if (tn.match(/^\d{10}$/) || tn.match(/^\d{11}$/)) {
    return {
      carrier: 'DHL',
      carrierCode: 'dhl',
      trackingUrl: `https://www.dhl.com/en/express/tracking.html?AWB=${tn}`,
    }
  }

  // Default to unknown
  return {
    carrier: 'Unknown',
    carrierCode: 'unknown',
    trackingUrl: '#',
  }
}

/**
 * Get carrier code from carrier name
 */
export function getCarrierCode(carrierName: string): string {
  const name = (carrierName || '').toLowerCase()
  if (name.includes('ups')) return 'ups'
  if (name.includes('usps')) return 'usps'
  if (name.includes('fedex')) return 'fedex'
  if (name.includes('dhl')) return 'dhl'
  return 'other'
}
