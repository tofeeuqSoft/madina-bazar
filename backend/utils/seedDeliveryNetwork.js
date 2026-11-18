import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import CourierProvider from '../models/CourierProvider.js';
import GroceryZone from '../models/GroceryZone.js';

dotenv.config();

// Own-network seed: providers start INACTIVE (admin enables with real
// credentials); existing zones keep their data, only missing network
// fields are backfilled — zone expansion stays a pure admin action.
const PROVIDERS = [
  { code: 'STEADFAST', name: 'Steadfast', priority: 1 },
  { code: 'PATHAO', name: 'Pathao', priority: 2 },
  { code: 'CARIBEE', name: 'Caribee', priority: 3 },
  { code: 'PAPERFLY', name: 'Paperfly', priority: 4 },
];

const run = async () => {
  await connectDB();
  for (const p of PROVIDERS) {
    await CourierProvider.updateOne(
      { code: p.code },
      { $setOnInsert: { ...p, status: 'INACTIVE', autoShipment: true, codSupported: true, returnSupported: true, trackingSupported: true, cancellationSupported: true, fallbackAllowed: true } },
      { upsert: true }
    );
  }
  const zones = await GroceryZone.find({});
  let backfilled = 0;
  for (const z of zones) {
    let touched = false;
    if (!z.deliveryMode) {
      z.deliveryMode = 'OWN_DELIVERY';
      touched = true;
    }
    if (z.riderCapacity == null) {
      z.riderCapacity = 100;
      touched = true;
    }
    if (z.actualDeliveryCost == null) {
      z.actualDeliveryCost = 40;
      touched = true;
    }
    if (touched) {
      await z.save({ validateBeforeSave: false });
      backfilled += 1;
    }
  }
  console.log(`✅ Delivery network seed: ${PROVIDERS.length} courier providers, ${backfilled} zones backfilled`);
  process.exit(0);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
