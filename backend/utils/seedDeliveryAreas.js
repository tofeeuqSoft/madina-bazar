import dotenv from 'dotenv';
import DeliveryArea from '../models/DeliveryArea.js';
import connectDB from '../config/db.js';

dotenv.config();

const seedDeliveryAreas = async () => {
  try {
    await connectDB();
    console.log('🌱 Seeding delivery areas...\n');

    // Phase 1 - Mirpur Only (grocery delivery enabled)
    const mirpur = await DeliveryArea.findOneAndUpdate(
      { name: 'Mirpur' },
      {
        name: 'Mirpur',
        city: 'Dhaka',
        parentArea: null,
        deliveryCharge: 60,
        minimumOrderAmount: 0,
        estimatedDeliveryTime: '2-4 Hours',
        isActive: true,
        groceryDelivery: true,
        deliveryNote: 'Grocery delivery available only in Mirpur',
      },
      { upsert: true, new: true }
    );
    console.log('✅ Mirpur (Active + Grocery) - ৳60');

    // Optional: Some sub areas of Mirpur (future ready)
    const subAreas = [
      { name: 'Mirpur 1', charge: 50 },
      { name: 'Mirpur 2', charge: 50 },
      { name: 'Mirpur 10', charge: 60 },
      { name: 'Mirpur 11', charge: 60 },
      { name: 'Mirpur 12', charge: 70 },
    ];

    for (const sub of subAreas) {
      await DeliveryArea.findOneAndUpdate(
        { name: sub.name },
        {
          name: sub.name,
          city: 'Dhaka',
          parentArea: mirpur._id,
          deliveryCharge: sub.charge,
          minimumOrderAmount: 0,
          estimatedDeliveryTime: '1-3 Hours',
          isActive: false, // Disabled by default (Phase 1 only main Mirpur)
        },
        { upsert: true, new: true }
      );
      console.log(`   └── ${sub.name} (Disabled for now)`);
    }

    // Future areas (disabled)
    const futureAreas = ['Mohammadpur', 'Dhanmondi', 'Uttara', 'Banani', 'Gulshan'];
    for (const name of futureAreas) {
      await DeliveryArea.findOneAndUpdate(
        { name },
        {
          name,
          city: 'Dhaka',
          deliveryCharge: 80,
          minimumOrderAmount: 0,
          estimatedDeliveryTime: '3-5 Hours',
          isActive: false,
        },
        { upsert: true, new: true }
      );
      console.log(`⏭️  ${name} (Disabled - Future)`);
    }

    console.log('\n🎉 Delivery areas seeded successfully!');
    console.log('📌 Currently Active: Only Mirpur');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

seedDeliveryAreas();
