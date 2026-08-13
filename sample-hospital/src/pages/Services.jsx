import { motion } from 'motion/react';
import { Activity, Beaker, Heart, ShieldPlus, Stethoscope, Microscope, Pill, Ambulance } from 'lucide-react';

const services = [
  {
    title: 'OPD Services',
    desc: 'Comprehensive outpatient consulting and treatment across various specializations.',
    image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773738187/1773731578212_d8fsov.png'
  },
  {
    title: 'ICU',
    desc: 'Intensive care unit equipped with advanced life support systems and 24/7 monitoring.',
    image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773738188/1773731576507_wtgl4e.png'
  },
  {
    title: 'Operation Theatre',
    desc: 'State-of-the-art operation theatres for safe and sterile surgical procedures.',
    image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773738188/1773731575184_nozwbi.png'
  },
  {
    title: 'X-Ray',
    desc: 'High-quality digital X-Ray imaging for quick and accurate diagnostics.',
    image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773738188/1773731573913_fop35p.png'
  },
  {
    title: 'ECG',
    desc: 'Electrocardiogram services for immediate heart condition assessment.',
    image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773738187/1773731568048_ie6oye.png'
  },
  {
    title: 'Lab',
    desc: 'Fully equipped medical laboratory for comprehensive blood and pathology tests.',
    image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773738188/1773731566417_lobnmz.png'
  },
  {
    title: 'Oxygen Supply',
    desc: 'Uninterrupted medical grade oxygen supply across triage and inpatient facilities.',
    image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773738187/1773731565144_fdj6y7.png'
  },
  {
    title: 'Medical Shop',
    desc: 'In-house pharmacy stocked with all essential medicines and supplies.',
    image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773738187/1773731563811_hwqwd4.png'
  },
  {
    title: 'Ambulance',
    desc: 'Rapid response ambulance services equipped with life-saving apparatus.',
    image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773738187/1773731553278_egjihy.png'
  },
  {
    title: 'Lift Available',
    desc: 'Dedicated elevator access ensuring easy mobility for patients and stretchers.',
    image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773738187/1773731517606_ayf4ur.png'
  },
  {
    title: 'Home Services',
    desc: 'Medical care, testing, and nursing services delivered at your doorstep.',
    image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773754155/1773731424239_kff2rq.png'
  }
];

export default function Services() {
  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-slate-50 py-24 text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight">Our Premium Services</h1>
          <p className="text-slate-600 max-w-2xl mx-auto text-lg leading-relaxed">
            We provide a wide range of medical services designed to meet all your healthcare needs under one roof.
          </p>
        </div>
      </div>

      {/* Services Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden"
            >
              <div className="h-48 w-full overflow-hidden bg-slate-100 relative">
                <img
                  src={service.image}
                  alt={service.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-blue-900/10 group-hover:bg-blue-900/0 transition-colors"></div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{service.title}</h3>
                <p className="text-slate-500 leading-relaxed text-sm flex-grow">{service.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Featured Service */}
        <div className="mt-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-blue-600 font-bold uppercase tracking-widest text-sm mb-4 block">Featured Service</span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">Advanced Telemedicine Services</h2>
            <p className="text-slate-600 text-lg leading-relaxed mb-8">
              Consult with our expert doctors from the comfort of your home. Our secure telemedicine platform allows you to have video consultations, share reports, and get prescriptions digitally.
            </p>
            <ul className="space-y-4 mb-10">
              {['Secure Video Calls', 'Digital Prescriptions', 'Report Sharing', 'Easy Scheduling'].map((item, i) => (
                <li key={i} className="flex items-center text-slate-700 font-medium">
                  <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center mr-3">
                    <Activity className="h-3 w-3 text-emerald-600" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
            <button className="px-10 py-4 bg-slate-900 text-white rounded-full font-bold hover:bg-slate-800 transition-all shadow-lg">
              Learn More About Telemedicine
            </button>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <img
              src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=1000"
              alt="Telemedicine Service"
              className="rounded-[3rem] shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
