using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DineDrop.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRatingToDriver : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "Rating",
                table: "Drivers",
                type: "float",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("f9e7b1a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b"),
                columns: new[] { "CreatedAt", "PasswordHash" },
                values: new object[] { new DateTime(2026, 5, 25, 13, 42, 32, 196, DateTimeKind.Utc).AddTicks(3473), "$2a$11$nW9Hbn5LmlX1k5gKThVCsuHPitrZfkGSUBHSHjG.vlC5.eX/YI/02" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Rating",
                table: "Drivers");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("f9e7b1a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b"),
                columns: new[] { "CreatedAt", "PasswordHash" },
                values: new object[] { new DateTime(2026, 5, 25, 13, 35, 12, 347, DateTimeKind.Utc).AddTicks(2819), "$2a$11$lC3Id15TaJyfzc6CtP7F8.ISrcN5c10hy1eMtBjPTrt9deBUHrZii" });
        }
    }
}
