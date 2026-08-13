export interface FAQ {
  question: string
  answer: string
}

export const faqs: FAQ[] = [
  {
    question: 'How can I book an appointment?',
    answer:
      'You can book an appointment through our website by clicking the "Book Appointment" button, or by calling our help desk at +234 803 123 4567. We also offer walk-in appointments for general consultations.',
  },
  {
    question: 'Do you provide emergency services?',
    answer:
      'Yes, we provide 24/7 emergency medical services. Our emergency department is equipped with advanced life support systems and staffed by rapid response teams of specialists.',
  },
  {
    question: 'What are the visiting hours?',
    answer:
      'General visiting hours are from 10:00 AM to 12:00 PM and 4:00 PM to 7:00 PM daily. However, hours may vary by department (e.g., ICU has more restricted hours). Please check with the specific department for details.',
  },
  {
    question: 'Do you accept insurance?',
    answer:
      'We accept most major health insurance plans. Please bring your insurance card with you at the time of your visit. You can also contact our billing department to verify if your specific plan is covered.',
  },
  {
    question: 'How do I get my medical reports?',
    answer:
      'Medical reports can be collected from our diagnostic center, or you can access them through our secure patient portal using your patient ID. We also offer the option to have reports emailed or sent via WhatsApp.',
  },
  {
    question: 'Is there parking available at the hospital?',
    answer:
      'Yes, we have a large multi-level parking facility available for patients and visitors. Parking is free for the first 2 hours for patients.',
  },
]
