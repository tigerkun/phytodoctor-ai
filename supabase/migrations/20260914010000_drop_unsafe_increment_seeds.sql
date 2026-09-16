-- Remove the legacy overload without transaction-id replay protection.
drop function if exists public.increment_seeds(integer, text, text);
