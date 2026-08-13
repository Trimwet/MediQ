import { ContentSection } from '../components/content-section'
import { FacilityForm } from './facility-form'

export function SettingsFacility() {
  return (
    <ContentSection
      title='Facility'
      desc='Configure how your clinic operates day to day.'
    >
      <FacilityForm />
    </ContentSection>
  )
}
