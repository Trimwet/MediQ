import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { UserRound } from 'lucide-react';

export default function DoctorCard({ doctor }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white p-6 lg:p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all border border-slate-100 flex flex-col items-center justify-center text-center h-full group"
    >
      <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-5 group-hover:bg-blue-600 transition-colors duration-300">
        <UserRound className="h-8 w-8 text-blue-600 group-hover:text-white transition-colors duration-300" />
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-2 leading-tight">{doctor.name}</h3>
      <p className="text-blue-600 font-semibold mb-6 flex-grow">{doctor.specialization}</p>
      
      <div className="w-full mt-auto pt-6 border-t border-slate-100">
        <Link
          to="/appointment"
          className="w-full block text-center py-3 bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-900 hover:text-white transition-colors"
        >
          Book Appointment
        </Link>
      </div>
    </motion.div>
  );
}
