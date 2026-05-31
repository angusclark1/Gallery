# Cobble Gallery Microservice

## Overview

The Cobble Gallery microservice provides a backend for uploading, viewing, updating, and deleting gallery images for a member. It integrates with the Cobble SQL database via an existing stored procedure, following the same architectural pattern used across Cobble microservices.

The service currently supports:

- Loading all gallery images for a member
- Uploading new images (title, description, privacy, file)
- Updating image metadata or replacing an image file
- Deleting images

```
Frontend UI  →  ASP.NET Core API  →  Stored Procedure  →  SQL Server (Cobble)
```

---

## How to Run

### Prerequisites

- Docker Desktop installed and running
- Git installed

### Start the service

From the `Cobble.GalleryService` directory:

```bash
docker compose up --build
```

This starts four containers:

| Container | Role |
|---|---|
| `cobble-sql` | SQL Server instance |
| `cobble-db-restore` | Restores the Cobble database and applies schema fixes on startup |
| `cobble-gallery-api` | ASP.NET Core API |
| `cobble-gallery-ui` | Frontend UI (served via Nginx) |

### Reset the environment

To fully reset all containers and volumes:

```bash
docker compose down -v
docker compose up --build
```

The `-v` flag removes existing volumes so the database is rebuilt and all schema fixes are reapplied from scratch.

---

## Access URLs

| Resource | URL |
|---|---|
| Frontend UI | http://localhost:3000 |
| Swagger (API docs) | http://localhost:8080/swagger |
| API base | http://localhost:8080 |
| SQL Server port | localhost:1433 |

---

## Project Structure

```
Cobble.GalleryService/
├── docker-compose.yml
├── Controllers/
│   └── GalleryController.cs
├── Program.cs
├── Dockerfile
├── db/
│   └── restore.sql         ← restores Cobble database and applies schema fixes
└── frontend/
    └── Dockerfile
```

---

## Key Backend Files

| File | Purpose |
|---|---|
| `GalleryController.cs` | Supports full CRUD behaviour for gallery images. Exposes four endpoints: listing images by member, uploading a new image (multipart/form-data, up to 20 MB), updating image metadata or replacing an image file, and deleting an image. Reads binary image data from the database and converts it to Base64 data URLs so the frontend can render images directly without a separate file server. Routes all operations through the `sp_gal_Gallery_CRUD` stored procedure using an Action parameter (SELECT / INSERT / UPDATE / DELETE). Also defines the `UploadGalleryDto` and `UpdateGalleryDto` request model classes inline. |
| `Program.cs` | Configures API services, Swagger, and a scoped `IDbConnection` (SqlConnection) injected into the controller for database access. Registers a permissive CORS policy allowing any origin, header, and method, suitable for development use across different frontend origins. |

---

## API Endpoints

```
GET    /api/gallery/{memberId}              List all images for a member
POST   /api/gallery/upload                  Upload a new image (multipart/form-data)
PUT    /api/gallery/{imageId}               Update metadata or replace image file
DELETE /api/gallery/{imageId}?memberId=...  Delete an image
```

### Upload fields (multipart/form-data)

| Field | Required | Notes |
|---|---|---|
| `memberId` | Yes | Member identifier |
| `file` | Yes | Image file, max 20 MB |
| `title` | No | Display title |
| `description` | No | Image description |
| `privacy` | No | e.g. `Pub` / `Pvt` |

---

## Data Model

### Tables

| Table | Purpose |
|---|---|
| `gal_Gallery` | Stores image metadata and thumbnail — MemberID, ImageID, Title, Description, Private, Image_Thumbnail, PostDate |
| `gal_Gallery_Images` | Stores full binary image data — MemberID, ImageID, Image_data, PostDate |

Both tables share the same `(MemberID, ImageID)` primary key. `gal_Gallery_Images` has a foreign key referencing `gal_Gallery`.

### Stored Procedure

| Procedure | Purpose |
|---|---|
| `sp_gal_Gallery_CRUD` | Handles all SELECT / INSERT / UPDATE / DELETE operations for gallery images across both tables |

---

## How It Works

1. Frontend sends an HTTP request to the API
2. Controller validates input and, for uploads, reads the file into memory as a byte array
3. Controller calls `sp_gal_Gallery_CRUD` with an `Action` parameter (SELECT / INSERT / UPDATE / DELETE)
4. For reads, binary image data is converted to Base64 data URLs and returned as JSON
5. Frontend renders images directly from the data URLs

---

## Database Schema Fix

During development an issue was identified where `gal_Gallery_Images.ImageID` was defined as an `IDENTITY` column, conflicting with the stored procedure's attempt to insert an explicit `ImageID` matching the parent table.

**Symptom:** Image metadata inserted successfully, but the full image insert failed with a 500 error.

**Fix:** `gal_Gallery_Images.ImageID` was changed from `IDENTITY` to `BIGINT NOT NULL`, matching the parent table. The primary key `(MemberID, ImageID)` and foreign key referencing `gal_Gallery` were rebuilt.

This fix is implemented in `db/restore.sql` and runs automatically on container startup. The script checks the current schema state before applying the fix, so it is safe to run repeatedly. Running `docker compose down -v && docker compose up --build` guarantees the fix is applied in all environments.
