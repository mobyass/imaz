import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-11-20.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});

const PRICES: Record<string, string> = {
  monthly: 'price_1UCZkGDS5xnAYbxUJgCtOyHY',
  yearly:  'price_1UCZkKDS5xnAYbxUzTEBgYMT',
};

const APP_URL = Deno.env.get('APP_URL') || 'https://armaz25.vercel.app';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_id, email, billing } = await req.json();
    if (!user_id || !email) {
      return new Response(JSON.stringify({ error: 'user_id et email requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const priceId = PRICES[billing] ?? PRICES.monthly;

    const session = await stripe.checkout.sessions.create({
      mode:                 'subscription',
      payment_method_types: ['card'],
      line_items:           [{ price: priceId, quantity: 1 }],
      success_url:          `${APP_URL}/index?checkout=success`,
      cancel_url:           `${APP_URL}/pricing`,
      customer_email:       email,
      metadata:             { user_id, billing },
      subscription_data:    { metadata: { user_id } },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('create-checkout error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
