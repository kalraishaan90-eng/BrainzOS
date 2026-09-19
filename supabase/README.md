# BrainzOS Supabase Configuration

This directory contains the database migrations and seed data for the **BrainzOS** school operating system.

## Structure

```
supabase/
├── migrations/
│   ├── 20260918000001_initial_schema.sql          # Types, tables, constraints, indexes
│   ├── 20260918000002_functions_and_triggers.sql  # Helper functions (is_director, etc.), auth triggers
│   ├── 20260918000003_row_level_security.sql      # Row Level Security (RLS) policies
│   └── 20260918000004_realtime_setup.sql          # Supabase Realtime publication setup
└── seed.sql                                       # Complete realistic demo dataset
```

For full setup instructions, see [README.md](../README.md).
