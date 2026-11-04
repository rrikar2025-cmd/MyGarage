import { requireCloud } from '@/shared/api';
import { storage } from '@/shared/lib';
import type { InsurancePolicy } from '../model/policy';

const localKey = (vehicleId: string) => `mygarage.insurance.v1:${vehicleId}`;

export async function readInsurance(
  owner: string | null,
  vehicleId: string,
): Promise<InsurancePolicy | null> {
  if (!owner) {
    const raw = await storage.getItem(localKey(vehicleId));
    return raw ? (JSON.parse(raw) as InsurancePolicy) : null;
  }
  const result = await requireCloud()
    .from('insurance_policies')
    .select('vehicle_id,provider,policy_number,expires_on')
    .eq('owner_id', owner)
    .eq('vehicle_id', vehicleId)
    .maybeSingle<InsurancePolicy>();
  if (result.error) throw result.error;
  return result.data;
}

export async function saveInsurance(owner: string | null, policy: InsurancePolicy): Promise<void> {
  if (!owner) {
    await storage.setItem(localKey(policy.vehicle_id), JSON.stringify(policy));
    return;
  }
  const result = await requireCloud()
    .from('insurance_policies')
    .upsert({ ...policy, owner_id: owner }, { onConflict: 'vehicle_id' });
  if (result.error) throw result.error;
}

export async function removeInsurance(owner: string | null, vehicleId: string): Promise<void> {
  if (!owner) {
    await storage.removeItem(localKey(vehicleId));
    return;
  }
  const result = await requireCloud()
    .from('insurance_policies')
    .delete()
    .eq('owner_id', owner)
    .eq('vehicle_id', vehicleId);
  if (result.error) throw result.error;
}
