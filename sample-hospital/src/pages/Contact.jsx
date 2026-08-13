import { Mail, Phone, MapPin, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import React from 'react';

export default function Contact() {

  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);

  const handleSubmit = (e) => {
    e.preventDefault();

    setIsSubmitted(true);

    setTimeout(() => {
      setIsSubmitted(false);
      setFormKey(prev => prev + 1);
    }, 3000);
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-slate-900 py-24 text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">Get in Touch</h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg leading-relaxed">
            Have questions or need assistance? Our team is here to help you 24/7. Reach out to us through any of the channels below.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* Contact Info */}
          <div className="lg:col-span-1 space-y-6">
            {[
              { icon: Phone, title: 'Primary Call', info: '+234 803 123 4567', sub: '24/7 Availability', color: 'bg-blue-600' },
              { icon: Phone, title: 'Secondary', info: '+234 807 234 5678', sub: 'Support & Inquiry', color: 'bg-teal-600' },
              { icon: Mail, title: 'Email Us', info: 'rayfieldhospital2026@gmail.com', sub: 'General Inquiries', color: 'bg-slate-800' },
              { icon: MapPin, title: 'Visit Us', info: 'Rayfield Road, Jos', sub: 'Plateau State, Nigeria', color: 'bg-blue-500' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center space-x-4"
              >
                <div className={`${item.color} w-12 h-12 rounded-2xl flex items-center justify-center shrink-0`}>
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{item.title}</h4>
                  <p className="text-lg font-bold text-slate-900">{item.info}</p>
                  <p className="text-sm text-slate-400">{item.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-xl shadow-blue-900/5 border border-slate-100 p-8 md:p-12">

              {isSubmitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-20"
                >
                  <h3 className="text-2xl font-bold text-green-600 mb-2">
                    Successfully Submitted!
                  </h3>
                  <p className="text-slate-500">
                    We will get back to you shortly.
                  </p>
                </motion.div>
              ) : (

                <>
                  <h2 className="text-2xl font-bold text-slate-900 mb-8">Send us a Message</h2>

                  <form key={formKey} onSubmit={handleSubmit} className="space-y-6">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Full Name</label>
                        <input
                          required
                          type="text"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Email Address</label>
                        <input
                          required
                          type="email"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>

                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Subject</label>
                      <input
                        required
                        type="text"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Message</label>
                      <textarea
                        required
                        rows={5}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      ></textarea>
                    </div>

                    <button className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center">
                      Send Message
                      <Send className="ml-2 h-5 w-5" />
                    </button>

                  </form>
                </>
              )}

            </div>
          </div>
        </div>

        {/* Map */}
        <div className="mt-24 bg-white rounded-[3rem] overflow-hidden shadow-xl border border-slate-100 h-[450px] relative">
          <iframe
            src="https://www.google.com/maps?q=Rayfield,+Jos,+Plateau+State,+Nigeria&output=embed"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
          ></iframe>
        </div>

      </div>
    </div>
  );
}