import { useParams, Link, useNavigate } from 'react-router-dom';
import { doctors } from '../data/doctors';
import { motion } from 'motion/react';
import { Calendar, GraduationCap, Briefcase, Clock, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function DoctorProfile() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const doctor = doctors.find(d => d.id === doctorId);

  if (!doctor) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Doctor not found</h2>
        <Link to="/doctors" className="text-blue-600 font-semibold hover:underline">Back to Doctors</Link>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Header / Back Button */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-slate-600 hover:text-blue-600 transition-colors font-medium"
        >
          <ArrowLeft className="mr-2 h-5 w-5" /> Back to List
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Column: Image & Basic Info */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-100 p-4"
            >
              <img
                src={doctor.image}
                alt={doctor.name}
                className="w-full aspect-square object-cover rounded-2xl mb-6"
                referrerPolicy="no-referrer"
              />
              <div className="text-center">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">{doctor.name}</h1>
                <p className="text-blue-600 font-semibold text-lg mb-4">{doctor.specialization}</p>
                <div className="flex items-center justify-center space-x-4 text-slate-500 text-sm">
                  <span className="flex items-center"><Briefcase className="h-4 w-4 mr-1" /> {doctor.experience}</span>
                  <span className="flex items-center"><CheckCircle2 className="h-4 w-4 mr-1 text-emerald-500" /> Verified</span>
                </div>
              </div>
              <div className="mt-8">
                <Link
                  to="/appointment"
                  className="block w-full text-center py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                >
                  Book Appointment
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Detailed Info */}
          <div className="lg:col-span-2 space-y-8">
            {/* Biography */}
            <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Biography</h2>
              <p className="text-slate-600 leading-relaxed text-lg">
                {doctor.bio}
              </p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Education */}
              <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mr-3">
                    <GraduationCap className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Education</h2>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  {doctor.education}
                </p>
              </section>

              {/* Schedule */}
              <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mr-3">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Available Schedule</h2>
                </div>
                <ul className="space-y-3">
                  {doctor.schedule.map((time, i) => (
                    <li key={i} className="flex items-center text-slate-600">
                      <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                      {time}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* Experience Section */}
            <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Expertise & Experience</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  'Advanced Diagnostics',
                  'Patient-Centered Care',
                  'Clinical Research',
                  'Surgical Excellence',
                  'Preventive Medicine',
                  'Emergency Response'
                ].map((item, i) => (
                  <div key={i} className="flex items-center p-4 bg-slate-50 rounded-xl">
                    <CheckCircle2 className="h-5 w-5 text-blue-600 mr-3" />
                    <span className="text-slate-700 font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
