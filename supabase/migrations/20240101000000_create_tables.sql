-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Create core tables
-- Tables: profiles, receipts
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension (usually pre-enabled in Supabase)
create extension if not exists "pgcrypto";

-- ── profiles ─────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid        primary key default gen_random_uuid(),
  email      text        unique not null,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per application user; mirrors auth.users but kept in public schema for demo simplicity.';

-- ── receipts ─────────────────────────────────────────────────────────────────
create table if not exists public.receipts (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references public.profiles (id) on delete cascade,
  title      text        not null,
  amount     numeric(10, 2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

comment on table public.receipts is
  'Purchase receipts; used in every episode to demonstrate CRUD + RLS patterns.';

-- Indexes
create index if not exists receipts_user_id_idx on public.receipts (user_id);
