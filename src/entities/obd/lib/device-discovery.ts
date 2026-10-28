/** Advertising names are a discovery hint; only the ELM/ECU handshake confirms compatibility. */
export function isLikelyOBDName(name: string) {
  return /(?:^|[^A-Z0-9])(?:OBD(?:II|2|LINK)?|ELM(?:327)?|VGATE|VLINKER|VLINK|VEEPEAK|VIECAR|YMOBD|ICAR)(?=$|[^A-Z0-9])/i.test(
    name,
  );
}
export function bleDeviceName(name: string, id: string, unnamedLabel: string) {
  const clean = name.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (clean && clean.toUpperCase() !== 'UNKNOWN') return clean;
  const suffix = id
    .replace(/[^a-z0-9]/gi, '')
    .slice(-6)
    .toUpperCase();
  return suffix ? `${unnamedLabel} · ${suffix}` : unnamedLabel;
}
