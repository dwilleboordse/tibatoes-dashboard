-- ============================================================
-- TIBATOES — REVENUE DATA SEED
-- Run this AFTER schema.sql, in the Supabase SQL editor.
-- Populates: 2025 actuals, 2026 target + Jan actuals, year settings.
-- Safe to re-run (uses upserts).
-- ============================================================

-- Year settings
insert into revenue_settings (year, yearly_revenue_target, target_mer, gross_margin_pct)
values
  (2025, 2785621.38, 1.80, 0.70),
  (2026, 8000000.00, 1.90, 0.70)
on conflict (year) do update set
  yearly_revenue_target = excluded.yearly_revenue_target,
  target_mer            = excluded.target_mer,
  gross_margin_pct      = excluded.gross_margin_pct;

-- 2025 monthly actuals (these become 2026's seasonality reference)
insert into revenue_months (year, month, actual_revenue, actual_spend, key_events, promotions, winning_ads, product_launches)
values
  (2025,  1,  22682.63,  13748.68, null, null, null, null),
  (2025,  2,  16697.51,  12281.54, null, null, null, null),
  (2025,  3,  37121.18,  23873.69, null, null, null, null),
  (2025,  4,  10265.37,   7640.21, null, null, null, null),
  (2025,  5, 112099.85,  69666.66, null, null, null, null),
  (2025,  6, 103684.83,  61591.72, null, null, null, null),
  (2025,  7, 116800.98,  67529.79, null, null, null, null),
  (2025,  8, 120743.26,  68483.72, null, null, null, null),
  (2025,  9, 133693.12,  79279.40, null, null, null, null),
  (2025, 10, 568142.67, 318013.11, null, null, null, null),
  (2025, 11, 764104.98, 468648.90, null, null, null, null),
  (2025, 12, 779585.00, 527132.00, null, null, null, null)
on conflict (year, month) do update set
  actual_revenue = excluded.actual_revenue,
  actual_spend   = excluded.actual_spend;

-- 2026 — copy 2025 actuals into prior_year_revenue / prior_year_spend
insert into revenue_months (year, month, prior_year_revenue, prior_year_spend)
values
  (2026,  1,  22682.63,  13748.68),
  (2026,  2,  16697.51,  12281.54),
  (2026,  3,  37121.18,  23873.69),
  (2026,  4,  10265.37,   7640.21),
  (2026,  5, 112099.85,  69666.66),
  (2026,  6, 103684.83,  61591.72),
  (2026,  7, 116800.98,  67529.79),
  (2026,  8, 120743.26,  68483.72),
  (2026,  9, 133693.12,  79279.40),
  (2026, 10, 568142.67, 318013.11),
  (2026, 11, 764104.98, 468648.90),
  (2026, 12, 779585.00, 527132.00)
on conflict (year, month) do update set
  prior_year_revenue = excluded.prior_year_revenue,
  prior_year_spend   = excluded.prior_year_spend;

-- 2026 — January actuals + early promotion notes
update revenue_months
   set actual_revenue = 79641,
       actual_spend   = 50486,
       promotions     = 'New Year''s Sale'
 where year = 2026 and month = 1;

update revenue_months
   set promotions = 'Screen Free'
 where year = 2026 and month = 2;
