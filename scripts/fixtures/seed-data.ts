/**
 * @file scripts/fixtures/seed-data.ts
 * @description Static datasets, test scenarios, and fixture generators for database seeding.
 */

import { Role, Unit, EntryStatus, WeighmentType, TicketStatus } from "../../lib/constants/enums";

// Tables in reverse dependency order for clearing
export const TABLES_IN_CLEAR_ORDER = [
  "sessions",
  "tickets",
  "weighments",
  "entries",
  "rates",
  "customers",
  "commodities",
  "users",
  "centers",
  "factories",
];

// Helper to generate ISO timestamps relative to now
export function getRelativeDate(daysAgo: number, hoursAgo = 0, minutesAgo = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(date.getHours() - hoursAgo);
  date.setMinutes(date.getMinutes() - minutesAgo);
  return date.toISOString();
}

export const DEFAULT_COMMODITIES = [
  { name: "Wheat" },
  { name: "Scrap Copper" },
  { name: "Corn" },
  { name: "Crude Oil" },
  { name: "Barley" },
  { name: "Wine" },
  { name: "Cable" },
  { name: "Sugarcane" },
  { name: "Soybeans" },
  { name: "Sunflower Seeds" },
  { name: "Cotton" },
  { name: "Mustard" },
];

export const MOCK_IMAGES = [
  "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=600&auto=format&fit=crop&q=60",
  "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=60",
];

export const FACTORY_CONFIGS = [{ name: "Default Factory" }, { name: "Apex Agro Logistics" }];

export interface SeedUserConfig {
  username: string;
  name: string;
  role: Role;
  pass: string;
  factoryId: number;
}

export function getUserConfigs(
  primaryFactoryId: number,
  secondaryFactoryId: number,
  hashes: { admin: string; manager: string; operator: string; base: string },
): SeedUserConfig[] {
  return [
    // Primary Factory Users
    {
      username: "admin1",
      name: "System Administrator 1",
      role: Role.ADMIN,
      pass: hashes.admin,
      factoryId: primaryFactoryId,
    },
    {
      username: "manager_alice",
      name: "Alice Morgan (Plant Manager)",
      role: Role.MANAGER,
      pass: hashes.manager,
      factoryId: primaryFactoryId,
    },
    {
      username: "operator_bob",
      name: "Bob Jenkins (Lead Operator)",
      role: Role.OPERATOR,
      pass: hashes.operator,
      factoryId: primaryFactoryId,
    },
    {
      username: "operator_charlie",
      name: "Charlie Davis (Scale Operator)",
      role: Role.OPERATOR,
      pass: hashes.operator,
      factoryId: primaryFactoryId,
    },
    {
      username: "cust_ramesh",
      name: "Ramesh Kumar",
      role: Role.BASE,
      pass: hashes.base,
      factoryId: primaryFactoryId,
    },
    {
      username: "cust_anita",
      name: "Anita Patel",
      role: Role.BASE,
      pass: hashes.base,
      factoryId: primaryFactoryId,
    },
    {
      username: "cust_vikram",
      name: "Vikram Singh",
      role: Role.BASE,
      pass: hashes.base,
      factoryId: primaryFactoryId,
    },
    {
      username: "cust_priya",
      name: "Priya Sharma",
      role: Role.BASE,
      pass: hashes.base,
      factoryId: primaryFactoryId,
    },
    // Secondary Factory Users
    {
      username: "admin2",
      name: "Apex Site Admin",
      role: Role.ADMIN,
      pass: hashes.admin,
      factoryId: secondaryFactoryId,
    },
    {
      username: "manager_bob",
      name: "Bob Vance (Apex Logistics Manager)",
      role: Role.MANAGER,
      pass: hashes.manager,
      factoryId: secondaryFactoryId,
    },
    {
      username: "operator_edward",
      name: "Edward Norton (Apex Operator)",
      role: Role.OPERATOR,
      pass: hashes.operator,
      factoryId: secondaryFactoryId,
    },
  ];
}

export interface SeedHardwareUserConfig {
  rawKey: string;
  centerName: string;
  username: string;
}

export function getHardwareUserConfigs(): SeedHardwareUserConfig[] {
  return [
    { rawKey: "hardware123", centerName: "Main Weighbridge", username: "pi1" },
    { rawKey: "hardware123", centerName: "North Automatic Scale", username: "pi2" },
    { rawKey: "hardware123", centerName: "East Grain Terminal", username: "pi3" },
    { rawKey: "hardware123", centerName: "South Express Bay", username: "pi4" },
    { rawKey: "hardware123", centerName: "Apex Inbound Scale", username: "pi5" },
    { rawKey: "hardware123", centerName: "Apex Outbound Gate", username: "pi6" },
  ];
}

