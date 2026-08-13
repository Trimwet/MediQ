import React from "react";

export const departments = [
    {
        id: 'general-medicine',
        title: 'General Medicine',
        description: 'Treatment for common illnesses and overall health care',
        details: `Our General Medicine department provides complete care for everyday health concerns including fever, infections, and chronic conditions. We focus on early diagnosis and preventive healthcare.`,
        services: [
            'Fever & Infection Treatment',
            'Blood Pressure Management',
            'Diabetes Monitoring',
            'Routine Health Checkups'
        ],
        doctorMessage: `We ensure accurate diagnosis and personalized treatment to maintain your overall health.`,
        image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773762861/1773761939589_gybzbw.png'
    },

    {
        id: 'diabetologist',
        title: 'Diabetologist',
        description: 'Special care for diabetes and sugar management',
        details: `We specialize in managing diabetes and maintaining healthy blood sugar levels through advanced monitoring and lifestyle guidance.`,
        services: [
            'Blood Sugar Monitoring',
            'Diabetes Management',
            'Diet Consultation',
            'Lifestyle Guidance'
        ],
        doctorMessage: `Our goal is to help you live a healthy life by keeping your sugar levels under control.`,
        image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773762861/1773761943917_hgzwfd.png'
    },

    {
        id: 'orthopedic',
        title: 'Orthopedic',
        description: 'Bone, joint, and muscle treatment',
        details: `Our Orthopedic department treats bone fractures, joint pain, and muscle injuries with advanced techniques.`,
        services: [
            'Fracture Treatment',
            'Joint Replacement',
            'Back Pain Care',
            'Sports Injury Treatment'
        ],
        doctorMessage: `We focus on restoring mobility and improving your quality of life.`,
        image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773762861/1773761945877_vhrfh4.png'
    },

    {
        id: 'nephrology',
        title: 'Nephrology',
        description: 'Kidney-related diseases and treatments',
        details: `We provide specialized care for kidney-related problems including chronic kidney disease and dialysis support.`,
        services: [
            'Kidney Function Tests',
            'Dialysis Support',
            'Kidney Disease Treatment',
            'Hypertension Care'
        ],
        doctorMessage: `Our team ensures proper kidney care with advanced treatment and monitoring.`,
        image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773762861/1773761947725_sk3bhs.png'
    },

    {
        id: 'physiotherapy',
        title: 'Physiotherapy',
        description: 'Rehabilitation and physical recovery therapy',
        details: `We help patients recover from injuries and surgeries through guided physical therapy and exercises.`,
        services: [
            'Rehabilitation Therapy',
            'Pain Management',
            'Post-Surgery Recovery',
            'Mobility Improvement'
        ],
        doctorMessage: `We help you regain strength and mobility with safe and effective therapy.`,
        image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773762860/1773761950046_h1hzcu.png'
    },

    {
        id: 'cardiologist',
        title: 'Cardiologist',
        description: 'Heart and blood vessel treatments',
        details: `Our Cardiology department provides advanced care for heart diseases using modern diagnostic tools.`,
        services: [
            'ECG & Heart Monitoring',
            'Heart Disease Treatment',
            'Angioplasty',
            'Blood Pressure Control'
        ],
        doctorMessage: `We ensure your heart stays healthy with early detection and proper treatment.`,
        image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773762860/1773761952943_ya6mjs.png'
    },

    {
        id: 'ent',
        title: 'ENT',
        description: 'Ear, nose, and throat care',
        details: `We diagnose and treat ear, nose, and throat conditions with modern equipment.`,
        services: [
            'Ear Infection Treatment',
            'Sinus Care',
            'Hearing Tests',
            'Throat Disorders'
        ],
        doctorMessage: `We provide complete care for all ENT-related problems.`,
        image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773762861/1773762277290_ewfej0.png'
    },

    {
        id: 'dermatologist',
        title: 'Dermatologist',
        description: 'Skin, hair, and nail treatments',
        details: `We offer expert care for skin conditions, hair problems, and cosmetic treatments.`,
        services: [
            'Acne Treatment',
            'Skin Allergy Care',
            'Hair Loss Treatment',
            'Cosmetic Skin Care'
        ],
        doctorMessage: `Healthy skin reflects good health. We provide safe and effective treatments.`,
        image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773762861/1773762273814_r0ipir.png'
    },

    {
        id: 'gastroenterologist',
        title: 'Gastroenterologist',
        description: 'Digestive system treatments',
        details: `We treat digestive system issues including stomach pain, acidity, and liver problems.`,
        services: [
            'Acidity Treatment',
            'Liver Care',
            'Endoscopy',
            'Digestive Disorders'
        ],
        doctorMessage: `We ensure proper digestive health through accurate diagnosis and treatment.`,
        image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773762860/1773761957521_mbba2r.png'
    },

    {
        id: 'general-surgery',
        title: 'General Surgery',
        description: 'Surgical procedures and operations',
        details: `We perform safe and advanced surgical procedures with experienced surgeons.`,
        services: [
            'Minor Surgeries',
            'Major Surgeries',
            'Post-Surgery Care',
            'Emergency Surgery'
        ],
        doctorMessage: `We ensure safe surgical procedures and smooth recovery.`,
        image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773762861/1773761959447_nertzm.png'
    },

    {
        id: 'gynecologist',
        title: 'Gynecologist',
        description: 'Women’s health and pregnancy care',
        details: `We provide complete care for women’s health including pregnancy and reproductive health.`,
        services: [
            'Pregnancy Care',
            'Women Health Checkups',
            'Fertility Treatment',
            'Hormonal Care'
        ],
        doctorMessage: `We ensure safe and caring support for every stage of women’s health.`,
        image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773762860/1773761961430_czasdh.png'
    },

    {
        id: 'pediatric',
        title: 'Pediatric',
        description: 'Healthcare for children and infants',
        details: `We provide specialized care for infants and children in a friendly environment.`,
        services: [
            'Child Health Checkups',
            'Vaccination',
            'Growth Monitoring',
            'Pediatric Care'
        ],
        doctorMessage: `We care for your child’s health with compassion and expertise.`,
        image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773762860/1773761963023_wbv2tv.png'
    },

    {
        id: 'psychologist',
        title: 'Psychologist',
        description: 'Mental health and counseling support',
        details: `We provide counseling and mental health support for stress, anxiety, and emotional well-being.`,
        services: [
            'Stress Management',
            'Counseling Sessions',
            'Mental Health Therapy',
            'Behavioral Therapy'
        ],
        doctorMessage: `We support your mental health with care, privacy, and professional guidance.`,
        image: 'https://res.cloudinary.com/dgcyqntse/image/upload/v1773762860/1773762053877_ov17od.png'
    }
];

const Departments = () => {
    return (
        <section className="departments-section">
            <h2>Our Departments</h2>

            <div className="departments-container">
                {departments.map((dept) => (
                    <div className="department-card" key={dept.id}>
                        <img src={dept.image} alt={dept.title} />
                        <h3>{dept.title}</h3>
                        <p>{dept.description}</p>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Departments;