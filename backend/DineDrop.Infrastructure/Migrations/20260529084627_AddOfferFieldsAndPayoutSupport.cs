using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DineDrop.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOfferFieldsAndPayoutSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "OfferId",
                table: "Orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Code",
                table: "Offers",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "Offers",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Offers",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "RestaurantId",
                table: "Offers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("f9e7b1a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b"),
                columns: new[] { "CreatedAt", "PasswordHash" },
                values: new object[] { new DateTime(2026, 5, 29, 8, 46, 24, 143, DateTimeKind.Utc).AddTicks(5306), "$2a$11$oDEn/H6mKNkxECVahjkvZO36QHjjRNtOpEFopRe4PnnkT7EX1OGfK" });

            migrationBuilder.CreateIndex(
                name: "IX_Orders_OfferId",
                table: "Orders",
                column: "OfferId");

            migrationBuilder.AddForeignKey(
                name: "FK_Orders_Offers_OfferId",
                table: "Orders",
                column: "OfferId",
                principalTable: "Offers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Orders_Offers_OfferId",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_Orders_OfferId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "OfferId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "Code",
                table: "Offers");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "Offers");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Offers");

            migrationBuilder.DropColumn(
                name: "RestaurantId",
                table: "Offers");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "Id",
                keyValue: new Guid("f9e7b1a2-3c4d-5e6f-7a8b-9c0d1e2f3a4b"),
                columns: new[] { "CreatedAt", "PasswordHash" },
                values: new object[] { new DateTime(2026, 5, 29, 7, 19, 40, 620, DateTimeKind.Utc).AddTicks(6394), "$2a$11$WQRT2JV9CpeB0cmOtjxugetyVXURDtNqXy7IqTvuZhqe2Dy9hW4Zm" });
        }
    }
}
