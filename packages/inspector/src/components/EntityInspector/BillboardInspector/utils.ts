import type { PBBillboard } from '@dcl/ecs';

export type BillboardInput = {
  billboardMode: string;
};

export const fromBillboard = (value: PBBillboard): BillboardInput => ({
  billboardMode: (value.billboardMode ?? 7).toString(), // Default to BM_ALL (7)
});

export const toBillboard = (input: BillboardInput): PBBillboard => ({
  billboardMode: parseInt(input.billboardMode, 10),
});

export const isValidInput = (): boolean => true;
