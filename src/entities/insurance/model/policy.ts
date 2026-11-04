export type InsurancePolicy = {
  vehicle_id: string;
  provider: string;
  policy_number: string;
  expires_on: string;
};

export function validInsuranceDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2200-12-31')
    return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
