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

USE Cobble;
GO

IF EXISTS (
    SELECT 1
    FROM sys.identity_columns
    WHERE object_id = OBJECT_ID('dbo.gal_Gallery_Images')
      AND name = 'ImageID'
)
BEGIN
    PRINT 'Fixing gal_Gallery_Images schema...';

    IF OBJECT_ID('dbo.gal_Gallery_Images_new', 'U') IS NOT NULL
DROP TABLE dbo.gal_Gallery_Images_new;

ALTER TABLE dbo.gal_Gallery_Images
DROP CONSTRAINT FK_gal_Gallery_Images_gal_Gallery;

CREATE TABLE dbo.gal_Gallery_Images_new (
                                            MemberID NCHAR(128) NOT NULL,
                                            ImageID BIGINT NOT NULL,
                                            Image_data VARBINARY(MAX) NOT NULL,
                                            PostDate DATE NULL,
                                            CONSTRAINT PK_gal_Images_new PRIMARY KEY (MemberID, ImageID)
);

INSERT INTO dbo.gal_Gallery_Images_new
(MemberID, ImageID, Image_data, PostDate)
SELECT
    MemberID, ImageID, Image_data, PostDate
FROM dbo.gal_Gallery_Images;

DROP TABLE dbo.gal_Gallery_Images;

EXEC sp_rename 'dbo.gal_Gallery_Images_new', 'gal_Gallery_Images';

ALTER TABLE dbo.gal_Gallery_Images
    ADD CONSTRAINT FK_gal_Gallery_Images_gal_Gallery
        FOREIGN KEY (MemberID, ImageID)
            REFERENCES dbo.gal_Gallery(MemberID, ImageID);

PRINT 'gal_Gallery_Images schema fixed.';
END
ELSE
BEGIN
    PRINT 'gal_Gallery_Images already matches expected schema.';
END
GO