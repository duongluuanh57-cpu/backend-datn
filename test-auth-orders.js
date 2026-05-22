import mongoose from 'mongoose';
import dotenv from 'dotenv';
import http from 'http';
import jwt from 'jsonwebtoken';
dotenv.config();

async function testOrdersAPIWithAuth() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/l-essence');
    console.log('Connected to MongoDB');

    // Get admin user to create token
    const UserSchema = new mongoose.Schema({}, { strict: false });
    const UserModel = mongoose.model('User', UserSchema);
    const adminUser = await UserModel.findOne({ role: { $in: ['ADMIN', 'SUBADMIN'] } }).lean();

    if (!adminUser) {
      console.log('No admin user found!');
      await mongoose.disconnect();
      return;
    }

    console.log('Found admin user:', adminUser.username);
    console.log('Admin user ID:', adminUser._id.toString());
    console.log('Admin user tenantId:', adminUser.tenantId);

    // Create JWT token (simplified - should use AuthService in production)
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: adminUser._id, role: adminUser.role, tenantId: adminUser.tenantId },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    console.log('Generated JWT token');

    await mongoose.disconnect();

    // Test API with token
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: '/api/orders/admin/all?page=1&limit=10',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      console.log('Response status:', res.statusCode);
      console.log('Response headers:', JSON.stringify(res.headers, null, 2));
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response body:', data);
        try {
          const jsonResponse = JSON.parse(data);
          console.log('Parsed response:', JSON.stringify(jsonResponse, null, 2));
          
          if (jsonResponse.data && jsonResponse.data.orders) {
            console.log('Orders count:', jsonResponse.data.orders.length);
            if (jsonResponse.data.orders.length > 0) {
              console.log('First order:', JSON.stringify(jsonResponse.data.orders[0], null, 2));
            }
          }
        } catch (e) {
          console.log('Failed to parse JSON:', e.message);
        }
      });
    });

    req.on('error', (error) => {
      console.log('Request error:', error.message);
    });

    req.end();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testOrdersAPIWithAuth();
