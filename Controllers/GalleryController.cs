using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;

namespace Cobble.GalleryService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GalleryController : ControllerBase
{
    private readonly IDbConnection _db;

    public GalleryController(IDbConnection db) => _db = db;

    // ------------ READ: list by member ------------
    // GET /api/gallery/{memberId}
    [HttpGet("{memberId}")]
    public IActionResult GetByMember(string memberId)
    {
        try
        {
            _db.Open();

            using var cmd = CreateSpCommand("sp_gal_Gallery_CRUD");
            cmd.Parameters.Add(new SqlParameter("@Action", "SELECT"));
            cmd.Parameters.Add(new SqlParameter("@MemberID", memberId));

            using var reader = cmd.ExecuteReader();
            var rows = ReadRows(reader);

            // OPTIONAL: Convert image bytes to data URLs for easy frontend rendering
            // If your SP returns varbinary columns like Image_Thumbnail/Image_data, this will work.
            foreach (var row in rows)
            {
                if (row.TryGetValue("Image_Thumbnail", out var thumbObj) && thumbObj is byte[] thumbBytes)
                    row["ThumbnailDataUrl"] = ToDataUrl(thumbBytes);

                if (row.TryGetValue("Image_data", out var dataObj) && dataObj is byte[] dataBytes)
                    row["ImageDataUrl"] = ToDataUrl(dataBytes);
            }

            return Ok(rows);
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
        finally
        {
            if (_db.State != ConnectionState.Closed) _db.Close();
        }
    }

    // ------------ CREATE: upload image (multipart/form-data) ------------
    // POST /api/gallery/upload
    // form fields: memberId, title, description, privacy, file
    [HttpPost("upload")]
    [RequestSizeLimit(20_000_000)] // 20MB
    public async Task<IActionResult> Upload([FromForm] UploadGalleryDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.MemberId)) return BadRequest("memberId required");
        if (dto.File == null || dto.File.Length == 0) return BadRequest("file required");

        var bytes = await ReadAllBytes(dto.File);

        // SIMPLE THUMBNAIL: for MVP we store same bytes as thumbnail.
        // Later we can generate a real thumbnail (ImageSharp etc).
        var thumbBytes = bytes;

