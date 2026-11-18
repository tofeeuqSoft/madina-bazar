import dotenv from 'dotenv';
import NationwideDeliveryCharge from '../models/NationwideDeliveryCharge.js';
import FreeDeliveryRule from '../models/FreeDeliveryRule.js';
import ShipmentRule from '../models/ShipmentRule.js';
import connectDB from '../config/db.js';

dotenv.config();

const seedDelivery = async () => {
  try {
    await connectDB();
    console.log('🌱 Seeding delivery management defaults...\n');

    const districts = [
      ['Dhaka', 80],
      ['Chittagong', 100],
      ['Chattogram', 100],
      ['Rajshahi', 120],
      ['Khulna', 120],
      ['Sylhet', 120],
      ['Other', 130],
    ];
    for (const [district, charge] of districts) {
      await NationwideDeliveryCharge.findOneAndUpdate(
        { district: { $regex: `^${district}$`, $options: 'i' } },
        { district, charge, isActive: true },
        { upsert: true, new: true }
      );
      console.log(`✅ ${district} → ৳${charge}`);
    }

    let free = await FreeDeliveryRule.findOne().sort({ updatedAt: -1 });
    if (!free) {
      free = await FreeDeliveryRule.create({ isActive: false, minimumOrderAmount: 1000, applicableTo: 'ALL' });
      console.log('✅ Free delivery rule (OFF, ৳1000, ALL)');
    } else {
      console.log('⏭️  Free delivery rule exists');
    }

    let ship = await ShipmentRule.findOne();
    if (!ship) {
      await ShipmentRule.create({ mode: 'SINGLE_SHIPMENT', isActive: true });
      console.log('✅ Shipment rule (SINGLE_SHIPMENT)');
    } else {
      console.log('⏭️  Shipment rule exists');
    }

    console.log('\n🎉 Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

seedDelivery();
