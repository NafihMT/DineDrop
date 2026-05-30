using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace DineDrop.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SeedDefaultCoupons : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "Offers",
                columns: new[] { "Id", "Code", "CreatedAt", "CreatedBy", "ExpiryDate", "IsActive", "IsDeleted", "MinOrderAmount", "RestaurantId", "Type", "UpdatedAt", "Value" },
                values: new object[,]
                {
                    { new Guid("11111111-1111-1111-1111-111111111111"), "NEW50", new DateTime(2026, 1, 1, 5, 30, 0, 0, DateTimeKind.Local), "Platform", new DateTime(2030, 1, 1, 5, 30, 0, 0, DateTimeKind.Local), true, false, 0.00m, null, 0, null, 50.00m },
                    { new Guid("22222222-2222-2222-2222-222222222222"), "FIRST50", new DateTime(2026, 1, 1, 5, 30, 0, 0, DateTimeKind.Local), "Platform", new DateTime(2030, 1, 1, 5, 30, 0, 0, DateTimeKind.Local), true, false, 0.00m, null, 0, null, 50.00m }
                });

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("f9e7b1a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b"),
                columns: new[] { "CreatedAt", "PasswordHash" },
                values: new object[] { new DateTime(2026, 5, 29, 8, 48, 0, 714, DateTimeKind.Utc).AddTicks(7294), "$2a$11$gjBGXD40po5fKzIUo9dWX.24ujNrd.VBoM59JBM7RVXUxzPvUgWXi" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "Offers",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"));

            migrationBuilder.DeleteData(
                table: "Offers",
                keyColumn: "Id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222222"));

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("f9e7b1a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b"),
                columns: new[] { "CreatedAt", "PasswordHash" },
                values: new object[] { new DateTime(2026, 5, 29, 8, 46, 24, 143, DateTimeKind.Utc).AddTicks(5306), "$2a$11$oDEn/H6mKNkxECVahjkvZO36QHjjRNtOpEFopRe4PnnkT7EX1OGfK" });
        }
    }
}
