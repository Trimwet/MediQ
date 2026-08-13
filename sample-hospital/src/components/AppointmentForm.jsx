import React from 'react';
import { motion } from 'framer-motion';
import { departments } from '../data/departments';
import { doctors } from '../data/doctors';
import { CheckCircle2, Send } from 'lucide-react';

export default function AppointmentForm() {
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);

  const [formData, setFormData] = React.useState({
    name: '',
    phone: '',
    email: '',
    department: '',
    doctor: '',
    date: '',
    time: '',
    message: ''
  });

  // ✅ Filter doctors based on department
  const filteredDoctors = doctors.filter(
    (d) => !formData.department || d.department === formData.department
  );

  const handleSubmit = (e) => {
    e.preventDefault();

    console.log('Appointment Data:', formData);

    setIsSubmitted(true);

    setTimeout(() => {
      setIsSubmitted(false);

      // 🔥 force new form
      setFormKey(prev => prev + 1);

      setFormData({
        name: '',
        phone: '',
        email: '',
        department: '',
        doctor: '',
        date: '',
        time: '',
        message: ''
      });

    }, 3000);
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-blue-900/5 border border-slate-100 overflow-hidden">
      {isSubmitted ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-12 text-center"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">
            Appointment Requested!
          </h3>
          <p className="text-slate-500">
            We have received your request and will contact you shortly.
          </p>
        </motion.div>
      ) : (
        <form key={formKey} onSubmit={handleSubmit} className="p-8 md:p-12 space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Name */}
            <div>
              <label className="text-sm font-semibold">Patient Full Name</label>
              <input
                required
                type="text"
                className="w-full px-4 py-3 rounded-xl border"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            {/* Phone */}
            <div>
              <label className="text-sm font-semibold">Phone Number</label>
              <input
                required
                type="tel"
                className="w-full px-4 py-3 rounded-xl border"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </div>

            {/* Email */}
            <div>
              <label className="text-sm font-semibold">Email</label>
              <input
                required
                type="email"
                className="w-full px-4 py-3 rounded-xl border"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>

            {/* Department */}
            <div>
              <label className="text-sm font-semibold">Department</label>
              <select
                required
                className="w-full px-4 py-3 rounded-xl border"
                value={formData.department}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    department: e.target.value,
                    doctor: ''
                  })
                }
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Doctor */}
            <div>
              <label className="text-sm font-semibold">Doctor</label>
              <select
                required
                disabled={!formData.department}
                className="w-full px-4 py-3 rounded-xl border"
                value={formData.doctor}
                onChange={(e) =>
                  setFormData({ ...formData, doctor: e.target.value })
                }
              >
                <option value="">Select Doctor</option>
                {filteredDoctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="text-sm font-semibold">Date</label>
              <input
                required
                type="date"
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-3 rounded-xl border"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
              />
            </div>

            {/* Time */}
            <div>
              <label className="text-sm font-semibold">Time</label>
              <input
                required
                type="time"
                className="w-full px-4 py-3 rounded-xl border"
                value={formData.time}
                onChange={(e) =>
                  setFormData({ ...formData, time: e.target.value })
                }
              />
            </div>

          </div>

          {/* Message */}
          <div>
            <label className="text-sm font-semibold">Message</label>
            <textarea
              rows={4}
              className="w-full px-4 py-3 rounded-xl border"
              value={formData.message}
              onChange={(e) =>
                setFormData({ ...formData, message: e.target.value })
              }
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center"
          >
            Confirm Appointment
            <Send className="ml-2 h-5 w-5" />
          </button>

        </form>
      )}
    </div>
  );
}