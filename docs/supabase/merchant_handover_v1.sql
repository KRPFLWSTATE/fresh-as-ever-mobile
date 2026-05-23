-- merchant_handover_v1 — customer arrival + unified merchant collect
-- Apply via Supabase MCP to project odkbpeelvcdmlimdflbr

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_arrived_at timestamptz;

COMMENT ON COLUMN public.orders.customer_arrived_at IS
  'Set when customer taps I am at the outlet on Order detail.';

CREATE OR REPLACE FUNCTION public.merchant_collect_order(
  p_order_id uuid,
  p_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_outlet uuid;
  v_status text;
  v_payment text;
  v_code varchar;
  v_match uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  SELECT o.outlet_id, o.order_status, o.payment_status, o.reservation_code
  INTO v_outlet, v_status, v_payment, v_code
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF NOT public.is_merchant_staff_for_outlet(v_outlet) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF lower(trim(v_status)) IN ('collected', 'cancelled', 'no_show', 'refunded') THEN
    RAISE EXCEPTION 'order_not_collectible';
  END IF;

  IF lower(trim(v_status)) NOT IN ('paid', 'awaiting_pickup')
     AND NOT (lower(trim(v_status)) = 'reserved' AND lower(trim(v_payment)) = 'paid') THEN
    RAISE EXCEPTION 'order_not_ready_for_handover';
  END IF;

  IF p_code IS NOT NULL AND length(trim(p_code)) > 0 THEN
    IF upper(replace(trim(p_code), ' ', '')) <> upper(replace(trim(v_code::text), ' ', '')) THEN
      RAISE EXCEPTION 'code_mismatch';
    END IF;
  END IF;

  UPDATE public.orders
  SET
    order_status = 'collected',
    collected_at = now(),
    updated_at = now(),
    customer_arrived_at = NULL
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id);
END;
$$;

COMMENT ON FUNCTION public.merchant_collect_order(uuid, text) IS
  'Merchant staff: mark order collected with optional reservation code check.';

REVOKE ALL ON FUNCTION public.merchant_collect_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merchant_collect_order(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.customer_signal_arrival(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_customer uuid;
  v_status text;
  v_pickup_start timestamptz;
  v_pickup_end timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  SELECT o.customer_id, o.order_status, rb.pickup_start, rb.pickup_end
  INTO v_customer, v_status, v_pickup_start, v_pickup_end
  FROM public.orders o
  JOIN public.rescue_bags rb ON rb.id = o.bag_id
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_customer <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF lower(trim(v_status)) IN ('collected', 'cancelled', 'no_show', 'refunded') THEN
    RAISE EXCEPTION 'order_not_arrivable';
  END IF;

  IF v_pickup_end IS NOT NULL AND now() > v_pickup_end THEN
    RAISE EXCEPTION 'pickup_window_closed';
  END IF;

  IF v_pickup_start IS NOT NULL AND now() < (v_pickup_start - interval '15 minutes') THEN
    RAISE EXCEPTION 'pickup_window_not_open';
  END IF;

  UPDATE public.orders
  SET customer_arrived_at = now(), updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id);
END;
$$;

COMMENT ON FUNCTION public.customer_signal_arrival(uuid) IS
  'Customer marks arrival at outlet during pickup window.';

REVOKE ALL ON FUNCTION public.customer_signal_arrival(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_signal_arrival(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_collect_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_status text;
  v_payment text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT o.order_status, o.payment_status
  INTO v_status, v_payment
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF lower(trim(v_status)) IN ('collected', 'cancelled', 'no_show', 'refunded') THEN
    RAISE EXCEPTION 'order_not_collectible';
  END IF;

  IF lower(trim(v_status)) NOT IN ('paid', 'awaiting_pickup')
     AND NOT (lower(trim(v_status)) = 'reserved' AND lower(trim(v_payment)) = 'paid') THEN
    RAISE EXCEPTION 'order_not_ready_for_handover';
  END IF;

  UPDATE public.orders
  SET
    order_status = 'collected',
    collected_at = now(),
    updated_at = now(),
    customer_arrived_at = NULL
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id);
END;
$$;

COMMENT ON FUNCTION public.admin_collect_order(uuid) IS
  'Admin: mark order collected with collected_at (parity with merchant_collect_order).';

REVOKE ALL ON FUNCTION public.admin_collect_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_collect_order(uuid) TO authenticated;
