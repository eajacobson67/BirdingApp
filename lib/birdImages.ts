export async function fetchBirdThumbnails(
  names: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(names)];
  const result: Record<string, string> = {};

  await Promise.allSettled(
    unique.map(async (name) => {
      try {
        const r = await fetch(
          `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(name)}&per_page=1&rank=species,subspecies`,
        );
        const data = await r.json();
        const url =
          data?.results?.[0]?.default_photo?.square_url ??
          data?.results?.[0]?.default_photo?.medium_url;
        if (url) result[name] = url;
      } catch { /* no thumbnail for this bird */ }
    }),
  );

  return result;
}
