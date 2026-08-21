import { QRCodeSVG } from 'qrcode.react'

export function QrCode({ value, size = 180 }: { value: string; size?: number }) {
  return <QRCodeSVG value={value} size={size} level="M" />
}
