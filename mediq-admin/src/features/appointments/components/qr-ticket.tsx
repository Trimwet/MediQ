import { format } from 'date-fns'
import { Printer } from 'lucide-react'
import { QrCode } from '@/components/ui/qr-code'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface QrTicketProps {
  appointmentId: string
  patientName: string
  scheduledFor: string
  doctorName: string
}

export function QrTicket({
  appointmentId,
  patientName,
  scheduledFor,
  doctorName,
}: QrTicketProps) {
  const qrValue = `${window.location.origin}/check-in?id=${appointmentId}`
  const when = format(new Date(scheduledFor), 'EEEE, MMM d • h:mm a')

  return (
    <Card className="w-full border-dashed">
      <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
        <QrCode value={qrValue} size={180} />

        <div className="space-y-1">
          <p className="text-sm font-semibold">Scan to check in</p>
          <p className="text-xs text-muted-foreground">
            Present this QR code at the clinic reception
          </p>
        </div>

        <dl className="w-full space-y-2 rounded-lg border bg-muted/40 p-4 text-start text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Patient</dt>
            <dd className="font-medium">{patientName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Doctor</dt>
            <dd className="font-medium">{doctorName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">When</dt>
            <dd className="font-medium">{when}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Reference</dt>
            <dd className="font-mono text-xs">{appointmentId}</dd>
          </div>
        </dl>

        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="print:hidden"
        >
          <Printer className="size-4" />
          Print ticket
        </Button>
      </CardContent>
    </Card>
  )
}
