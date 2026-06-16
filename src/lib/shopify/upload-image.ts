/**
 * Görseli Shopify Files'a yükler → kalıcı cdn.shopify.com URL döndürür.
 * Akış: stagedUploadsCreate → GCS'e multipart POST → fileCreate → işlenince image.url poll.
 * Ekstra depolama (S3 vs) GEREKMEZ; görsel doğrudan Shopify CDN'ine gider.
 */
import { shopifyGraphQL } from './client';

interface StagedTarget {
  url: string;
  resourceUrl: string;
  parameters: { name: string; value: string }[];
}

const STAGED_MUTATION = /* GraphQL */ `
  mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets { url resourceUrl parameters { name value } }
      userErrors { field message }
    }
  }
`;

const FILE_CREATE_MUTATION = /* GraphQL */ `
  mutation fileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files { id fileStatus }
      userErrors { field message }
    }
  }
`;

const FILE_STATUS_QUERY = /* GraphQL */ `
  query fileStatus($id: ID!) {
    node(id: $id) {
      ... on MediaImage { fileStatus image { url } }
    }
  }
`;

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

export async function uploadImageToShopifyFiles(
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
): Promise<UploadResult> {
  try {
    // 1) Staged upload target
    const staged = await shopifyGraphQL<{
      stagedUploadsCreate: { stagedTargets: StagedTarget[]; userErrors: { message: string }[] };
    }>(STAGED_MUTATION, {
      input: [{ resource: 'IMAGE', filename, mimeType, httpMethod: 'POST' }],
    });
    const sErr = staged.stagedUploadsCreate.userErrors;
    if (sErr?.length) return { ok: false, error: sErr.map((e) => e.message).join('; ') };
    const target = staged.stagedUploadsCreate.stagedTargets[0];
    if (!target) return { ok: false, error: 'Staged upload target alınamadı' };

    // 2) Multipart POST to staging (parameters önce, file en son)
    const form = new FormData();
    for (const p of target.parameters) form.append(p.name, p.value);
    form.append('file', new Blob([bytes as BlobPart], { type: mimeType }), filename);
    const up = await fetch(target.url, { method: 'POST', body: form });
    if (!up.ok && up.status !== 201 && up.status !== 204) {
      return { ok: false, error: `Staging upload HTTP ${up.status}` };
    }

    // 3) fileCreate — kalıcı Shopify dosyası
    const fc = await shopifyGraphQL<{
      fileCreate: { files: { id: string }[]; userErrors: { message: string }[] };
    }>(FILE_CREATE_MUTATION, {
      files: [{ originalSource: target.resourceUrl, contentType: 'IMAGE' }],
    });
    const fErr = fc.fileCreate.userErrors;
    if (fErr?.length) return { ok: false, error: fErr.map((e) => e.message).join('; ') };
    const fileId = fc.fileCreate.files[0]?.id;
    if (!fileId) return { ok: false, error: 'fileCreate id döndürmedi' };

    // 4) İşlenince kalıcı cdn URL poll et
    for (let i = 0; i < 15; i++) {
      const node = await shopifyGraphQL<{ node: { fileStatus?: string; image?: { url?: string } } | null }>(
        FILE_STATUS_QUERY,
        { id: fileId },
      );
      const url = node.node?.image?.url;
      if (url) return { ok: true, url };
      if (node.node?.fileStatus === 'FAILED') return { ok: false, error: 'Shopify görsel işleme FAILED' };
      await new Promise((r) => setTimeout(r, 1200));
    }
    return { ok: false, error: 'Görsel işleme zaman aşımı' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'upload hata' };
  }
}