export interface SeedCenterConfig {
  name: string;
  auto_approve: boolean;
  factoryId: number;
}

export function getCenterConfigs(
  primaryFactoryId: number,
  secondaryFactoryId: number,
): SeedCenterConfig[] {
  return [
    { name: "Main Weighbridge", auto_approve: false, factoryId: primaryFactoryId },
    { name: "North Automatic Scale", auto_approve: true, factoryId: primaryFactoryId },
    { name: "East Grain Terminal", auto_approve: false, factoryId: primaryFactoryId },
    { name: "South Express Bay", auto_approve: true, factoryId: primaryFactoryId },
    { name: "Apex Inbound Scale", auto_approve: true, factoryId: secondaryFactoryId },
    { name: "Apex Outbound Gate", auto_approve: false, factoryId: secondaryFactoryId },
  ];
}

export interface SeedRateConfig {
  commodity: string;
  unit_price: string;
  unit: Unit;
  factoryId: number;
}

export function getRateConfigs(
  primaryFactoryId: number,
  secondaryFactoryId: number,
): SeedRateConfig[] {
  return [
    { commodity: "Wheat", unit_price: "28.50", unit: Unit.KG, factoryId: primaryFactoryId },
    { commodity: "Wheat", unit_price: "2850.00", unit: Unit.Q, factoryId: primaryFactoryId },
    { commodity: "Scrap Copper", unit_price: "650.00", unit: Unit.KG, factoryId: primaryFactoryId },
    { commodity: "Corn", unit_price: "22.00", unit: Unit.KG, factoryId: primaryFactoryId },
    { commodity: "Corn", unit_price: "2200.00", unit: Unit.Q, factoryId: primaryFactoryId },
    { commodity: "Crude Oil", unit_price: "85.00", unit: Unit.GAL, factoryId: primaryFactoryId },
    { commodity: "Barley", unit_price: "19.50", unit: Unit.KG, factoryId: primaryFactoryId },
    { commodity: "Wine", unit_price: "140.00", unit: Unit.GAL, factoryId: primaryFactoryId },
    { commodity: "Cable", unit_price: "420.00", unit: Unit.KG, factoryId: primaryFactoryId },
    { commodity: "Sugarcane", unit_price: "3.80", unit: Unit.KG, factoryId: primaryFactoryId },
    { commodity: "Sugarcane", unit_price: "380.00", unit: Unit.Q, factoryId: primaryFactoryId },
    { commodity: "Soybeans", unit_price: "48.00", unit: Unit.KG, factoryId: primaryFactoryId },
    { commodity: "Cotton", unit_price: "72.00", unit: Unit.KG, factoryId: primaryFactoryId },
    // Factory 2 Rates
    { commodity: "Wheat", unit_price: "29.00", unit: Unit.KG, factoryId: secondaryFactoryId },
    { commodity: "Corn", unit_price: "21.50", unit: Unit.KG, factoryId: secondaryFactoryId },
    { commodity: "Soybeans", unit_price: "47.50", unit: Unit.KG, factoryId: secondaryFactoryId },
  ];
}

export interface SeedCustomerConfig {
  name: string;
  father_name: string;
  username: string | null;
  factoryId: number;
}

export function getCustomerConfigs(
  primaryFactoryId: number,
  secondaryFactoryId: number,
): SeedCustomerConfig[] {
  return [
    // Linked customers (Factory 1)
    {
      name: "Ramesh Kumar",
      father_name: "Suresh Kumar",
      username: "cust_ramesh",
      factoryId: primaryFactoryId,
    },
    {
      name: "Anita Patel",
      father_name: "Mahesh Patel",
      username: "cust_anita",
      factoryId: primaryFactoryId,
    },
    {
      name: "Vikram Singh",
      father_name: "Balwan Singh",
      username: "cust_vikram",
      factoryId: primaryFactoryId,
    },
    {
      name: "Priya Sharma",
      father_name: "Rajendra Sharma",
      username: "cust_priya",
      factoryId: primaryFactoryId,
    },
    // Standalone unlinked customers (Factory 1)
    {
      name: "Sunil Verma",
      father_name: "Kishan Verma",
      username: null,
      factoryId: primaryFactoryId,
    },
    {
      name: "Deepak Choudhary",
      father_name: "Ram Niwas",
      username: null,
      factoryId: primaryFactoryId,
    },
    {
      name: "Meena Devi",
      father_name: "Gopal Prasad",
      username: null,
      factoryId: primaryFactoryId,
    },
    { name: "Kavita Rao", father_name: "Jagdish Rao", username: null, factoryId: primaryFactoryId },
    // Factory 2 customers
    {
      name: "Harpreet Singh",
      father_name: "Gurdeep Singh",
      username: null,
      factoryId: secondaryFactoryId,
    },
    {
      name: "Amit Shah",
      father_name: "Jayantilal Shah",
      username: null,
      factoryId: secondaryFactoryId,
    },
  ];
}

