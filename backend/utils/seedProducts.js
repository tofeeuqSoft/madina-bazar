import dotenv from 'dotenv';
import slugify from 'slugify';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import connectDB from '../config/db.js';

dotenv.config();

// 20 dummy grocery products (BDT prices)
const PRODUCTS = [
  { name: 'Miniket Rice 5KG', cat: 'rice', sub: 'rice', type: 'GROCERY', brand: 'Fresh', regularPrice: 720, salePrice: 665, costPrice: 600, stock: 100, unit: 'Packet', featured: true, desc: 'Premium Miniket rice, 5kg packet. Perfect for daily cooking.' },
  { name: 'Basmati Rice 1KG', cat: 'grocery', sub: 'rice', type: 'GROCERY', brand: 'Dawat', regularPrice: 185, salePrice: 170, costPrice: 145, stock: 80, unit: 'Packet', featured: true, desc: 'Aromatic long-grain Basmati rice, 1kg.' },
  { name: 'Fresh Soybean Oil 5L', cat: 'grocery', sub: 'oil', type: 'GROCERY', brand: 'Fresh', regularPrice: 890, salePrice: 855, costPrice: 790, stock: 60, unit: 'Liter', featured: true, desc: 'Pure soybean oil, 5 liter bottle. Cholesterol free.' },
  { name: 'ACI Pure Sugar 1KG', cat: 'grocery', sub: 'sugar', type: 'GROCERY', brand: 'ACI', regularPrice: 145, salePrice: 138, costPrice: 122, stock: 150, unit: 'Packet', desc: 'Premium refined sugar, 1kg packet.' },
  { name: 'ACI Pure Salt 1KG', cat: 'grocery', sub: 'salt', type: 'GROCERY', brand: 'ACI', regularPrice: 45, salePrice: 42, costPrice: 35, stock: 200, unit: 'Packet', desc: 'Iodized pure salt, 1kg.' },
  { name: 'Radhuni Turmeric Powder 200g', cat: 'grocery', sub: 'spices', type: 'GROCERY', brand: 'Radhuni', regularPrice: 85, salePrice: 78, costPrice: 62, stock: 120, unit: 'Packet', desc: 'Pure turmeric powder, 200g packet.' },
  { name: 'Radhuni Chilli Powder 200g', cat: 'grocery', sub: 'spices', type: 'GROCERY', brand: 'Radhuni', regularPrice: 110, salePrice: 102, costPrice: 84, stock: 120, unit: 'Packet', desc: 'Hot red chilli powder, 200g.' },
  { name: 'Musur Dal 1KG', cat: 'grocery', sub: 'dal', type: 'GROCERY', brand: 'Fresh', regularPrice: 135, salePrice: 128, costPrice: 110, stock: 90, unit: 'Packet', desc: 'Premium red lentil (Musur dal), 1kg.' },
  { name: 'Fresh Atta 2KG', cat: 'grocery', sub: 'atta-flour', type: 'GROCERY', brand: 'Fresh', regularPrice: 150, salePrice: 142, costPrice: 125, stock: 110, unit: 'Packet', desc: 'Whole wheat atta, soft rotis, 2kg.' },
  { name: 'Farm Egg 12 Pcs', cat: 'grocery', sub: null, type: 'GROCERY', brand: 'Kazi Farms', regularPrice: 165, salePrice: 155, costPrice: 138, stock: 70, unit: 'Dozen', featured: true, desc: 'Fresh farm eggs, dozen pack.' },
  { name: 'Fresh Milk 1L', cat: 'grocery', sub: null, type: 'GROCERY', brand: 'Milk Vita', regularPrice: 95, salePrice: 90, costPrice: 78, stock: 50, unit: 'Liter', desc: 'Pasteurized fresh cow milk, 1 liter.' },
  { name: 'Deshi Onion 1KG', cat: 'grocery', sub: null, type: 'GROCERY', brand: '', regularPrice: 75, salePrice: 68, costPrice: 55, stock: 130, unit: 'KG', desc: 'Fresh deshi onion, 1kg.' },
  { name: 'Fresh Potato 1KG', cat: 'grocery', sub: null, type: 'GROCERY', brand: '', regularPrice: 45, salePrice: 40, costPrice: 32, stock: 140, unit: 'KG', desc: 'Fresh new potato, 1kg.' },
  { name: 'Broiler Chicken 1KG (Dressed)', cat: 'ready-to-cook', sub: 'chicken-items', type: 'READY_TO_COOK', brand: '', regularPrice: 210, salePrice: 199, costPrice: 175, stock: 40, unit: 'KG', featured: true, desc: 'Fresh dressed broiler chicken, per kg.' },
  { name: 'Frozen Paratha 10 Pcs', cat: 'ready-to-cook', sub: 'paratha', type: 'READY_TO_COOK', brand: 'Golden Harvest', regularPrice: 150, salePrice: 140, costPrice: 115, stock: 60, unit: 'Packet', desc: 'Crispy frozen paratha, 10 pieces family pack.' },
  { name: 'Chicken Nuggets 500g', cat: 'ready-to-cook', sub: 'nuggets', type: 'READY_TO_COOK', brand: 'Kazi Farms', regularPrice: 320, salePrice: 299, costPrice: 250, stock: 45, unit: 'Box', desc: 'Crispy chicken nuggets, 500g box.' },
  { name: 'Beef Kabab 500g', cat: 'ready-to-cook', sub: 'kabab', type: 'READY_TO_COOK', brand: 'Golden Harvest', regularPrice: 450, salePrice: 425, costPrice: 360, stock: 35, unit: 'Box', desc: 'Juicy frozen beef kabab, 500g.' },
  { name: 'Vegetable Samosa 10 Pcs', cat: 'ready-to-cook', sub: 'samosa-rolls', type: 'READY_TO_COOK', brand: '', regularPrice: 120, salePrice: 110, costPrice: 85, stock: 55, unit: 'Packet', desc: 'Frozen vegetable samosa, 10 pieces.' },
  { name: 'Instant Noodles 8 Pack', cat: 'grocery', sub: null, type: 'GROCERY', brand: 'Maggi', regularPrice: 190, salePrice: 178, costPrice: 150, stock: 100, unit: 'Box', desc: 'Masala instant noodles, 8 pack family box.' },
  { name: 'Ispahani Tea 400g', cat: 'grocery', sub: null, type: 'GROCERY', brand: 'Ispahani', regularPrice: 240, salePrice: 228, costPrice: 200, stock: 85, unit: 'Packet', featured: true, desc: 'Premium black tea (Mirzapore), 400g.' },
];

