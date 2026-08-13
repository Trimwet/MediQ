import { doctors } from '../data/doctors';
import DoctorCard from '../components/DoctorCard';
import { motion } from 'motion/react';
import { Search } from 'lucide-react';
import React from 'react';

export default function Doctors() {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredDoctors = doctors.filter(doc => 
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.specialization.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-slate-900 py-20 text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">Our Expert Doctors</h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Meet our team of highly qualified medical professionals dedicated to your well-being.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-16">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or specialization..."
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white shadow-xl border-none focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Doctors Grid */}
        {filteredDoctors.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredDoctors.map((doctor, i) => (
              <motion.div
                key={doctor.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <DoctorCard doctor={doctor} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-slate-500 text-lg">No doctors found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
