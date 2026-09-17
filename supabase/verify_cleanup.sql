-- Verify: remaining test data after cleanup
SELECT
  (SELECT COUNT(*) FROM public.contractor_profiles WHERE email LIKE '%@example.com') AS remaining_test_contractor_profiles,
  (SELECT COUNT(*) FROM public.profiles WHERE email LIKE '%@example.com' AND role <> 'ADMIN') AS remaining_test_profiles,
  (SELECT COUNT(*) FROM public.profiles WHERE email LIKE '%@example.com' AND role = 'ADMIN') AS preserved_admin_profiles,
  (SELECT COUNT(*) FROM public.profiles WHERE email LIKE '%@gmail.com' AND role = 'CONTRACTOR') AS genuine_contractors;
