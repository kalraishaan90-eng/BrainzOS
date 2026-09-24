# Supabase Edge Function: `create-teacher`

This Edge Function enables secure, server-side provisioning of faculty (`teacher`) accounts in BrainzOS.

## Security Architecture
1. **Zero Client-Side Secret Leakage**: Creating users via Supabase Admin requires the `service_role` key. This key is strictly kept in server-side Edge Function secrets (`Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`). It is never bundled into browser code.
2. **Director Role Verification**: The function extracts the caller's JWT, verifies their identity with Supabase Auth, and queries `public.profiles` to confirm `role === 'director'`. If not a director, the function terminates with `403 Forbidden`.
3. **Duplicate Prevention**: The function checks if the email already exists in `profiles` or `auth.users`, returning a clear `409 Conflict` (`A user with this email/username already exists in the institutional registry.`) so the frontend displays an intuitive error state.
4. **Temporary Credentials**: It generates a cryptographically random 10-character password and returns it once in the response for on-screen display during the pilot.

---

## Deployment Instructions

### Prerequisites
Install the [Supabase CLI](https://supabase.com/docs/guides/cli):
```bash
npm install -g supabase
```

### 1. Link your Supabase Project
```bash
# Log in to Supabase CLI
supabase login

# Link your local repo to your Supabase project ref
supabase link --project-ref <your-project-ref>
```

### 2. Set the Service Role Secret in Supabase Edge Functions
```bash
# Retrieve your service_role key from Supabase Dashboard > Project Settings > API
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJh...your_service_role_key...
```

### 3. Deploy the Edge Function
```bash
# Deploy create-teacher to your remote Supabase project
supabase functions deploy create-teacher --no-verify-jwt
```
*(Note: `--no-verify-jwt` allows our function to handle custom token validation, CORS preflight requests, and return clear 401/403 JSON payloads directly).*

---

## Testing the Function via cURL

```bash
curl -i --location --request POST 'https://<your-project-ref>.supabase.co/functions/v1/create-teacher' \
  --header 'Authorization: Bearer <director-jwt-access-token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "full_name": "Pooja Verma",
    "email": "pooja.verma@brainz.edu",
    "class_sections_taught": "XI-B, XII-A"
  }'
```
