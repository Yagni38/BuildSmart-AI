-- Check auth users with example.com emails
SELECT id, email, raw_user_meta_data
FROM auth.users
WHERE email LIKE '%@example.com'
ORDER BY email;
