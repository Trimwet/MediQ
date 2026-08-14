import AppointmentForm from '../components/AppointmentForm';
import { Calendar, Clock, ShieldCheck, Phone } from 'lucide-react';

export default function Appointment() {
  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-slate-900 py-24 text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">Book Your Appointment</h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg leading-relaxed">
            Take the first step towards better health. Fill out the form below and our team will get back to you to confirm your visit.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Form Column */}
          <div className="lg:col-span-2">
            <AppointmentForm />
          </div>

          {/* Info Column */}
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Why Book With Us?</h3>
              <div className="space-y-6">
                {[
                  { icon: Calendar, title: 'Easy Scheduling', desc: 'Choose your preferred date and time for consultation.' },
                  { icon: Clock, title: 'Minimal Wait Time', desc: 'We value your time and strive to keep appointments on schedule.' },
                  { icon: ShieldCheck, title: 'Secure & Private', desc: 'Your medical information is handled with complete confidentiality.' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start space-x-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                      <item.icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 mb-1">{item.title}</h4>
                      <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-600 p-8 rounded-3xl text-white shadow-xl shadow-blue-900/20">
              <h3 className="text-xl font-bold mb-4">Need Emergency Help?</h3>
              <p className="text-blue-100 mb-6">If you have a medical emergency, please call our 24/7 hotline immediately.</p>
              <a
                href="tel:+2349063546728"
                className="flex items-center justify-center w-full py-4 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-all"
              >
                <Phone className="mr-2 h-5 w-5" /> +234 906 354 6728
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
