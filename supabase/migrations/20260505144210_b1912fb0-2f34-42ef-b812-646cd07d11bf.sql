do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'telegram_bot_state' and policyname = 'Backend only access') then
    create policy "Backend only access" on public.telegram_bot_state for all to authenticated using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'telegram_messages' and policyname = 'Backend only access') then
    create policy "Backend only access" on public.telegram_messages for all to authenticated using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'telegram_chat_wallets' and policyname = 'Backend only access') then
    create policy "Backend only access" on public.telegram_chat_wallets for all to authenticated using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'telegram_rebalance_intents' and policyname = 'Backend only access') then
    create policy "Backend only access" on public.telegram_rebalance_intents for all to authenticated using (false) with check (false);
  end if;
end $$;