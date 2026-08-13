import { motion } from 'motion/react';
import { Shield, Target, Eye, Award, Users, Heart } from 'lucide-react';

export default function About() {
  return (
    <div className="pb-24">
      {/* Hero Section */}
      <section className="bg-slate-900 py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600/10 blur-3xl rounded-full translate-x-1/2"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-8 leading-tight">
              Dedicated to Your <span className="text-blue-500">Health and Well-being</span>
            </h1>
            <p className="text-xl text-slate-400 leading-relaxed">
              Since our founding in 1995, Rayfield Multispecialty Hospital has been at the forefront of medical excellence, providing compassionate care and innovative treatments to our community.
            </p>
          </div>
        </div>
      </section>


      {/* Content Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-8 tracking-tight">Over 25 Years of Medical Excellence</h2>
            <div className="space-y-6 text-slate-600 text-lg leading-relaxed">
              <p>
                Rayfield Multispecialty Hospital started as a small clinic with a big dream: to bring world-class healthcare to everyone. Today, we are a multi-specialty hospital with over 500 beds and 150+ specialists.
              </p>
              <p>
                Our commitment to patient safety and clinical quality has earned us numerous awards and international accreditations. We continuously invest in the latest medical technologies, from robotic surgery to advanced diagnostic imaging.
              </p>
              <div className="grid grid-cols-2 gap-6 pt-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="font-semibold text-slate-900">150+ Specialists</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Heart className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="font-semibold text-slate-900">50k+ Happy Patients</span>
                </div>
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <img
              src="https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=1000"
              alt="Hospital Interior"
              className="rounded-[3rem] shadow-2xl"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -bottom-8 -left-8 bg-white p-8 rounded-3xl shadow-xl border border-slate-100 hidden md:block">
              <div className="text-4xl font-bold text-blue-600 mb-1">25+</div>
              <div className="text-sm text-slate-500 font-semibold uppercase tracking-wider">Years of Experience</div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
