using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DineDrop.Domain.Entities
{
    public class DriverProfile
    {
        public int Id { get; set; }
        public int UserId { get; set; }

        public string VehicleType { get; set; }      
        public string LicenseNumber { get; set; }    

        public string? VehicleNumber { get; set; }   

        public bool IsAvailable { get; set; }        

        public DateTime CreatedAt { get; set; }
    }
}
