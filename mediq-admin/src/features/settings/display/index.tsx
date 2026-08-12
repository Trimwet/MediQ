import { ContentSection } from '../components/content-section'
import { DisplayForm } from './display-form'

export function SettingsDisplay() {
  return (
    <ContentSection
      title='Display'
      desc='Customize the language, formats, and pagination used in the app.'
    >
      <DisplayForm />
    </ContentSection>
  )
}
