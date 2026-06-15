import { shopifyGraphQL } from './client';
import { env } from '../env';

/**
 * Webhook subscription'ları Shopify Admin API üzerinden register et.
 * `appUrl` public erişilebilir olmalı (production'da APP_URL veya ngrok).
 *
 * Webhook secret = SHOPIFY_CLIENT_SECRET (OAuth app default).
 *
 * Tipik akış:
 *   await registerShopifyWebhooks() — bir kere çalıştır (admin panel butonu veya migration script)
 *   Mevcut topic'lere yeni endpoint'i atar; aynı topic + endpoint kombinasyonu varsa Shopify duplicate yaratmaz.
 */

const REQUIRED_TOPICS = [
  'ORDERS_CREATE',
  'ORDERS_UPDATED',
  'ORDERS_PAID',
  'ORDERS_CANCELLED',
  'ORDERS_FULFILLED',
  'PRODUCTS_CREATE',
  'PRODUCTS_UPDATE',
  'PRODUCTS_DELETE',
  'APP_UNINSTALLED',
] as const;

type Topic = (typeof REQUIRED_TOPICS)[number];

interface CreateResp {
  webhookSubscriptionCreate: {
    webhookSubscription: { id: string; topic: string } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

interface ListResp {
  webhookSubscriptions: {
    edges: Array<{
      node: {
        id: string;
        topic: string;
        endpoint:
          | { __typename: 'WebhookHttpEndpoint'; callbackUrl: string }
          | { __typename: string };
      };
    }>;
  };
}

const LIST_QUERY = /* GraphQL */ `
  query Subs {
    webhookSubscriptions(first: 100) {
      edges {
        node {
          id
          topic
          endpoint {
            __typename
            ... on WebhookHttpEndpoint {
              callbackUrl
            }
          }
        }
      }
    }
  }
`;

const CREATE_MUTATION = /* GraphQL */ `
  mutation Create($topic: WebhookSubscriptionTopic!, $url: URL!) {
    webhookSubscriptionCreate(
      topic: $topic
      webhookSubscription: { format: JSON, callbackUrl: $url }
    ) {
      webhookSubscription {
        id
        topic
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const DELETE_MUTATION = /* GraphQL */ `
  mutation Del($id: ID!) {
    webhookSubscriptionDelete(id: $id) {
      deletedWebhookSubscriptionId
      userErrors {
        field
        message
      }
    }
  }
`;

export interface RegisterResult {
  created: Array<{ topic: string; id: string }>;
  alreadyExists: Array<{ topic: string; callbackUrl: string }>;
  errors: Array<{ topic: string; error: string }>;
  callbackUrl: string;
}

export async function registerShopifyWebhooks(overrideAppUrl?: string): Promise<RegisterResult> {
  const appUrl = overrideAppUrl || env.APP_URL;
  if (!appUrl) throw new Error('APP_URL set değil');
  const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/shopify/webhooks`;

  // Mevcut subscriptions'ları çek
  const list = await shopifyGraphQL<ListResp>(LIST_QUERY);
  const existing = new Map<string, string>(); // topic -> callbackUrl
  for (const edge of list.webhookSubscriptions.edges) {
    if (edge.node.endpoint.__typename === 'WebhookHttpEndpoint') {
      existing.set(edge.node.topic, (edge.node.endpoint as { callbackUrl: string }).callbackUrl);
    }
  }

  const result: RegisterResult = {
    created: [],
    alreadyExists: [],
    errors: [],
    callbackUrl,
  };

  for (const topic of REQUIRED_TOPICS) {
    const existingUrl = existing.get(topic);
    if (existingUrl === callbackUrl) {
      result.alreadyExists.push({ topic, callbackUrl: existingUrl });
      continue;
    }

    try {
      const res = await shopifyGraphQL<CreateResp>(CREATE_MUTATION, { topic, url: callbackUrl });
      if (res.webhookSubscriptionCreate.userErrors.length > 0) {
        result.errors.push({
          topic,
          error: res.webhookSubscriptionCreate.userErrors.map((e) => e.message).join('; '),
        });
        continue;
      }
      const sub = res.webhookSubscriptionCreate.webhookSubscription;
      if (sub) result.created.push({ topic, id: sub.id });
    } catch (err) {
      result.errors.push({
        topic,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  return result;
}

/**
 * Bir specifik topic'i veya tüm webhook'ları sil.
 * Migration / cleanup için.
 */
export async function deleteShopifyWebhooks(filter?: { topic?: Topic }): Promise<number> {
  const list = await shopifyGraphQL<ListResp>(LIST_QUERY);
  let deleted = 0;
  for (const edge of list.webhookSubscriptions.edges) {
    if (filter?.topic && edge.node.topic !== filter.topic) continue;
    try {
      await shopifyGraphQL(DELETE_MUTATION, { id: edge.node.id });
      deleted += 1;
    } catch (err) {
      console.error(`Webhook silme hatası ${edge.node.topic}:`, err);
    }
  }
  return deleted;
}
