import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import DeliveryArea from '../models/DeliveryArea.js';
import connectDB from '../config/db.js';

dotenv.config();

const NAMES = [
  ['Rahim Uddin', '01711111111'], ['Karim Sheikh', '01722222222'],
  ['Fatema Begum', '01733333333'], ['Abdul Malek', '01744444444'],
  ['Nasrin Akter', '01755555555'], ['Hasan Ali', '01766666666'],
  ['Shirin Sultana', '01777777777'], ['Kamrul Islam', '01788888888'],
  ['Rina Parvin', '01799999999'], ['Jamal Hossain', '01811111111'],
];
const STREETS = ['House 12, Road 5', 'House 3, Road 11', 'Flat 4B, Road 2', 'House 27, Road 8', 'House 9, Block C'];
const STATUSES = [
  'Delivered', 'Delivered', 'Delivered', 'Delivered', 'Delivered',
  'Confirmed', 'Processing', 'Out for Delivery', 'Pending', 'Cancelled',
];
const PAY_METHODS = ['COD', 'COD', 'COD', 'BKASH', 'NAGAD'];
const COMMENTS = [
  ['5', 'Khub valo product, fresh chilo!'], ['5', 'Excellent quality, abar kinbo'],
  ['4', 'Valo, delivery ektu late chilo'], ['5', 'Original product, satisfied'],
  ['4', 'Mota muti valo'], ['3', 'Average, packing better hote parto'],
  ['5', 'Best price in Mirpur!'],
];

const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const rndInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const seedDummy = async () => {
  try {
    await connectDB();
    console.log('🌱 Seeding dummy data...\n');

    let area = await DeliveryArea.findOne({ name: 'Mirpur' });
    if (!area) {
      area = await DeliveryArea.create({
        name: 'Mirpur', city: 'Dhaka', deliveryCharge: 60,
        minimumOrderAmount: 0, estimatedDeliveryTime: '2-4 Hours',
        isActive: true, groceryDelivery: true,
        deliveryNote: 'Grocery delivery available only in Mirpur',
      });
      console.log('📍 Mirpur area auto-created');
    }
    const products = await Product.find({ isActive: true, stock: { $gt: 5 } });
    if (!products.length) throw new Error('No products with stock — add products first');

    // Customers
    const customers = [];
    for (const [name, phone] of NAMES) {
      const email = `${phone}@dummy.test`;
      let u = await User.findOne({ phone });
      if (!u) {
        u = await User.create({ name, email, phone, password: 'Dummy@123', role: 'CUSTOMER' });
        console.log(`👤 ${name}`);
      }
      customers.push(u);
    }

    // Orders across last 30 days
    let created = 0;
    const N = 30;
    for (let i = 0; i < N; i++) {
      const customer = rnd(customers);
      const product = rnd(products);
      const qty = rndInt(1, 3);
      if (product.stock < qty) continue;
      const price = product.salePrice || product.regularPrice;
      const subtotal = price * qty;
      const discount = Math.random() < 0.2 ? Math.round(subtotal * 0.05) : 0;
      const totalAmount = Math.max(0, subtotal + area.deliveryCharge - discount);
      const status = rnd(STATUSES);
      const method = rnd(PAY_METHODS);
      const daysAgo = rndInt(0, 29);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);

      const order = await Order.create({
        customer: customer._id,
        orderItems: [{
          product: product._id, name: product.name, quantity: qty,
          price, unit: product.unit,
          size: product.sizes?.[0] || '', color: product.colors?.[0]?.name || '',
        }],
        shippingAddress: {
          fullName: customer.name, phone: customer.phone,
          address: `${rnd(STREETS)}, Mirpur 10`, area: 'Mirpur',
          city: 'Dhaka', deliveryArea: area._id,
          latitude: 23.82 + (Math.random() - 0.5) * 0.05,
          longitude: 90.36 + (Math.random() - 0.5) * 0.05,
        },
        deliveryArea: area._id,
        paymentMethod: method,
        paymentStatus: status === 'Delivered' || (method !== 'COD' && status !== 'Cancelled') ? 'Paid' : status === 'Cancelled' ? 'Failed' : 'Pending',
        orderStatus: status,
        subtotal, deliveryCharge: area.deliveryCharge, discount, totalAmount,
        statusHistory: [{ status: 'Pending', changedBy: customer._id, note: 'Order placed', timestamp: date }],
        createdAt: date, updatedAt: date,
      });

      await Product.findByIdAndUpdate(product._id, { $inc: { stock: -qty, soldCount: status === 'Cancelled' ? 0 : qty } });
      created++;
    }
    console.log(`\n🧾 Orders created: ${created}`);

    // Reviews (5★ first bias, verified where bought)
    let reviews = 0;
    for (const product of products.slice(0, 12)) {
      const n = rndInt(1, 4);
      const buyers = [...customers].sort(() => Math.random() - 0.5).slice(0, n);
      for (const b of buyers) {
        const [stars, text] = rnd(COMMENTS);
        try {
          const bought = await Order.exists({ customer: b._id, orderStatus: { $ne: 'Cancelled' }, 'orderItems.product': product._id });
          await Review.findOneAndUpdate(
            { product: product._id, user: b._id },
            { rating: Number(stars), comment: text, verifiedPurchase: Boolean(bought) },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          reviews++;
        } catch (_) {}
      }
      const agg = await Review.aggregate([
        { $match: { product: product._id } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]);
      await Product.findByIdAndUpdate(product._id, {
        ratingAvg: agg[0] ? +agg[0].avg.toFixed(1) : 0,
        ratingCount: agg[0] ? agg[0].count : 0,
      });
    }
    console.log(`⭐ Reviews created: ${reviews}`);

    console.log('\n🎉 Dummy data ready! (customers password: Dummy@123)');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

seedDummy();
