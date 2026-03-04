IF DB_ID('Cobble') IS NULL
BEGIN
  RESTORE DATABASE [Cobble]
  FROM DISK = N'/var/opt/mssql/backup/Cobble_250910.bak'
  WITH
    MOVE N'Cobble' TO N'/var/opt/mssql/data/Cobble.mdf',
    MOVE N'Cobble_log' TO N'/var/opt/mssql/data/Cobble_log.ldf',
    REPLACE, RECOVERY;
END
GO