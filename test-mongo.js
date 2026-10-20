require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('【entity-mongodb¦canonical_name=MongoDB】');

async function test() {
  const uri = process.env.MONGODB_URI;
  console.log('Connecting to:', uri.split('@')[1].split('/')[0]);
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ 【entity-MongoDB¦canonical_name=MongoDB】 Connected!');
    
    const db = client.db('pricepulse');
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    // Insert test data
    const result = await db.collection('stores').insertOne({
      name: 'Daraz Test',
      slug: 'daraz',
      country_code: 'BD',
      type: 'marketplace',
      created_at: new Date()
    });
    console.log('✅ Test data inserted:', result.insertedId);
    
    const count = await db.collection('stores').countDocuments();
    console.log('Total stores:', count);
    
    await client.close();
    console.log('✅ Test Success - pricepulse DB ready!');
    
  } catch (e) {
    console.error('❌ FAILED:', e.message);
  }
}

test();
