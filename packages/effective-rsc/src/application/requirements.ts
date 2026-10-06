import type { Types } from 'effect';

declare const RequirementsTypeId: unique symbol;

export type ServiceRequirements<out Services> = {
  readonly [RequirementsTypeId]?: Types.Covariant<Services>;
};

export type RequirementsOf<Value> =
  Value extends ServiceRequirements<infer Services> ? Services : never;