const seedProducts = async () => {
  try {
    await connectDB();
    console.log('🌱 Seeding 20 dummy products...\n');

    let created = 0;
    let skipped = 0;

    for (let i = 0; i < PRODUCTS.length; i++) {
      const p = PRODUCTS[i];
      const slug = slugify(p.name, { lower: true, strict: true });
      const sku = `MB-P${String(i + 1).padStart(3, '0')}`;

      const category = await Category.findOne({ slug: p.cat, isActive: true });
      if (!category) {
        console.log(`⚠️  Category "${p.cat}" not found — run "npm run seed:categories" first. Skipping ${p.name}`);
        skipped++;
        continue;
      }
      let subcategory = null;
      if (p.sub) {
        subcategory = await Category.findOne({ slug: p.sub });
      }

      const exists = await Product.findOne({ $or: [{ slug }, { sku }] });
      if (exists) {
        console.log(`⏭️  Exists: ${p.name}`);
        skipped++;
        continue;
      }

      await Product.create({
        name: p.name,
        slug,
        category: category._id,
        subcategory: subcategory?._id || null,
        productType: p.type,
        brand: p.brand || '',
        sku,
        regularPrice: p.regularPrice,
        salePrice: p.salePrice,
        costPrice: p.costPrice,
        stock: p.stock,
        minStock: 5,
        unit: p.unit,
        images: [],
        description: p.desc,
        isActive: true,
        isFeatured: p.featured || false,
      });
      console.log(`✅ ${i + 1}. ${p.name} — ৳${p.salePrice} (SKU: ${sku})`);
      created++;
    }

    const total = await Product.countDocuments();
    console.log(`\n🎉 Done! Created: ${created}, Skipped (exists): ${skipped}, Total products in DB: ${total}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

seedProducts();
