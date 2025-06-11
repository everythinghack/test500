#!/usr/bin/env node

// Script to manually add MaiHu's data to PostgreSQL
// Based on the production data we identified earlier

const { Client } = require('pg');

async function recoverMaiHuData() {
  console.log('🔄 RECOVERING MAIHU DATA TO POSTGRESQL');
  console.log('=====================================');
  
  // Check if we're in production environment
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL not found. This script should run on Railway.');
    console.log('💡 Use: railway run node recover-maihu-data.js');
    return;
  }
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
    
    // MaiHu's data from our previous analysis
    const maihuData = {
      telegram_id: '1170425263', // From debug/referrals endpoint
      username: 'google_baba440', // From production data
      first_name: 'MaiHu',
      points: 120, // The 120 BP we need to recover
      created_at: new Date('2025-06-10').toISOString() // Estimated date
    };
    
    // Check if MaiHu already exists
    const existingUser = await client.query(
      'SELECT * FROM Users WHERE telegram_id = $1',
      [maihuData.telegram_id]
    );
    
    if (existingUser.rows.length > 0) {
      console.log('✅ MaiHu already exists in PostgreSQL:', existingUser.rows[0]);
      return;
    }
    
    // Insert MaiHu's data
    const insertResult = await client.query(`
      INSERT INTO Users (telegram_id, username, first_name, points, created_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      maihuData.telegram_id,
      maihuData.username, 
      maihuData.first_name,
      maihuData.points,
      maihuData.created_at
    ]);
    
    console.log('✅ MaiHu data recovered successfully!');
    console.log('📊 Recovered User:', insertResult.rows[0]);
    
    // Add a point transaction record
    await client.query(`
      INSERT INTO PointTransactions (user_id, points_change, reason, timestamp)
      VALUES ($1, $2, $3, $4)
    `, [
      maihuData.telegram_id,
      maihuData.points,
      'data_recovery',
      maihuData.created_at
    ]);
    
    console.log('✅ Point transaction record added');
    
    // Verify recovery
    const verification = await client.query('SELECT COUNT(*) as total_users FROM Users');
    console.log(`✅ Total users in database: ${verification.rows[0].total_users}`);
    
  } catch (error) {
    console.error('❌ Recovery failed:', error.message);
  } finally {
    await client.end();
  }
}

// Export for API endpoint use
module.exports = { recoverMaiHuData };

// Run if called directly
if (require.main === module) {
  recoverMaiHuData();
}