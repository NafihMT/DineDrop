using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DineDrop.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DateOfBirth",
                table: "Users",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "Users",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProfileImageUrl",
                table: "Users",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("f9e7b1a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b"),
                columns: new[] { "CreatedAt", "DateOfBirth", "Gender", "PasswordHash", "ProfileImageUrl" },
                values: new object[] { new DateTime(2026, 5, 18, 7, 36, 3, 157, DateTimeKind.Utc).AddTicks(3295), null, null, "$2a$11$8.7O/9NeYryp8DDJmxDMheH0vMbCmCUAIFGzH66L0.e1jp3fiAnRm", null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DateOfBirth",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Gender",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ProfileImageUrl",
                table: "Users");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("f9e7b1a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b"),
                columns: new[] { "CreatedAt", "PasswordHash" },
                values: new object[] { new DateTime(2026, 5, 13, 10, 20, 21, 663, DateTimeKind.Utc).AddTicks(7904), "$2a$11$GoKP6duUIAxQAwOQRmvewejrNI6V3vq7HVfVXeSU68v.l4a0tW30q" });
        }
    }
}
