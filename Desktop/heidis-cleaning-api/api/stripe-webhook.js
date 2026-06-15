const crypto = require('crypto');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: {
    bodyParser: false
  }
};

function generateGiftCardCode() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  for (let i = 0; i < 8; i += 1) {
    const randomIndex = crypto.randomInt(0, alphabet.length);
    code += alphabet[randomIndex];
  }

  return `HC-GC-${code.slice(0, 4)}-${code.slice(4)}`;
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    req.on('error', (error) => {
      reject(error);
    });
  });
}

async function handleGiftCardPurchase(paymentIntent) {
  const metadata = paymentIntent.metadata || {};
  const giftCardCode = generateGiftCardCode();

  const {
    senderName = '',
    senderEmail = '',
    recipientName = '',
    recipientEmail = '',
    personalMessage = '',
    giftCardAmount = '',
    giftCardDiscount = '',
    giftCardFinalAmount = ''
  } = metadata;

  console.log('Gift Card Purchase Detected');
  console.log(`PaymentIntent ID: ${paymentIntent.id}`);
  console.log(`Sender: ${senderName} <${senderEmail}>`);
  console.log(`Recipient: ${recipientName} <${recipientEmail}>`);
  console.log(`Gift Card Amount: ${giftCardAmount}`);
  console.log(`Gift Card Discount: ${giftCardDiscount}`);
  console.log(`Gift Card Final Amount: ${giftCardFinalAmount}`);
  console.log(`Gift Card Code: ${giftCardCode}`);

  return {
    giftCardCode,
    senderName,
    senderEmail,
    recipientName,
    recipientEmail,
    personalMessage,
    giftCardAmount,
    giftCardDiscount,
    giftCardFinalAmount
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Webhook configuration error' });
  }

  const signature = req.headers['stripe-signature'];

  if (!signature) {
    console.error('Missing Stripe signature header');
    return res.status(400).json({ error: 'Missing Stripe signature' });
  }

  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error.message);
    return res.status(400).json({ error: `Webhook Error: ${error.message}` });
  }

  if (event.type !== 'payment_intent.succeeded') {
    return res.status(200).json({ received: true });
  }

  try {
    const paymentIntentId = event.data.object && event.data.object.id;

    if (!paymentIntentId) {
      throw new Error('PaymentIntent ID not found in webhook event');
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const metadata = paymentIntent.metadata || {};

    if (metadata.isGiftCard !== 'true') {
      console.log(`Non-gift-card payment received for PaymentIntent ${paymentIntent.id}`);
      return res.status(200).json({ received: true });
    }

    await handleGiftCardPurchase(paymentIntent);

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing Stripe webhook:', error);
    return res.status(500).json({ error: 'Internal webhook processing error' });
  }
}
