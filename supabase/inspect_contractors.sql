-- FULL contractor list with counts per test pattern
SELECT
  cp.id AS contractor_profile_id,
  cp.full_name,
  cp.email,
  cp.verification_status,
  cp.experience_years,
  p.role AS profile_role,
  cp.created_at,
  CASE
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%test%' THEN 'TEST: test-contractor@example.com'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%probe%' THEN 'TEST: probe contractor'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%p6 dash%' THEN 'TEST: phase6 dashboard'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%p7 track%' THEN 'TEST: phase7 tracker'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%e2e_con%' THEN 'TEST: e2e contractor'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%e2e_hari%' THEN 'TEST: e2e auth'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%e2e_vijaya%' THEN 'TEST: e2e auth'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%contractor_a%' THEN 'TEST: e2e contractor'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%contractor_b%' THEN 'TEST: e2e contractor'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%con_m%' THEN 'TEST: con_m'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%test_con%' THEN 'TEST: test_con'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%bsa_%' THEN 'TEST: assignment probe'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%bst_%' THEN 'TEST: bst probe'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%bsrls_%' THEN 'TEST: rls probe'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%contractor_test%' THEN 'TEST: contractor-test'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%contractor_rls%' THEN 'TEST: contractor-rls'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%contractor_vr%' THEN 'TEST: contractor-vr'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%con_sitelog%' THEN 'TEST: con_sitelog'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%bs-int%' THEN 'TEST: integration'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%bs_seed%' THEN 'TEST: bs-seed'
    WHEN cp.email LIKE '%@example.com' AND cp.full_name ILIKE '%bs_diag%' THEN 'TEST: bs-diag'
    WHEN cp.email = 'madhu38@gmail.com' THEN 'GENUINE: madhu38@gmail.com'
    WHEN cp.email = 'ramu@gmail.com' THEN 'GENUINE: ramu@gmail.com'
    WHEN cp.email = 'vijaya@gmail.com' THEN 'GENUINE: vijaya@gmail.com'
    WHEN cp.email = 'yagniyeruva@gmail.com' THEN 'GENUINE: yagniyeruva@gmail.com'
    WHEN cp.email = 'hari138@gmail.com' THEN 'GENUINE: hari138@gmail.com'
    ELSE 'UNKNOWN: ' || cp.email
  END AS classification
FROM public.contractor_profiles cp
LEFT JOIN public.profiles p ON p.id::text = cp.id::text OR LOWER(TRIM(cp.email)) = LOWER(TRIM(p.email))
ORDER BY classification, cp.email;
