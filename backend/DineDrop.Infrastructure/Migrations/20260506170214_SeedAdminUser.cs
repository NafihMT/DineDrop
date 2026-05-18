using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DineDrop.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SeedAdminUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "Users",
                columns: new[] { "Id", "ApprovalStatus", "CreatedAt", "Email", "IsActive", "IsBlocked", "IsDeleted", "Name", "PasswordHash", "Phone", "Role", "UpdatedAt" },
                values: new object[] { new Guid("f9e7b1a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b"), 1, new DateTime(2026, 5, 6, 17, 2, 9, 321, DateTimeKind.Utc).AddTicks(3878), "admin@dinedrop.com", true, false, false, "Admin", "$2a$11$Of.FDOynfWKBdQ2p/6fNruvb4ICQBp/UC9uahjAhhoUQ/SQfL9AbS", "9999999999", 3, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("f9e7b1a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b"));
        }
    }
}
