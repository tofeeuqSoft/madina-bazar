import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import SupportCategory from '../models/SupportCategory.js';
import SupportTeam from '../models/SupportTeam.js';
import CannedResponse from '../models/CannedResponse.js';
import FAQArticle from '../models/FAQArticle.js';

dotenv.config();

const CATEGORIES = [
  'Order Issue', 'Payment Issue', 'Delivery Issue', 'Grocery Delivery', 'Nationwide Delivery',
  'Return Request', 'Refund Request', 'Cancellation', 'Product Issue', 'Wrong Product',
  'Damaged Product', 'Missing Product', 'Account Issue', 'Technical Problem', 'Coupon Issue', 'Other',
];

const TEAMS = [
  { name: 'General Support', teamType: 'GENERAL_SUPPORT', assignmentRule: 'ROUND_ROBIN' },
  { name: 'Payment Support', teamType: 'PAYMENT_SUPPORT', assignmentRule: 'CATEGORY_BASED' },
  { name: 'Delivery Support', teamType: 'DELIVERY_SUPPORT', assignmentRule: 'CATEGORY_BASED' },
  { name: 'Return Team', teamType: 'RETURN_TEAM', assignmentRule: 'LEAST_BUSY' },
  { name: 'Refund Team', teamType: 'REFUND_TEAM', assignmentRule: 'LEAST_BUSY' },
  { name: 'Technical Team', teamType: 'TECHNICAL_TEAM', assignmentRule: 'SKILL_BASED' },
  { name: 'Product Support', teamType: 'PRODUCT_SUPPORT', assignmentRule: 'CATEGORY_BASED' },
  { name: 'VIP Support', teamType: 'VIP_SUPPORT', assignmentRule: 'LEAST_BUSY' },
];

const CANNED = [
  { name: 'Refund info', slug: 'refund', category: 'REFUND', template: 'আসসালামু আলাইকুম {customer_name}, আপনার {order_id} এর রিফান্ড রিকোয়েস্টটি আমরা পেয়েছি। অনুমোদনের পর ৩-৫ কর্মদিবসে টাকা পৌঁছে যাবে।', isApprovedForAI: true },
  { name: 'Return info', slug: 'return', category: 'RETURN', template: 'আপনার রিটার্ন রিকোয়েস্ট গৃহীত হয়েছে। আমাদের টিম শীঘ্রই যোগাযোগ করবে।', isApprovedForAI: true },
  { name: 'Delivery info', slug: 'delivery', category: 'DELIVERY', template: 'আপনার ডেলিভারি বর্তমানে প্রসেসিং-এ আছে। ট্র্যাকিং আপডেট SMS-এ পাঠানো হবে।', isApprovedForAI: true },
  { name: 'Payment info', slug: 'payment', category: 'PAYMENT', template: 'পেমেন্ট সংক্রান্ত সমস্যার জন্য Transaction ID সহ জানান, আমরা যাচাই করছি।', isApprovedForAI: true },
  { name: 'Cancel info', slug: 'cancel', category: 'CANCEL', template: 'অর্ডার ক্যান্সেল রিকোয়েস্ট গৃহীত হয়েছে। কনফার্ম হলে জানিয়ে দেওয়া হবে।', isApprovedForAI: true },
  { name: 'Order status', slug: 'order-status', category: 'ORDER_STATUS', template: 'আপনার {order_id} অর্ডারটি বর্তমানে {status} অবস্থায় আছে।', isApprovedForAI: true },
];

const FAQS = [
  { title: 'How do I track my order?', slug: 'how-do-i-track-my-order', category: 'ORDERS', tags: ['order', 'tracking'], content: 'Go to Orders page and click Track. You will see live status updates.' },
  { title: 'Which payment methods are supported?', slug: 'payment-methods', category: 'PAYMENTS', tags: ['bkash', 'nagad', 'cod'], content: 'We support Cash on Delivery, bKash, Nagad, Cards and Bank Transfer.' },
  { title: 'Grocery delivery areas', slug: 'grocery-delivery-areas', category: 'GROCERY', tags: ['grocery', 'zone'], content: 'Grocery delivery is available inside configured zones. Enter your location to check.' },
  { title: 'How to request a return?', slug: 'how-to-request-return', category: 'RETURNS', tags: ['return'], content: 'Create a support ticket with category Return Request and share order ID + reason.' },
  { title: 'Refund timeline', slug: 'refund-timeline', category: 'REFUNDS', tags: ['refund'], content: 'Approved refunds are processed within 3-5 working days to the original method.' },
];

const run = async () => {
  await connectDB();
  for (const [i, name] of CATEGORIES.entries()) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await SupportCategory.updateOne({ slug }, { $setOnInsert: { name, slug, sortOrder: i, isActive: true } }, { upsert: true });
  }
  for (const [i, t] of TEAMS.entries()) {
    const slug = t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await SupportTeam.updateOne({ slug }, { $setOnInsert: { ...t, slug, sortOrder: i, isActive: true } }, { upsert: true });
  }
  for (const c of CANNED) {
    await CannedResponse.updateOne({ slug: c.slug }, { $setOnInsert: { ...c, isActive: true } }, { upsert: true });
  }
  for (const f of FAQS) {
    await FAQArticle.updateOne({ slug: f.slug }, { $setOnInsert: { ...f, isActive: true } }, { upsert: true });
  }
  console.log('✅ Support seed complete');
  process.exit(0);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
