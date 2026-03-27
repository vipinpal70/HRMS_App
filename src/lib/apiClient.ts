/**
 * Shared API client utilities for making fetch calls to API routes.
 */

async function handleResponse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error || res.statusText };
  }
  return data;
}

export async function apiGet(url: string) {
  const res = await fetch(url);
  return handleResponse(res);
}

export async function apiPost(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function apiPatch(url: string, body: any) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function apiPut(url: string, body: any) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function apiDelete(url: string) {
  const res = await fetch(url, { method: 'DELETE' });
  return handleResponse(res);
}

export async function apiPostFormData(url: string, formData: FormData) {
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });
  return handleResponse(res);
}

export async function apiPutFormData(url: string, formData: FormData) {
  const res = await fetch(url, {
    method: 'PUT',
    body: formData,
  });
  return handleResponse(res);
}
