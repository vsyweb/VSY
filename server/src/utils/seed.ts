import { Admin } from '../models/Admin';
import { PricingRule } from '../models/PricingRule';

/**
 * Seeds a default admin user if none exists.
 */
export const seedAdmin = async () => {
  try {
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      await Admin.create({
        name: 'VSY Admin',
        email: process.env.ADMIN_EMAIL || 'admin@vsyboxcricket.com',
        password: process.env.ADMIN_PASSWORD || 'adminpassword123',
        role: 'admin',
      });
      console.log(`✅ Default admin seeded: ${process.env.ADMIN_EMAIL || 'admin@vsyboxcricket.com'}`);
    }

    const workerEmail = 'bookings@vsy.com';
    const workerExists = await Admin.findOne({ email: workerEmail });
    if (!workerExists) {
      await Admin.create({
        name: 'VSY Worker',
        email: workerEmail,
        password: '123456',
        role: 'worker',
      });
      console.log(`✅ Default worker seeded: ${workerEmail}`);
    }
    
    // Also seed default pricing if empty or outdated
    const existingRules = await PricingRule.find();
    const needsUpdate = existingRules.length < 8 || existingRules.some(r => r.endHour !== 18 && r.endHour !== 6);

    if (needsUpdate) {
      console.log('🌱 Generating/Repairing default pricing rules...');
      const defaultRules = [];
      const turfs: ('A' | 'B')[] = ['A', 'B'];
      
      // Clear existing if incomplete to avoid duplicates during re-seed
      if (existingRules.length > 0) {
        await PricingRule.deleteMany({});
      }
      
      for (const turfId of turfs) {
        // Day (6 AM - 6 PM)
        defaultRules.push({ turfId, dayType: 'weekday', startHour: 6, endHour: 18, price: 800 });
        // Night (6 PM - 6 AM)
        defaultRules.push({ turfId, dayType: 'weekday', startHour: 18, endHour: 6, price: 1200 });
        // Weekend Day (6 AM - 6 PM)
        defaultRules.push({ turfId, dayType: 'weekend', startHour: 6, endHour: 18, price: 1000 });
        // Weekend Night (6 PM - 6 AM)
        defaultRules.push({ turfId, dayType: 'weekend', startHour: 18, endHour: 6, price: 1500 });
      }
      
      await PricingRule.insertMany(defaultRules);
      console.log('✅ Default pricing rules seeded successfully for both turfs');
    } else {
      console.log('✅ Pricing rules already exist, skipping seed');
    }
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  }
};
