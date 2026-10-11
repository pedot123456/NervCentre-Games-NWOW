import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** A QR code drawn on the device (works offline): dark modules #0B1638, error correction M. */
export function Qr({ text, className = '' }: { text: string; className?: string }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let alive = true
    QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#0B1638', light: '#FFFFFF' } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(''))
    return () => {
      alive = false
    }
  }, [text])
  return (
    <div className={`rounded-2xl bg-white p-2 ${className}`} role="img" aria-label={`QR code: ${text}`}>
      <div className="size-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  )
}
