import { ContentSection } from '../components/content-section'
import { AccountForm } from './account-form'

export function SettingsAccount() {
  return (
    <ContentSection
      title='Account'
      desc='Manage your password, email preferences, and security settings.'
    >
      <AccountForm />
    </ContentSection>
  )
}
