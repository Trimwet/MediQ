import { departments } from '../data/departments';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function Departments() {
  return (
    <div className="pb-24">

      {/* 🔥 Header */}
      <div className="bg-blue-600 py-24 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute w-full h-full bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            Our Specialists
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-blue-100 max-w-2xl mx-auto text-lg"
          >
            Comprehensive medical services across all major specialties.
          </motion.p>
        </div>
      </div>

      {/* 🔥 Grid */}
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">

          {departments.map((dept, i) => (
            <motion.div
              key={dept.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              {/* 🔥 CLICKABLE CARD */}
              <Link to={`/departments/${dept.id}`}>
                <div className="relative rounded-3xl overflow-hidden cursor-pointer group shadow-md hover:shadow-xl transition-all">

                  {/* Image */}
                  <img
                    src={dept.image}
                    alt={dept.title}
                    className="w-full h-40 object-cover group-hover:scale-110 transition duration-500"
                  />

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                  {/* Text */}
                  <div className="absolute bottom-0 p-4 w-full">
                    <h3 className="text-white font-bold text-sm">
                      {dept.title}
                    </h3>

                    <p className="text-xs text-gray-200 opacity-0 group-hover:opacity-100 transition mt-1">
                      {dept.description}
                    </p>
                  </div>

                </div>
              </Link>
            </motion.div>
          ))}

        </div>

        {/* 🔥 Info Section */}
        <div className="mt-28 bg-slate-900 rounded-[3rem] p-12 md:p-20 text-white relative overflow-hidden">

          <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600/20 blur-3xl rounded-full translate-x-1/2"></div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Can't find what you're looking for?
              </h2>

              <p className="text-slate-400 text-lg mb-8">
                We offer many more specialized services.
              </p>

              <div className="flex gap-4 flex-wrap">
                <a
                  href="tel:+2348031234567"
                  className="px-8 py-3 bg-blue-600 rounded-full font-bold hover:bg-blue-700 hover:scale-105 transition"
                >
                  Call Help Desk
                </a>

                <Link
                  to="/contact"
                  className="px-8 py-3 border border-white/20 rounded-full font-bold hover:bg-white/10 transition"
                >
                  Contact Us
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                'Emergency Care',
                'Diagnostic Lab',
                'Pharmacy',
                'Rehabilitation',
                'Health Checkups',
                'Telemedicine'
              ].map((item, i) => (
                <div
                  key={i}
                  className="p-4 bg-white/5 rounded-2xl border text-center hover:scale-105 transition"
                >
                  {item}
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}