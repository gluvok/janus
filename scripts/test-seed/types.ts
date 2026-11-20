/**
 * @file scripts/test-seed/types.ts
 * @description Strongly-typed interfaces for the test seed pipeline.
 */

export interface FactoryConfig {
  name: string;
  receipt_images_per_row: number;
}

export interface UserConfig {
  username: string;
  name: string;
  role: "admin" | "manager" | "operator" | "base";
  password_hash: string;
  factory_id: number;
}

export interface CenterConfig {
  name: string;
  factory_id: number;
}

export interface SeedContext {
  primaryFactoryId: number;
  secondaryFactoryId: number;
  userMap: Map<string, number>;
  primaryCenterIds: number[];
  secondaryCenterIds: number[];
  centerNameMap: Map<number, string>;
}
