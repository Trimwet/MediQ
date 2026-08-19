# Supabase Backend — MediQ

This folder contains the Supabase project configuration for MediQ.
It manages the database schema, edge functions, and local development setup.

**Project ref:** `snvdwamqjreuhtyrrrlg`
**Project URL:** https://snvdwamqjreuhtyrrrlg.supabase.co

## Local Development

```bash
# Start local Supabase stack (Postgres, Auth, Studio, etc.)
supabase start

# Stop local stack
supabase stop

# Reset database (re-run migrations + seed)
supabase db reset
```

## Linking to Remote

```bash
# 1. Log in to Supabase (opens browser — one-time)
supabase login

# 2. Link to the MediQ project
supabase link --project-ref snvdwamqjreuhtyrrrlg
```

## Schema Management

```bash
# Push local migrations to remote
supabase db push

# Pull remote schema as a new migration
supabase db pull

# Create a new migration
supabase migration new <name>
```

## Edge Functions

```bash
# Deploy a single function
supabase functions deploy <function-name>

# Serve functions locally (part of supabase start)
```

## Environment

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

**Never commit `.env` files.** They are gitignored.

## Relationship to mediq-admin

The admin dashboard (`mediq-admin/`) currently runs on mock repositories
(`mediq-admin/src/data/mock/`). When this backend is ready, the mock
implementations will be swapped for Supabase-backed ones — the repository
interfaces in `mediq-admin/src/data/repos.ts` remain unchanged.