export interface WeighmentPairScenario {
  vehicleNumber: string;
  detectedVehicle?: string;
  inWeight: number;
  outWeight: number;
  customerName: string;
  centerId: number;
  createdBy?: number;
  approvedBy?: number | null;
  hardwareUserId?: number | null;
  userId?: number | null;
  autoApproved: boolean;
  weighmentType: WeighmentType;
  unit: Unit;
  rateId?: number;
  daysAgo: number;
  inHoursAgo: number;
  outHoursAgo: number;
}

export function getWeighmentPairScenarios(ctx: {
  defaultOperatorId: number;
  charlieOperatorId: number;
  defaultHardwareUserId: number;
  mainCenterId: number;
  northAutoCenterId: number;
  eastTerminalCenterId: number;
  southExpressCenterId: number;
  wheatRateKg?: number;
  copperRateKg?: number;
  cornRateKg?: number;
  wineRateGal?: number;
  sugarRateQ?: number;
  soyRateKg?: number;
}): WeighmentPairScenario[] {
  return [
    // Today - Wheat Inbound (Gross In -> Tare Out)
    {
      vehicleNumber: "KA01EA1024",
      detectedVehicle: "KA01EA1024",
      inWeight: 42500,
      outWeight: 14200,
      customerName: "Ramesh Kumar",
      centerId: ctx.northAutoCenterId,
      hardwareUserId: ctx.defaultHardwareUserId,
      userId: null,
      autoApproved: true,
      weighmentType: WeighmentType.IN,
      unit: Unit.KG,
      rateId: ctx.wheatRateKg,
      daysAgo: 0,
      inHoursAgo: 4,
      outHoursAgo: 2,
    },
    // Today - Scrap Copper Inbound (Manual Scale)
    {
      vehicleNumber: "MH12PQ9080",
      detectedVehicle: "MH12PQ9080",
      inWeight: 31200,
      outWeight: 12100,
      customerName: "Anita Patel",
      centerId: ctx.mainCenterId,
      hardwareUserId: null,
      userId: ctx.defaultOperatorId,
      autoApproved: false,
      weighmentType: WeighmentType.IN,
      unit: Unit.KG,
      rateId: ctx.copperRateKg,
      daysAgo: 0,
      inHoursAgo: 6,
      outHoursAgo: 3,
    },
    // Yesterday - Corn Delivery (Automatic Scale)
    {
      vehicleNumber: "DL03CC4421",
      detectedVehicle: "DL03CC4421",
      inWeight: 38900,
      outWeight: 13400,
      customerName: "Vikram Singh",
      centerId: ctx.northAutoCenterId,
      hardwareUserId: ctx.defaultHardwareUserId,
      userId: null,
      autoApproved: true,
      weighmentType: WeighmentType.IN,
      unit: Unit.KG,
      rateId: ctx.cornRateKg,
      daysAgo: 1,
      inHoursAgo: 8,
      outHoursAgo: 5,
    },
    // 2 Days Ago - Wine Tanker Outbound (Tare In -> Gross Out)
    {
      vehicleNumber: "HR26BR7711",
      detectedVehicle: "HR26BR7711",
      inWeight: 15600,
      outWeight: 44200,
      customerName: "Priya Sharma",
      centerId: ctx.southExpressCenterId,
      hardwareUserId: ctx.defaultHardwareUserId,
      userId: null,
      autoApproved: true,
      weighmentType: WeighmentType.OUT,
      unit: Unit.GAL,
      rateId: ctx.wineRateGal,
      daysAgo: 2,
      inHoursAgo: 7,
      outHoursAgo: 4,
    },
    // 4 Days Ago (Last 7 Days) - Sugarcane Inbound (Quintals)
    {
      vehicleNumber: "GJ06ZZ3312",
      detectedVehicle: "GJ06ZZ3312",
      inWeight: 46800,
      outWeight: 15300,
      customerName: "Sunil Verma",
      centerId: ctx.eastTerminalCenterId,
      hardwareUserId: null,
      userId: ctx.charlieOperatorId,
      autoApproved: false,
      weighmentType: WeighmentType.IN,
      unit: Unit.Q,
      rateId: ctx.sugarRateQ,
      daysAgo: 4,
      inHoursAgo: 9,
      outHoursAgo: 6,
    },
    // 6 Days Ago (Last 7 Days) - Soybeans Inbound
    {
      vehicleNumber: "RJ14GH6655",
      detectedVehicle: "RJ14GH6655",
      inWeight: 39500,
      outWeight: 14100,
      customerName: "Deepak Choudhary",
      centerId: ctx.mainCenterId,
      hardwareUserId: null,
      userId: ctx.defaultOperatorId,
      autoApproved: false,
      weighmentType: WeighmentType.IN,
      unit: Unit.KG,
      rateId: ctx.soyRateKg,
      daysAgo: 6,
      inHoursAgo: 5,
      outHoursAgo: 2,
    },
    // 12 Days Ago (This Month) - Wheat Inbound
    {
      vehicleNumber: "UP32AB5544",
      detectedVehicle: "UP32AB5544",
      inWeight: 45100,
      outWeight: 14800,
      customerName: "Meena Devi",
      centerId: ctx.northAutoCenterId,
      hardwareUserId: ctx.defaultHardwareUserId,
      userId: null,
      autoApproved: true,
      weighmentType: WeighmentType.IN,
      unit: Unit.KG,
      rateId: ctx.wheatRateKg,
      daysAgo: 12,
      inHoursAgo: 6,
      outHoursAgo: 3,
    },
    // 20 Days Ago (This Month) - Scrap Copper
    {
      vehicleNumber: "PB10XY8899",
      detectedVehicle: "PB10XY8899",
      inWeight: 28400,
      outWeight: 11900,
      customerName: "Kavita Rao",
      centerId: ctx.eastTerminalCenterId,
      hardwareUserId: null,
      userId: ctx.charlieOperatorId,
      autoApproved: false,
      weighmentType: WeighmentType.IN,
      unit: Unit.KG,
      rateId: ctx.copperRateKg,
      daysAgo: 20,
      inHoursAgo: 8,
      outHoursAgo: 5,
    },
    // 35 Days Ago (Past Month) - Corn Inbound
    {
      vehicleNumber: "WB02MM1122",
      detectedVehicle: "WB02MM1122",
      inWeight: 41200,
      outWeight: 13900,
      customerName: "Ramesh Kumar",
      centerId: ctx.mainCenterId,
      hardwareUserId: null,
      userId: ctx.defaultOperatorId,
      autoApproved: false,
      weighmentType: WeighmentType.IN,
      unit: Unit.KG,
      rateId: ctx.cornRateKg,
      daysAgo: 35,
      inHoursAgo: 7,
      outHoursAgo: 4,
    },
  ];
}

