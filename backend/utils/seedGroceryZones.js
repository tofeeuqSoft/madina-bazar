import dotenv from 'dotenv';
import GroceryZone from '../models/GroceryZone.js';
import connectDB from '../config/db.js';

dotenv.config();

// Mirpur Grocery Zone — circle around Mirpur 10 (~covers Mirpur 1–12)
const seedZones = async () => {
  try {
    await connectDB();
    console.log('🌱 Seeding grocery zones...\n');

    // find-then-save (NOT upsert — boundary builds in validate hook)
    await GroceryZone.deleteMany({ $or: [{ boundary: { $exists: false } }, { 'boundary.coordinates': { $exists: false } }] });
    let zone = await GroceryZone.findOne({ name: 'Mirpur Grocery Zone' });
    if (!zone) {
      zone = new GroceryZone({
        name: 'Mirpur Grocery Zone',
        city: 'Dhaka',
        deliveryCharge: 60,
        minimumOrderAmount: 0,
        estimatedDeliveryTime: '2-4 Hours',
        isActive: true,
        centerLat: 23.8223,
        centerLng: 90.3657,
        radiusKm: 4.5,
      });
    } else {
      zone.centerLat = 23.8223;
      zone.centerLng = 90.3657;
      zone.radiusKm = 4.5;
      zone.isActive = true;
    }
    await zone.save();
    console.log('✅ Mirpur Grocery Zone (r=4.5km)');

    console.log('\n🎉 Grocery zones seeded!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

seedZones();