        try
        {
            _db.Open();

            using var cmd = CreateSpCommand("sp_gal_Gallery_CRUD");
            cmd.Parameters.Add(new SqlParameter("@Action", "INSERT"));
            cmd.Parameters.Add(new SqlParameter("@MemberID", dto.MemberId));
            cmd.Parameters.Add(new SqlParameter("@Title", (object?)dto.Title ?? DBNull.Value));
            cmd.Parameters.Add(new SqlParameter("@Description", (object?)dto.Description ?? DBNull.Value));
            cmd.Parameters.Add(new SqlParameter("@Private", (object?)dto.Privacy ?? DBNull.Value));

            // IMPORTANT: these parameter names must match the SP signature
            cmd.Parameters.Add(new SqlParameter("@Image_Thumbnail", thumbBytes));
            cmd.Parameters.Add(new SqlParameter("@Image_Data", bytes));

            // Some SPs return a row; some return nothing. We'll try to read if available.
            using var reader = cmd.ExecuteReader();
            if (reader.HasRows)
            {
                var rows = ReadRows(reader);
                return StatusCode(201, rows);
            }

            return StatusCode(201, "Uploaded");
        }
        catch (SqlException ex)
        {
            return StatusCode(500, $"SQL Error: {ex.Message}");
        }
        finally
        {
            if (_db.State != ConnectionState.Closed) _db.Close();
        }
    }

    // ------------ UPDATE: metadata (optional file) ------------
    // PUT /api/gallery/{imageId}
    // Can update title/description/privacy and optionally replace file.
    [HttpPut("{imageId:int}")]
    public async Task<IActionResult> Update(int imageId, [FromForm] UpdateGalleryDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.MemberId)) return BadRequest("memberId required");

        byte[]? bytes = null;
        if (dto.File != null && dto.File.Length > 0)
            bytes = await ReadAllBytes(dto.File);

        try
        {
            _db.Open();

            using var cmd = CreateSpCommand("sp_gal_Gallery_CRUD");
            cmd.Parameters.Add(new SqlParameter("@Action", "UPDATE"));
            cmd.Parameters.Add(new SqlParameter("@MemberID", dto.MemberId));
            cmd.Parameters.Add(new SqlParameter("@ImageID", imageId));
            cmd.Parameters.Add(new SqlParameter("@Title", (object?)dto.Title ?? DBNull.Value));
            cmd.Parameters.Add(new SqlParameter("@Description", (object?)dto.Description ?? DBNull.Value));
            cmd.Parameters.Add(new SqlParameter("@Private", (object?)dto.Privacy ?? DBNull.Value));

            if (bytes != null)
            {
                cmd.Parameters.Add(new SqlParameter("@Image_Thumbnail", bytes));
                cmd.Parameters.Add(new SqlParameter("@Image_Data", bytes));
            }

            cmd.ExecuteNonQuery();
            return NoContent();
        }
        catch (SqlException ex)
        {
            return StatusCode(500, $"SQL Error: {ex.Message}");
        }
        finally
        {
            if (_db.State != ConnectionState.Closed) _db.Close();
        }
    }

    // ------------ DELETE ------------
    // DELETE /api/gallery/{imageId}?memberId=...
    [HttpDelete("{imageId:int}")]
    public IActionResult Delete(int imageId, [FromQuery] string memberId)
    {
        if (string.IsNullOrWhiteSpace(memberId)) return BadRequest("memberId query param required");

        try
        {
            _db.Open();

            using var cmd = CreateSpCommand("sp_gal_Gallery_CRUD");
            cmd.Parameters.Add(new SqlParameter("@Action", "DELETE"));
            cmd.Parameters.Add(new SqlParameter("@MemberID", memberId));
            cmd.Parameters.Add(new SqlParameter("@ImageID", imageId));

            cmd.ExecuteNonQuery();
            return NoContent();
        }
        catch (SqlException ex)
        {
            return StatusCode(500, $"SQL Error: {ex.Message}");
        }
        finally
        {
            if (_db.State != ConnectionState.Closed) _db.Close();
        }
    }

    // ------------ helpers ------------

    private SqlCommand CreateSpCommand(string spName)
    {
        // IDbConnection is actually SqlConnection at runtime
        var conn = (SqlConnection)_db;
        var cmd = conn.CreateCommand();
        cmd.CommandText = spName;
        cmd.CommandType = CommandType.StoredProcedure;
        cmd.CommandTimeout = 60;
        return cmd;
    }

    private static List<Dictionary<string, object?>> ReadRows(SqlDataReader reader)
    {
        var rows = new List<Dictionary<string, object?>>();
        var cols = new string[reader.FieldCount];
        for (int i = 0; i < reader.FieldCount; i++) cols[i] = reader.GetName(i);

        while (reader.Read())
        {
            var row = new Dictionary<string, object?>(reader.FieldCount);
            for (int i = 0; i < cols.Length; i++)
                row[cols[i]] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            rows.Add(row);
        }
        return rows;
    }

    private static async Task<byte[]> ReadAllBytes(IFormFile file)
    {
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        return ms.ToArray();
    }

    private static string ToDataUrl(byte[] bytes)
    {
        // MVP assumes jpeg; you can detect mime later
        var b64 = Convert.ToBase64String(bytes);
        return $"data:image/jpeg;base64,{b64}";
    }

    public sealed class UploadGalleryDto
    {
        [FromForm(Name = "memberId")] public string MemberId { get; set; } = "";
        [FromForm(Name = "title")] public string? Title { get; set; }
        [FromForm(Name = "description")] public string? Description { get; set; }
        [FromForm(Name = "privacy")] public string? Privacy { get; set; } // "Pvt"/"Pub" etc
        [FromForm(Name = "file")] public IFormFile? File { get; set; }
    }

    public sealed class UpdateGalleryDto
    {
        [FromForm(Name = "memberId")] public string MemberId { get; set; } = "";
        [FromForm(Name = "title")] public string? Title { get; set; }
        [FromForm(Name = "description")] public string? Description { get; set; }
        [FromForm(Name = "privacy")] public string? Privacy { get; set; }
        [FromForm(Name = "file")] public IFormFile? File { get; set; }
    }
}