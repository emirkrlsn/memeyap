-- Süresi dolan fazları ilerletmek ve eski oyun verilerini silmek için zamanlanmış işler.
-- Eklenti panelden zaten açıldıysa tekrar oluşturmaya çalışma.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    create extension pg_cron with schema pg_catalog;
  end if;
end
$$;