export function getStandaloneEntries(ctx: {
  primaryFactoryId: number;
  secondaryFactoryId: number;
  userMap: Map<string, number>;
  centerMap: Map<string, number>;
  customerMap: Map<string, number>;
  defaultOperatorId: number;
  charlieOperatorId: number;
  defaultHardwareUserId: number;
  apexHardwareUserId: number;
  mainCenterId: number;
  northAutoCenterId: number;
  eastTerminalCenterId: number;
  southExpressCenterId: number;
}) {
  return [
    // 1. Pending Manual Entry (Needs operator approval) - Today
    {
      vehicle_number: "TN09KK4455",
      detected_vehicle_number: "TN09KK4455",
      weight: 38200,
      status: EntryStatus.PENDING,
      auto_approved: false,
      center_id: ctx.mainCenterId,
      created_by: ctx.defaultOperatorId,
      approved_by: null,
      customer_id: ctx.customerMap.get("Anita Patel"),
      factory_id: ctx.primaryFactoryId,
      images: MOCK_IMAGES,
      created_at: getRelativeDate(0, 1),
    },
    // 2. Pending Automatic Entry (Manual review queue due to OCR mismatch) - Today
    {
      vehicle_number: "TS07EE9988",
      detected_vehicle_number: "TS07EE9988",
      weight: 44100,
      status: EntryStatus.PENDING,
      auto_approved: false,
      center_id: ctx.northAutoCenterId,
      created_by: ctx.defaultHardwareUserId,
      approved_by: null,
      customer_id: ctx.customerMap.get("Vikram Singh"),
      factory_id: ctx.primaryFactoryId,
      images: MOCK_IMAGES,
      created_at: getRelativeDate(0, 2),
    },
    // 3. Rejected Entry (Excess weight / Security flag) - Yesterday
    {
      vehicle_number: "AP28FF6677",
      detected_vehicle_number: "AP28FF6677",
      weight: 62500, // Gross overload
      status: EntryStatus.REJECTED,
      auto_approved: false,
      center_id: ctx.southExpressCenterId,
      created_by: ctx.defaultHardwareUserId,
      approved_by: null,
      customer_id: ctx.customerMap.get("Sunil Verma"),
      factory_id: ctx.primaryFactoryId,
      images: MOCK_IMAGES,
      created_at: getRelativeDate(1, 4),
    },
    // 4. Rejected Manual Entry (Plate mismatch / bad manifest) - 3 Days Ago
    {
      vehicle_number: "KL07CD3344",
      detected_vehicle_number: "KL07CD3300",
      weight: 29800,
      status: EntryStatus.REJECTED,
      auto_approved: false,
      center_id: ctx.eastTerminalCenterId,
      created_by: ctx.defaultOperatorId,
      approved_by: null,
      customer_id: ctx.customerMap.get("Deepak Choudhary"),
      factory_id: ctx.primaryFactoryId,
      images: [],
      created_at: getRelativeDate(3, 6),
    },
    // 5. Active On-Site Entry (Approved Gross Inbound, awaiting exit Tare weighment) - Today
    {
      vehicle_number: "MH04AB1212",
      detected_vehicle_number: "MH04AB1212",
      weight: 41900,
      status: EntryStatus.APPROVED,
      auto_approved: true,
      center_id: ctx.northAutoCenterId,
      created_by: ctx.defaultHardwareUserId,
      approved_by: ctx.defaultHardwareUserId,
      customer_id: ctx.customerMap.get("Ramesh Kumar"),
      factory_id: ctx.primaryFactoryId,
      images: MOCK_IMAGES,
      created_at: getRelativeDate(0, 1, 30),
    },
    // 6. Active On-Site Entry (Approved Tare Inbound for loading, awaiting gross weighment) - Today
    {
      vehicle_number: "DL01XY7890",
      detected_vehicle_number: "DL01XY7890",
      weight: 13800,
      status: EntryStatus.APPROVED,
      auto_approved: false,
      center_id: ctx.mainCenterId,
      created_by: ctx.defaultOperatorId,
      approved_by: ctx.defaultOperatorId,
      customer_id: ctx.customerMap.get("Priya Sharma"),
      factory_id: ctx.primaryFactoryId,
      images: [],
      created_at: getRelativeDate(0, 0, 45),
    },
    // 7. Secondary Factory Entry (Apex Inbound) - Yesterday
    {
      vehicle_number: "GJ01AB9900",
      detected_vehicle_number: "GJ01AB9900",
      weight: 37600,
      status: EntryStatus.APPROVED,
      auto_approved: true,
      center_id: ctx.centerMap.get("Apex Inbound Scale")!,
      created_by: ctx.apexHardwareUserId,
      approved_by: ctx.apexHardwareUserId,
      customer_id: ctx.customerMap.get("Harpreet Singh"),
      factory_id: ctx.secondaryFactoryId,
      images: MOCK_IMAGES,
      created_at: getRelativeDate(1, 3),
    },
  ];
}

