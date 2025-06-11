#!/usr/bin/env node

// Script to restore MaiHu's data by calling the profile endpoint
// This will trigger ensureUser middleware to create the user

const fetch = require('node-fetch');

async function restoreMaiHu() {
  console.log('🔄 RESTORING MAIHU VIA PROFILE ENDPOINT');
  console.log('====================================');
  
  const railwayUrl = 'https://bybit-event-mini-app-production-ae87.up.railway.app';
  
  // MaiHu's Telegram data (from our analysis)
  const maihuTelegramData = {
    id: 1170425263,  // The telegram_id we found
    username: 'google_baba440',  // The username we found
    first_name: 'MaiHu'  // The name we found
  };
  
  try {
    console.log('📞 Calling profile endpoint to trigger user creation...');
    
    const response = await fetch(`${railwayUrl}/api/profile?telegramUser=${encodeURIComponent(JSON.stringify(maihuTelegramData))}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.text();
    console.log('📊 Response status:', response.status);
    console.log('📊 Response body:', result);
    
    if (response.ok) {
      console.log('✅ MaiHu created successfully!');
      
      // Now manually set the points via admin endpoint
      console.log('💰 Setting MaiHu\'s points to 120...');
      
      // Unfortunately, we need a direct database update endpoint for points
      // For now, let's just report success of user creation
      console.log('📝 User created. Points will need manual database update.');
      
    } else {
      console.log('❌ Failed to create user:', result);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the restoration
restoreMaiHu();