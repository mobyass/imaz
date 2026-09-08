import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-11-20.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const body = await req.text();
  const sig  = req.headers.get('stripe-signature');

  if (!sig) {
    return new Response('Signature manquante', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {

      // Paiement confirmé → passe à pro
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const user_id = session.metadata?.user_id;
        if (user_id) {
          await supabase.from('profiles')
            .update({ plan: 'pro', updated_at: new Date().toISOString() })
            .eq('user_id', user_id);
          console.log('Plan → pro:', user_id);
        }
        break;
      }

      // Renouvellement OK → maintient pro
      case 'invoice.payment_succeeded': {
        const invoice    = event.data.object as Stripe.Invoice;
        const sub        = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const user_id    = sub.metadata?.user_id;
        if (user_id) {
          await supabase.from('profiles')
            .update({ plan: 'pro', updated_at: new Date().toISOString() })
            .eq('user_id', user_id);
        }
        break;
      }

      // Paiement échoué / abonnement annulé → repasse à free
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        const obj     = event.data.object as Stripe.Subscription | Stripe.Invoice;
        const subId   = (obj as Stripe.Invoice).subscription ?? (obj as Stripe.Subscription).id;
        if (subId) {
          const sub     = await stripe.subscriptions.retrieve(subId as string);
          const user_id = sub.metadata?.user_id;
          if (user_id) {
            await supabase.from('profiles')
              .update({ plan: 'free', updated_at: new Date().toISOString() })
              .eq('user_id', user_id);
            console.log('Plan → free:', user_id);
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
