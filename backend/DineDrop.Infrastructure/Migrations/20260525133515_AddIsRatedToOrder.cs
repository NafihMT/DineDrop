using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DineDrop.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddIsRatedToOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsRated",
                table: "Orders",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("f9e7b1a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b"),
                columns: new[] { "CreatedAt", "PasswordHash" },
                values: new object[] { new DateTime(2026, 5, 25, 13, 35, 12, 347, DateTimeKind.Utc).AddTicks(2819), "$2a$11$lC3Id15TaJyfzc6CtP7F8.ISrcN5c10hy1eMtBjPTrt9deBUHrZii" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsRated",
                table: "Orders");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("f9e7b1a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b"),
                columns: new[] { "CreatedAt", "PasswordHash" },
                values: new object[] { new DateTime(2026, 5, 18, 7, 36, 3, 157, DateTimeKind.Utc).AddTicks(3295), "$2a$11$8.7O/9NeYryp8DDJmxDMheH0vMbCmCUAIFGzH66L0.e1jp3fiAnRm" });
        }
    }
}
