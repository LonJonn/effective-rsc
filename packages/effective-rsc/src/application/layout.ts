import { Effect } from 'effect';
import type { ReactNode } from 'react';

import { attachERSCMember, type ERSCIdentity, type ERSCMember } from './ersc-identity';
import type { AnyMiddleware } from './middleware';
import type { ServiceRequirements } from './requirements';

type LayoutProps = {
  readonly children: Awaited<ReactNode>;
};

export interface LayoutComponent<ApplicationServices, Requirements = never>
  extends ERSCMember<ApplicationServices, 'Layout'>, ServiceRequirements<Requirements> {
  (props: LayoutProps): Promise<Awaited<ReactNode>>;
}

type LayoutOptions<Error, AvailableServices> = {
  readonly render: (
    props: LayoutProps,
  ) => Effect.Effect<Awaited<ReactNode>, Error, AvailableServices>;
};

export type LayoutFactory<ApplicationServices, AvailableServices, Requirements = never> = {
  readonly make: <Error>(
    options: LayoutOptions<Error, AvailableServices>,
  ) => LayoutComponent<ApplicationServices, Requirements>;
};

export const makeLayoutFactory = <ApplicationServices, AvailableServices, Requirements = never>(
  identity: ERSCIdentity<ApplicationServices>,
  middleware: ReadonlyArray<AnyMiddleware<ApplicationServices>>,
): LayoutFactory<ApplicationServices, AvailableServices, Requirements> => ({
  make: ({ render }) => {
    const LayoutComponent = (props: LayoutProps) =>
      identity.renderRuntime.run(
        'Layout',
        Effect.suspend(() => render(props)),
        middleware,
      );

    return attachERSCMember(LayoutComponent, identity, 'Layout');
  },
});
