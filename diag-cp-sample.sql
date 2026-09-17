SELECT id, full_name, email, verification_status
FROM public.contractor_profiles
ORDER BY created_at DESC
LIMIT 10;