import { useParams, Link } from "react-router-dom";
import { departments } from "../data/departments";

export default function DepartmentDetails() {
    const { id } = useParams();

    const dept = departments.find((d) => d.id === id);

    if (!dept) return <p>Department not found</p>;

    return (
        <div className="max-w-5xl mx-auto px-4 py-20">

            {/* 🔙 Back Button */}
            <Link
                to="/departments"
                className="inline-flex items-center gap-2 text-blue-600 font-semibold hover:translate-x-[-4px] transition mb-6"
            >
                ← Back to Departments
            </Link>

            {/* 🏥 Title */}
            <h1 className="text-4xl font-bold mb-4">{dept.title}</h1>
            <p className="text-slate-600 mb-6">{dept.description}</p>

            {/* 🖼 Image */}
            <img
                src={dept.image}
                alt={dept.title}
                className="w-full h-64 object-cover rounded-2xl mb-8"
            />

            {/* 📄 Full Details */}
            <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-3 text-slate-800">
                    About Department
                </h2>
                <p className="text-slate-600 leading-relaxed">
                    {dept.details}
                </p>
            </div>

            {/* 🛠 Services */}
            <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-3 text-slate-800">
                    Services We Provide
                </h2>

                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {dept.services.map((service, index) => (
                        <li
                            key={index}
                            className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium"
                        >
                            ✔ {service}
                        </li>
                    ))}
                </ul>
            </div>

            {/* 👨‍⚕️ Doctor Message */}
            <div className="bg-slate-100 p-6 rounded-2xl">
                <h2 className="text-xl font-semibold mb-2 text-slate-800">
                    Doctor’s Message
                </h2>
                <p className="text-slate-600 italic">
                    "{dept.doctorMessage}"
                </p>
            </div>

        </div>
    );
}