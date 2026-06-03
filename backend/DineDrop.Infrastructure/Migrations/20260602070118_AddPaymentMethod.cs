using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DineDrop.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentMethod : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PaymentMethod",
                table: "Orders",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("f9e7b1a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b"),
                columns: new[] { "CreatedAt", "PasswordHash" },
                values: new object[] { new DateTime(2026, 6, 2, 7, 1, 15, 313, DateTimeKind.Utc).AddTicks(8432), "$2a$11$Zy7dvVkQuZFMitdhjDJ8J.8XyviKoTBAei7cw5mXEf91Ws64wbiUS" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "Orders");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("f9e7b1a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b"),
                columns: new[] { "CreatedAt", "PasswordHash" },
                values: new object[] { new DateTime(2026, 5, 29, 8, 48, 0, 714, DateTimeKind.Utc).AddTicks(7294), "$2a$11$gjBGXD40po5fKzIUo9dWX.24ujNrd.VBoM59JBM7RVXUxzPvUgWXi" });
        }
    }
}
