import dotenv from 'dotenv';
import User from '../models/User.js';
import Role from '../models/Role.js';
import Settings from '../models/Settings.js';
import connectDB from '../config/db.js';
import { ROLE_PERMISSIONS, ALL_PERMISSIONS } from './permissions.js';

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();

    console.log('🌱 Seeding Madina Bazar database...\n');

    // ========== ROLES ==========
    const roleNames = Object.keys(ROLE_PERMISSIONS);

    for (const roleName of roleNames) {
      const exists = await Role.findOne({ name: roleName });
      if (!exists) {
        await Role.create({
          name: roleName,
          description: `${roleName.replace('_', ' ')} role`,
          permissions: ROLE_PERMISSIONS[roleName],
          isSystem: true,
        });
        console.log(`✅ Role created: ${roleName}`);
      } else {
        // Update permissions to latest
        exists.permissions = ROLE_PERMISSIONS[roleName];
        await exists.save();
        console.log(`🔄 Role updated: ${roleName}`);
      }
    }

    // ========== SUPER ADMIN ==========
    let superAdmin = await User.findOne({ role: 'SUPER_ADMIN' });

    if (!superAdmin) {
      superAdmin = await User.create({
        name: 'Super Admin',
        email: 'admin@madinabazar.com',
        phone: '01700000000',
        password: 'Admin@123456',
        role: 'SUPER_ADMIN',
        permissions: ['*'],
        isActive: true,
      });
      console.log('\n✅ Super Admin created');
      console.log('   Email    : admin@madinabazar.com');
      console.log('   Phone    : 01700000000');
      console.log('   Password : Admin@123456');
      console.log('   ⚠️  Change password after first login!\n');
    } else {
      console.log('\n⏭️  Super Admin already exists\n');
    }

    // ========== DEFAULT SETTINGS ==========
    const settingsExists = await Settings.findOne();
    if (!settingsExists) {
      await Settings.create({
        websiteName: 'Madina Bazar',
        phone: '01700000000',
        email: 'info@madinabazar.com',
        address: 'Mirpur, Dhaka',
        enableCOD: true,
        enableBkash: false,
        enableNagad: false,
        enableSSLCommerz: false,
        defaultDeliveryCharge: 60,
      });
      console.log('✅ Default Settings created\n');
    } else {
      console.log('⏭️  Settings already exists\n');
    }

    console.log('📋 Total Permissions available:', Object.keys(ALL_PERMISSIONS).length);
    console.log('🎉 Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

seedData();
