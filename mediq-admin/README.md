# MediQ

MediQ is a clinic queue and operations system covering appointments, live patient queue, patient/doctor/staff directories, and room management. This repo is the admin/staff-facing dashboard. Role-based access (admin, front desk, doctor) is enforced in the UI and is intended to be mirrored server-side once the backend lands.

> This project is built on top of [shadcn-admin](https://github.com/satnaing/shadcn-admin) by [@satnaing](https://github.com/satnaing). See [Credits & Upstream](#credits--upstream) below. Original template docs are preserved further down for reference.

## MediQ Overview

### Domain features

- **Appointments** — book, view, and manage appointment status
- **Queue** — live walk-in/checked-in queue: call next, start visit, complete, mark left
- **Patients** — clinic patient directory
- **Doctors** — doctor directory with status management
- **Staff** — staff directory
- **Rooms** — room directory with status management
- **Dashboard** — clinic overview/analytics

### Roles & permissions

Roles are defined in `src/config/rbac.ts` and can be layered (a user's roles are `string[]`). Permissions are checked via the `useRbac` hook — components and route guards check permission strings, never role names directly.

| Role | Access |
|---|---|
| `admin` | Full access to every permission |
| `front_desk` | Dashboard, book/manage appointments, manage queue, manage patients |
| `doctor` | Dashboard, view-only on appointments/queue/patients |

Route-level guarding lives in `routePermissions` (same file), matched by longest path prefix. **Note:** this is UI/UX-layer authorization only — the backend must enforce the same rules server-side; hiding a route in the frontend is not security.

### Data layer (mock-backed, backend-ready)

There is no backend yet. Pages talk to typed repository interfaces (`src/data/repos.ts`), never directly to mock data or the store. The mock implementations are backed by a zustand store under `src/data/mock/`, with simulated network latency so loading states are visible and real.

When the backend is ready:
1. Implement the same repository interfaces (`AppointmentsRepository`, `QueueRepository`, `PatientsRepository`, `DoctorsRepository`, `StaffRepository`, `RoomsRepository`) using `axios` (already a dependency).
2. Swap the implementations wired up in `src/data/index.ts`.
3. The UI and hooks (`src/data/hooks.ts`) should not need to change.

### Auth (currently mocked)

`src/stores/auth-store.ts` persists a signed-in user and a placeholder access token in cookies, purely so the session and role survive a page reload without a real backend. This needs to be replaced with real token issuance/refresh once auth endpoints exist.

## Features

- Light/dark mode
- Responsive
- Accessible
- With built-in Sidebar component
- Global search command
- Extra custom components
- RTL support

<details>
<summary>Customized Components (click to expand)</summary>

This project uses Shadcn UI components, but some have been slightly modified for better RTL (Right-to-Left) support and other improvements. These customized components differ from the original Shadcn UI versions.

If you want to update components using the Shadcn CLI (e.g., `npx shadcn@latest add <component>`), it's generally safe for non-customized components. For the listed customized ones, you may need to manually merge changes to preserve the project's modifications and avoid overwriting RTL support or other updates.

> If you don't require RTL support, you can safely update the 'RTL Updated Components' via the Shadcn CLI, as these changes are primarily for RTL compatibility. The 'Modified Components' may have other customizations to consider.

### Modified Components

- scroll-area
- sonner
- separator

### RTL Updated Components

- alert-dialog
- calendar
- command
- dialog
- dropdown-menu
- select
- table
- sheet
- sidebar
- switch

**Notes:**

- **Modified Components**: These have general updates, potentially including RTL adjustments.
- **RTL Updated Components**: These have specific changes for RTL language support (e.g., layout, positioning).
- For implementation details, check the source files in `src/components/ui/`.
- All other Shadcn UI components in the project are standard and can be safely updated via the CLI.

</details>

## Tech Stack

**UI:** [ShadcnUI](https://ui.shadcn.com) (TailwindCSS + RadixUI)

**Build Tool:** [Vite](https://vitejs.dev/)

**Routing:** [TanStack Router](https://tanstack.com/router/latest)

**Type Checking:** [TypeScript](https://www.typescriptlang.org/)

**Linting/Formatting:** [ESLint](https://eslint.org/) & [Prettier](https://prettier.io/)

**Icons:** [Lucide Icons](https://lucide.dev/icons/), [Tabler Icons](https://tabler.io/icons) (Brand icons only)

**Data fetching/state:** [TanStack Query](https://tanstack.com/query/latest), [Zustand](https://zustand-demo.pmnd.rs/)

**Auth:** mocked via `src/stores/auth-store.ts` pending a real backend (see [Auth (currently mocked)](#auth-currently-mocked) above)

## Run Locally

Go to the project directory

```bash
  cd mediq-admin
```

Install dependencies

```bash
  pnpm install
```

Copy the env example and fill in any required values

```bash
  cp .env.example .env
```

Start the server

```bash
  pnpm run dev
```

Other useful scripts: `pnpm lint`, `pnpm format`, `pnpm test`, `pnpm build`. See `package.json` for the full list.

## Credits & Upstream

This project started from [shadcn-admin](https://github.com/satnaing/shadcn-admin) by [@satnaing](https://github.com/satnaing), an MIT-licensed admin dashboard template built with ShadcnUI, Vite, and TanStack Router. MediQ-specific work (clinic domain features, RBAC, mock data layer, auth store) is layered on top of that foundation.

If you find the underlying template useful outside of MediQ, consider [sponsoring @satnaing](https://github.com/sponsors/satnaing) or [buying them a coffee](https://buymeacoffee.com/satnaing).

### Template sponsor

- [Clerk](https://go.clerk.com/GttUAaK) - authentication and user management for the modern web

## License

Licensed under the [MIT License](https://choosealicense.com/licenses/mit/)
