-- Initialize Plans table with subscription tiers

INSERT INTO plan (id, name, stripe_price_id, max_projects, max_tokens_per_day, max_previews, unlimited_ai, active)
VALUES
    (1, 'Free', NULL, 3, 1000, '5', false, true),
    (2, 'Codexa Pro', 'price_1SmH1XP1hPMwbn4luAffRntr', 20, 50000, 'unlimited', true, true),
    (3, 'Codexa Plus', 'price_1SmH0FP1hPMwbn4laOPoRVFe', 50, 100000, 'unlimited', true, true)
ON CONFLICT (id) DO NOTHING;

-- Reset sequence to continue from the last inserted ID
SELECT setval('plan_id_seq', (SELECT MAX(id) FROM plan));
