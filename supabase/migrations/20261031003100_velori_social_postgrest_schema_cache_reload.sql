-- Refresh PostgREST after the social interaction RPCs are reconciled.
notify pgrst, 'reload schema';
