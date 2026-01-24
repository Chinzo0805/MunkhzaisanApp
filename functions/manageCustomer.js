const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

try {
  initializeApp();
} catch (e) {}

const db = getFirestore();

exports.manageCustomer = functions.region('asia-east2').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }
  
  try {
    const { action, customerData, customerId } = req.body;
    
    if (!action || !customerData) {
      return res.status(400).send({ error: 'Missing required fields' });
    }
    
    if (action === 'add') {
      const docRef = await db.collection('customers').add({
        ...customerData,
        createdAt: new Date().toISOString(),
      });
      
      console.log(`Added new customer with ID: ${docRef.id}`);
      
      res.status(200).send({
        success: true,
        message: 'Customer added successfully',
        customerId: docRef.id,
      });
      
    } else if (action === 'update') {
      if (!customerId) {
        return res.status(400).send({ error: 'Missing customerId for update' });
      }
      
      await db.collection('customers').doc(customerId).update({
        ...customerData,
        updatedAt: new Date().toISOString(),
      });
      
      console.log(`Updated customer with ID: ${customerId}`);
      
      res.status(200).send({
        success: true,
        message: 'Customer updated successfully',
        customerId,
      });
      
    } else {
      return res.status(400).send({ error: 'Invalid action. Use "add" or "update"' });
    }
    
  } catch (error) {
    console.error('Error in manageCustomer:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
