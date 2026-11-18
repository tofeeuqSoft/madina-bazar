import dotenv from 'dotenv';
import Category from '../models/Category.js';
import connectDB from '../config/db.js';

dotenv.config();

const seedCategories = async () => {
  try {
    await connectDB();
    console.log('🌱 Seeding sample categories...\n');

    // Clear existing categories (optional)
    // await Category.deleteMany();

    // Root Categories
    const grocery = await Category.findOneAndUpdate(
      { slug: 'grocery' },
      {
        name: 'Grocery',
        slug: 'grocery',
        parentCategory: null,
        description: 'Daily grocery items',
        displayOrder: 1,
        isActive: true,
        type: 'GROCERY',
      },
      { upsert: true, new: true }
    );
    console.log('✅ Grocery');

    const readyToCook = await Category.findOneAndUpdate(
      { slug: 'ready-to-cook' },
      {
        name: 'Ready to Cook',
        slug: 'ready-to-cook',
        parentCategory: null,
        description: 'Frozen and ready to cook items',
        displayOrder: 2,
        isActive: true,
        type: 'READY_TO_COOK',
      },
      { upsert: true, new: true }
    );
    console.log('✅ Ready to Cook');

    const comboPack = await Category.findOneAndUpdate(
      { slug: 'combo-pack' },
      {
        name: 'Combo Pack',
        slug: 'combo-pack',
        parentCategory: null,
        description: 'Special combo offers',
        displayOrder: 3,
        isActive: true,
        type: 'COMBO',
      },
      { upsert: true, new: true }
    );
    console.log('✅ Combo Pack');

    // Grocery Subcategories
    const subCategories = [
      { name: 'Rice', slug: 'rice', parent: grocery._id, order: 1 },
      { name: 'Oil', slug: 'oil', parent: grocery._id, order: 2 },
      { name: 'Sugar', slug: 'sugar', parent: grocery._id, order: 3 },
      { name: 'Salt', slug: 'salt', parent: grocery._id, order: 4 },
      { name: 'Spices', slug: 'spices', parent: grocery._id, order: 5 },
      { name: 'Dal', slug: 'dal', parent: grocery._id, order: 6 },
      { name: 'Atta & Flour', slug: 'atta-flour', parent: grocery._id, order: 7 },
    ];

    for (const sub of subCategories) {
      await Category.findOneAndUpdate(
        { slug: sub.slug },
        {
          name: sub.name,
          slug: sub.slug,
          parentCategory: sub.parent,
          displayOrder: sub.order,
          isActive: true,
          type: 'GROCERY',
        },
        { upsert: true, new: true }
      );
      console.log(`   └── ${sub.name}`);
    }

    // Ready to Cook Subcategories
    const rtcSubs = [
      { name: 'Frozen Food', slug: 'frozen-food', parent: readyToCook._id, order: 1 },
      { name: 'Chicken Items', slug: 'chicken-items', parent: readyToCook._id, order: 2 },
      { name: 'Nuggets', slug: 'nuggets', parent: readyToCook._id, order: 3 },
      { name: 'Samosa & Rolls', slug: 'samosa-rolls', parent: readyToCook._id, order: 4 },
      { name: 'Paratha', slug: 'paratha', parent: readyToCook._id, order: 5 },
      { name: 'Kabab', slug: 'kabab', parent: readyToCook._id, order: 6 },
    ];

    for (const sub of rtcSubs) {
      await Category.findOneAndUpdate(
        { slug: sub.slug },
        {
          name: sub.name,
          slug: sub.slug,
          parentCategory: sub.parent,
          displayOrder: sub.order,
          isActive: true,
          type: 'READY_TO_COOK',
        },
        { upsert: true, new: true }
      );
      console.log(`   └── ${sub.name}`);
    }

    // Combo Pack Subcategories
    const comboSubs = [
      { name: 'Family Combo', slug: 'family-combo', parent: comboPack._id, order: 1 },
      { name: 'Monthly Grocery Combo', slug: 'monthly-grocery-combo', parent: comboPack._id, order: 2 },
      { name: 'Budget Combo', slug: 'budget-combo', parent: comboPack._id, order: 3 },
      { name: 'Special Offer Combo', slug: 'special-offer-combo', parent: comboPack._id, order: 4 },
    ];

    for (const sub of comboSubs) {
      await Category.findOneAndUpdate(
        { slug: sub.slug },
        {
          name: sub.name,
          slug: sub.slug,
          parentCategory: sub.parent,
          displayOrder: sub.order,
          isActive: true,
          type: 'COMBO',
        },
        { upsert: true, new: true }
      );
      console.log(`   └── ${sub.name}`);
    }

    console.log('\n🎉 Sample categories seeded successfully!');

    // Backfill type on legacy categories (slug → type)
    const typeMap = {
      GROCERY: ['grocery', 'rice', 'oil', 'sugar', 'salt', 'spices', 'dal', 'atta-flour'],
      READY_TO_COOK: ['ready-to-cook', 'frozen-food', 'chicken-items', 'nuggets', 'samosa-rolls', 'paratha', 'kabab'],
      COMBO: ['combo-pack', 'family-combo', 'monthly-grocery-combo', 'budget-combo', 'special-offer-combo'],
    };
    for (const [type, slugs] of Object.entries(typeMap)) {
      const r = await Category.updateMany(
        { slug: { $in: slugs }, $or: [{ type: { $exists: false } }, { type: '' }] },
        { $set: { type } }
      );
      if (r.modifiedCount) console.log(`🔄 ${type}: backfilled ${r.modifiedCount} categorie(s)`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

seedCategories();
