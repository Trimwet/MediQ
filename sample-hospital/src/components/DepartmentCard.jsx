import React from 'react';
import { motion } from 'motion/react';
import * as Icons from 'lucide-react';

export default function DepartmentCard({ department }) {
  const IconComponent = Icons[department.icon];

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-xl transition-all border border-slate-100 flex flex-col items-center justify-center text-center group h-full"
    >
      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors duration-300">
        {IconComponent && <IconComponent className="h-8 w-8 text-blue-600 group-hover:text-white transition-colors duration-300" />}
      </div>
      <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors leading-tight">
        {department.title}
      </h3>
    </motion.div>
  );
}
