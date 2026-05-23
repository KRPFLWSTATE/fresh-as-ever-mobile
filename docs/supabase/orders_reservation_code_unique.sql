-- orders_reservation_code_unique_v1
-- Enforces unique 6-char handover codes for dispute resolution and merchant verify.

create unique index if not exists orders_reservation_code_unique
  on public.orders (reservation_code)
  where reservation_code is not null;
