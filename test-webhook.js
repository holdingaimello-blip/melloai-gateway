const crypto = require('crypto');

// Generate Stripe webhook signature
function generateStripeSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

// Test payload
const payload = JSON.stringify({
  id: 'evt_test_gateway_001',
  object: 'event',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_gateway_001',
      metadata: {
        project_id: 'pagepulse',
        plan: 'pro'
      },
      customer: 'cus_test_gateway_001',
      subscription: 'sub_test_gateway_001'
    }
  }
});

console.log('Payload:', payload);
console.log('\n--- Per generare firma valida, esegui questo con STRIPE_WEBHOOK_SECRET ---');
console.log('Node.js code per generare signature:');
console.log(`
const crypto = require('crypto');
const secret = process.env.STRIPE_WEBHOOK_SECRET;
const payload = '${payload.replace(/'/g, "\\'")}';
const timestamp = Math.floor(Date.now() / 1000);
const signedPayload = timestamp + '.' + payload;
const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
console.log('Stripe-Signature: t=' + timestamp + ',v1=' + signature);
`);
