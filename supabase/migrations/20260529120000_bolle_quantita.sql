-- Delivery notes track delivered quantity, not fiscal totals.
ALTER TABLE public.bolle
  ADD COLUMN IF NOT EXISTS quantita numeric;

COMMENT ON COLUMN public.bolle.quantita IS
  'Total delivered quantity (units/cases) from DDT line items — not a monetary amount.';
