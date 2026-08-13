import FAQItem from '../components/FAQItem';
import { Search, HelpCircle } from 'lucide-react';
import React from 'react';

const faqs = [
  {
    question: 'How can I book an appointment?',
    answer: 'You can book an appointment through our website by clicking the "Book Appointment" button, or by calling our help desk at +234 803 123 4567. We also offer walk-in appointments for general consultations.'
  },
  {
    question: 'Do you provide emergency services?',
    answer: 'Yes, we provide 24/7 emergency medical services. Our emergency department is equipped with advanced life support systems and staffed by rapid response teams of specialists.'
  },
  {
    question: 'What are the visiting hours?',
    answer: 'General visiting hours are from 10:00 AM to 12:00 PM and 4:00 PM to 7:00 PM daily. However, hours may vary by department (e.g., ICU has more restricted hours). Please check with the specific department for details.'
  },
  {
    question: 'Do you accept insurance?',
    answer: 'We accept most major health insurance plans. Please bring your insurance card with you at the time of your visit. You can also contact our billing department to verify if your specific plan is covered.'
  },
  {
    question: 'How do I get my medical reports?',
    answer: 'Medical reports can be collected from our diagnostic center, or you can access them through our secure patient portal using your patient ID. We also offer the option to have reports emailed or sent via WhatsApp.'
  },
  {
    question: 'Is there parking available at the hospital?',
    answer: 'Yes, we have a large multi-level parking facility available for patients and visitors. Parking is free for the first 2 hours for patients.'
  }
];

export default function FAQ() {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-blue-600 py-24 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-6 backdrop-blur-md">
            <HelpCircle className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">Frequently Asked Questions</h1>
          <p className="text-blue-100 max-w-2xl mx-auto text-lg">
            Find answers to common questions about our services, appointments, and hospital policies.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Search */}
        <div className="relative mb-12">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search for questions..."
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white shadow-xl border-none focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* FAQ List */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 md:p-12">
          {filteredFaqs.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {filteredFaqs.map((faq, i) => (
                <FAQItem key={i} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-slate-500">No matching questions found.</p>
            </div>
          )}
        </div>

        {/* Still have questions? */}
        <div className="mt-16 text-center">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Still have questions?</h3>
          <p className="text-slate-600 mb-8">If you couldn't find the answer you're looking for, please contact our support team.</p>
          <a
            href="/contact"
            className="inline-flex items-center px-8 py-3 bg-slate-900 text-white rounded-full font-bold hover:bg-slate-800 transition-all"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
