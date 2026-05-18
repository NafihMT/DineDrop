using DineDrop.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;


namespace DineDrop.Infrastructure.Configurations
{
    public class DriverLocationConfiguration : IEntityTypeConfiguration<DriverLocation>
    {
        public void Configure(EntityTypeBuilder<DriverLocation> builder)
        {
            builder.HasKey(x => x.DriverId);
            builder.Property(x => x.Latitude).IsRequired();
            builder.Property(x => x.Longitude).IsRequired();

            builder.HasOne(x => x.Driver)
                .WithOne()
                .HasForeignKey<DriverLocation>(x => x.DriverId);
        }
    }
}
