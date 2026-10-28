-- FORGE local-first generation receipts. Generated source is returned to the device only.
-- Apply after 20261024232208_velori_forge_studio.sql.
BEGIN;
CREATE OR REPLACE FUNCTION public.velori_studio_finish_local(
  p_user uuid, p_request uuid, p_success boolean
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.velori_studio_requests%rowtype;
BEGIN
  PERFORM 1 FROM public.velori_studio_accounts WHERE user_id=p_user FOR UPDATE;
  SELECT * INTO r FROM public.velori_studio_requests
    WHERE user_id=p_user AND request_id=p_request FOR UPDATE;
  IF NOT FOUND OR r.kind <> 'generate' THEN RETURN false; END IF;
  IF r.state='complete' THEN RETURN p_success; END IF;
  IF r.state='failed' THEN RETURN NOT p_success; END IF;
  UPDATE public.velori_studio_requests SET
    state=CASE WHEN p_success THEN 'complete' ELSE 'failed' END,
    result=NULL,
    finished_at=clock_timestamp()
  WHERE user_id=p_user AND request_id=p_request;
  IF NOT p_success THEN
    UPDATE public.velori_studio_accounts SET
      free_left=least(10,free_left+CASE WHEN r.source='free' THEN 1 ELSE 0 END),
      tokens=tokens+CASE WHEN r.source='token' THEN 1 ELSE 0 END
    WHERE user_id=p_user;
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.velori_studio_finish_local(uuid,uuid,boolean)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.velori_studio_finish_local(uuid,uuid,boolean)
  TO service_role;
COMMIT;