export function getSampleTickets(ctx: {
  sampleEntryIds: number[];
  sampleWeighmentIds: number[];
  userMap: Map<string, number>;
}) {
  return [
    {
      entry_id: ctx.sampleEntryIds[0] || null,
      weighment_id: null,
      user_id: ctx.userMap.get("operator_bob")!,
      concern:
        "Camera OCR misread rear vehicle plate due to dried mud; requested manual number correction.",
      status: TicketStatus.PENDING,
      reply: null,
      created_at: getRelativeDate(1, 2),
    },
    {
      entry_id: null,
      weighment_id: ctx.sampleWeighmentIds[0] || null,
      user_id: ctx.userMap.get("operator_charlie")!,
      concern:
        "Discrepancy in tare weight recorded on double-axle trailer vs printed scale ticket.",
      status: TicketStatus.APPROVED,
      reply:
        "Verified scale calibration log for 09:30 AM; tare adjusted and approved by DB administrator.",
      created_at: getRelativeDate(3, 4),
    },
    {
      entry_id: ctx.sampleEntryIds[1] || null,
      weighment_id: null,
      user_id: ctx.userMap.get("manager_alice")!,
      concern:
        "Suspected duplicate entry created due to network reconnect loop on weighbridge sensor.",
      status: TicketStatus.REJECTED,
      reply:
        "Reviewed scale camera stills; two distinct vehicles crossed the sensor within 45 seconds. Rejected.",
      created_at: getRelativeDate(7, 5),
    },
  ];
}
