import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import Warehouse from '../models/Warehouse.js';

dotenv.config();

const run = async () => {
  await connectDB();
  const existing = await Warehouse.findOne({ code: 'MAIN' });
  if (!existing) {
    await Warehouse.create({ name: 'Main Warehouse', code: 'MAIN', district: 'Dhaka', isDefault: true, status: 'ACTIVE' });
    console.log('✅ Default MAIN warehouse created');
  } else {
    existing.isDefault = true;
    await existing.save();
    console.log('✅ MAIN warehouse ensured default');
  }
  // Product.stock → InventoryStock migration is lazy (ensureStock on first touch).
  console.log('ℹ️  InventoryStock backfills lazily from Product.stock on first operation.');
  process.exit(0);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
