<div align="center">

# MediQ

**Appointment & Queue Management System for Hospitals and Clinics**

[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)

</div>

---

## Overview

MediQ is a modern admin dashboard for managing patient appointments, real-time queue tracking, and clinic operations. Built for hospitals and clinics in Nigeria and beyond.

### Features

- **Dashboard** — Real-time overview of appointments, queue status, and clinic activity
- **Appointments** — Schedule, manage, and track patient appointments
- **Queue Management** — Live queue updates with real-time subscriptions
- **Patient Records** — Patient check-ins and visit history
- **Doctor Scheduling** — Manage doctor availability and assignments
- **Staff Management** — Staff roles and permissions
- **Room Management** — Room allocation and availability tracking
- **Dark Mode** — Full light/dark theme support

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Vite |
| UI Components | shadcn/ui, Tailwind CSS |
| Routing | TanStack Router |
| State | TanStack Query |
| Database | Supabase (PostgreSQL) |
| Charts | Recharts |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
git clone https://github.com/Trimwet/MediQ.git
cd MediQ/mediq-admin
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Build

```bash
npm run build
```

---

## Project Structure

```
mediq-admin/
├── public/images/          # Logo, favicons
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── layout/         # Sidebar, header, navigation
│   │   └── ui/             # shadcn/ui components
│   ├── features/           # Feature modules
│   │   ├── auth/           # Sign-in, sign-up, forgot password
│   │   ├── dashboard/      # Dashboard with stats, charts, check-ins
│   │   └── settings/       # Account settings
│   ├── routes/             # TanStack Router file-based routes
│   ├── styles/             # Theme variables, global CSS
│   └── lib/                # Utilities, helpers
└── package.json
```

---

## Roles

| Role | Access |
|------|--------|
| Hospital Admin | Full dashboard access |
| Front Desk | Check-ins, queue management |
| Doctor | Patient queue, appointments |
| Patient | Book appointments, view queue |

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Push to your branch and open a PR

---

## License

MIT

---

<div align="center">

Built by [Trimwet](https://github.com/Trimwet)

</div>
