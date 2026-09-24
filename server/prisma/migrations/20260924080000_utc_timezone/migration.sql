-- Veritabanı oturum saat dilimi her zaman UTC: Prisma tarihleri UTC saklar; ham SQL'deki tarih
-- parametreleri ve now() da UTC olsun (sunucunun bulunduğu ülkenin saat dilimi sonucu değiştirmesin).
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'UTC');
END
$$;
